# --- backend/app.py ---

import os
import uuid
import redis
import json
import datetime
import tempfile
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename
from google.cloud import aiplatform
import google.generativeai as genai

# --- Text Extraction Libraries ---
import pypdf
import docx

# --- CONFIGURATION ---

# --- Service Account Authentication ---
credentials_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")

if credentials_json and credentials_json.strip():
    # If provided (e.g., in local development), write to a temp file
    with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.json') as temp_f:
        temp_f.write(credentials_json)
        temp_f.flush()
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = temp_f.name
else:
    # Safe fallback: Cloud Run natively uses its attached runtime service account.
    print("GOOGLE_APPLICATION_CREDENTIALS_JSON not found or blank. Using Application Default Credentials.")

# Explicitly initialize Vertex AI
PROJECT_ID = os.getenv("GOOGLE_PROJECT_ID")
LOCATION = "us-central1"
aiplatform.init(project=PROJECT_ID, location=LOCATION)

# --- Redis Config ---
REDIS_URL = os.getenv("REDIS_URL")
if not REDIS_URL:
    raise ValueError("REDIS_URL not found. Please set it in an environment variable.")
r = redis.from_url(REDIS_URL, decode_responses=True)

# --- Flask App Config ---
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt', 'md'}
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Allow dynamic CORS handling across localhost and any Vercel domain branches
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Hard intercept to dynamically trust whichever active Vercel domain or local engine calls it
@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    if origin:
        if "localhost" in origin or "127.0.0.1" in origin or "iplan-document-rag" in origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,PUT,POST,DELETE,OPTIONS"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# --- HELPER FUNCTIONS ---
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- API ENDPOINTS ---

# 1. Document Upload Route
@app.route('/documents', methods=['POST', 'OPTIONS'])
@app.route('/documents/', methods=['POST', 'OPTIONS'])
@app.route('/documents/<path:path>', methods=['POST', 'OPTIONS'])
def upload_document_handler(path=None):
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200

    if 'file' not in request.files or 'clientId' not in request.form:
        return jsonify({"error": "Invalid request"}), 400
    
    file = request.files['file']
    client_id = request.form.get('clientId')
    new_name = f"{client_id}_{file.filename}"

    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type"}), 400

    filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(file.filename))
    file.save(filepath)

    try:
        print(f"Uploading {new_name} to Gemini...")
        gemini_file = genai.upload_file(path=filepath, display_name=new_name)
        
        doc_id = gemini_file.name
        doc_data = {
            "id": doc_id,
            "name": new_name,
            "clientId": client_id,
            "type": file.filename.rsplit('.', 1)[1].lower(),
            "date": datetime.datetime.now().strftime('%b %d, %Y'),
            "status": 'active',
            "gemini_name": gemini_file.name
        }
        
        r.hset("documents", doc_id, json.dumps(doc_data))
        print(f"Successfully saved {doc_id} to Redis.")
        
        return jsonify(doc_data), 201

    except Exception as e:
        print(f"Upload failed: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)

@app.route('/documents/<path:doc_id>', methods=['DELETE', 'OPTIONS'])
def delete_document_handler(doc_id):
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    try:
        r.hdel("documents", doc_id)
        genai.delete_file(doc_id)
        return jsonify({"message": "Document deleted"}), 200
    except Exception as e:
        print(f"Error during deletion: {e}")
        return jsonify({"error": str(e)}), 500

# 2. Document List Retrieval Route
@app.route('/documents', methods=['GET', 'OPTIONS'])
@app.route('/documents/', methods=['GET', 'OPTIONS'])
@app.route('/documents/<path:path>', methods=['GET', 'OPTIONS'])
def get_documents_list_handler(path=None):
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    try:
        all_docs_raw = r.hgetall("documents")
        all_docs = [json.loads(doc_json) for doc_json in all_docs_raw.values()]
        return jsonify(all_docs)
    except Exception as e:
        print(f"Error fetching documents: {e}")
        return jsonify([]), 500

# 3. AI Document Streaming Chat Route
@app.route('/chat', methods=['POST', 'OPTIONS'])
def chat_handler():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200

    data = request.get_json()
    if not data or 'message' not in data or 'clientId' not in data:
        return jsonify({"error": "Invalid request"}), 400

    user_message = data['message']
    client_id = data['clientId']
    
    def stream_error_message(message):
        def generate():
            yield message
        return Response(generate(), mimetype='text/html')

    try:
        all_docs_raw = r.hgetall("documents")
        all_docs = [json.loads(doc_json) for doc_json in all_docs_raw.values()]

        client_docs = [doc for doc in all_docs if doc.get('clientId') == client_id]
        regs_docs = []
        if client_id != "Regs":
            regs_docs = [doc for doc in all_docs if doc.get('clientId') == "Regs"]
        
        temp_combined = {doc['id']: doc for doc in client_docs + regs_docs}
        relevant_docs_data = list(temp_combined.values())

        if not relevant_docs_data:
            return stream_error_message("No documents were found for this client.")

        relevant_docs_data.sort(key=lambda x: datetime.datetime.strptime(x['date'], '%b %d, %Y'), reverse=True)

        DOCUMENT_LIMIT = 15 
        warning_message = ""
        if len(relevant_docs_data) > DOCUMENT_LIMIT:
            warning_message = f"\n\n*(Note: Your query matched {len(relevant_docs_data)} documents. To ensure stability, only the {DOCUMENT_LIMIT} most recent were used.)*"
            relevant_docs_data = relevant_docs_data[:DOCUMENT_LIMIT]

        context_files = []
        for doc_data in relevant_docs_data:
            try:
                context_files.append(genai.get_file(name=doc_data['gemini_name']))
            except Exception as e:
                print(f"CRITICAL: Could not retrieve file {doc_data.get('name')} (ID: {doc_data.get('gemini_name')}). Error: {e}")

        if not context_files:
            error_msg = f"Found {len(relevant_docs_data)} documents, but could not access them on the AI service. Please check permissions."
            return stream_error_message(error_msg)

        model = genai.GenerativeModel(model_name='gemini-pro-latest')
        response = model.generate_content([user_message] + context_files, stream=True)

        def generate():
            for chunk in response:
                if chunk.text:
                    yield chunk.text
            if warning_message:
                yield warning_message

        return Response(generate(), mimetype='text/html')

    except Exception as e:
        print(f"Chat handler error: {e}")
        return stream_error_message("An error occurred on the server while processing your request.")

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "iplan-document-rag-backend"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)