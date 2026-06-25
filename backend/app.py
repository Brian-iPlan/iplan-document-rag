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
from google import genai
from google.genai import types

# --- Diagnostics: Print GOOGLE Environment Variables ---
print("=== START DIAGNOSTIC: GOOGLE ENVIRONMENT VARIABLES ===")
for key, value in os.environ.items():
    if "GOOGLE" in key.upper():
        if "JSON" in key.upper() or "CREDENTIALS" in key.upper():
            print(f"{key}: [SET, length={len(value)}]" if value else f"{key}: [NOT SET]")
        else:
            print(f"{key}: {value}")
print("=== END DIAGNOSTIC ===")

# --- Gemini API Configuration ---
gemini_api_key = os.getenv("GEMINI_API_KEY")
if gemini_api_key:
    client = genai.Client(api_key=gemini_api_key)
    print("Gemini API client initialized successfully with GEMINI_API_KEY.")
else:
    client = genai.Client()
    print("WARNING: GEMINI_API_KEY is not set in the environment. Initialized client with default credentials.")



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

    try:
        client_id = None
        file_name = None
        file_bytes = None
        request_size = None

        if request.is_json:
            req_data = request.get_json() or {}
            client_id = req_data.get('clientId')
            file_name = req_data.get('fileName') or req_data.get('filename') or 'document.txt'
            raw_data = req_data.get('data')
            request_size = req_data.get('requestSize')
            
            if raw_data:
                import base64
                if isinstance(raw_data, str):
                    try:
                        if ',' in raw_data:
                            raw_data = raw_data.split(',', 1)[1]
                        file_bytes = base64.b64decode(raw_data)
                    except Exception:
                        file_bytes = raw_data.encode('utf-8')
                else:
                    file_bytes = raw_data
        else:
            # 1. Standard file upload
            if 'file' in request.files:
                file = request.files['file']
                client_id = request.form.get('clientId')
                file_name = file.filename
                file_bytes = file.read()
                request_size = request.form.get('requestSize')
            # 2. Form field data upload
            elif 'data' in request.form:
                client_id = request.form.get('clientId')
                file_name = request.form.get('fileName') or request.form.get('filename') or 'document.txt'
                raw_data = request.form.get('data')
                request_size = request.form.get('requestSize')
                
                import base64
                if isinstance(raw_data, str):
                    try:
                        if ',' in raw_data:
                            raw_data = raw_data.split(',', 1)[1]
                        file_bytes = base64.b64decode(raw_data)
                    except Exception:
                        file_bytes = raw_data.encode('utf-8')
                else:
                    file_bytes = raw_data

        if not client_id or not file_name or file_bytes is None:
            return jsonify({"error": "Invalid request: missing clientId, file/data, or fileName"}), 400

        if file_name == '' or not allowed_file(file_name):
            return jsonify({"error": "Invalid file type"}), 400

        # Log details about the upload size
        file_size = len(file_bytes)
        print(f"Processing upload: client={client_id}, file={file_name}, size={file_size} bytes, requestSize={request_size}")

        filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(file_name))
        with open(filepath, 'wb') as f:
            f.write(file_bytes)

        try:
            new_name = f"{client_id}_{file_name}"
            print(f"Uploading {new_name} to Gemini...")
            gemini_file = client.files.upload(
                file=filepath,
                config=types.UploadFileConfig(display_name=new_name)
            )
            
            doc_id = gemini_file.name
            doc_data = {
                "id": doc_id,
                "name": new_name,
                "clientId": client_id,
                "type": file_name.rsplit('.', 1)[1].lower() if '.' in file_name else 'txt',
                "date": datetime.datetime.now().strftime('%b %d, %Y'),
                "status": 'active',
                "gemini_name": gemini_file.name
            }
            
            r.hset("documents", doc_id, json.dumps(doc_data))
            print(f"Successfully saved {doc_id} to Redis.")
            
            return jsonify(doc_data), 201

        except Exception as api_err:
            import traceback
            traceback.print_exc()
            print(f"Gemini API upload or Redis save failed: {api_err}")
            return jsonify({"error": str(api_err), "traceback": traceback.format_exc()}), 500
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)
    except Exception as route_err:
        import traceback
        traceback.print_exc()
        print(f"Route handler failed: {route_err}")
        return jsonify({"error": str(route_err), "traceback": traceback.format_exc()}), 500


@app.route('/documents/<path:doc_id>', methods=['DELETE', 'OPTIONS'])
def delete_document_handler(doc_id):
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    try:
        r.hdel("documents", doc_id)
        client.files.delete(name=doc_id)
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
                context_files.append(client.files.get(name=doc_data['gemini_name']))
            except Exception as e:
                print(f"CRITICAL: Could not retrieve file {doc_data.get('name')} (ID: {doc_data.get('gemini_name')}). Error: {e}")

        if not context_files:
            error_msg = f"Found {len(relevant_docs_data)} documents, but could not access them on the AI service. Please check permissions."
            return stream_error_message(error_msg)

        response = client.models.generate_content_stream(
            model='gemini-2.5-flash',
            contents=[user_message] + context_files
        )

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

@app.route('/favicon.ico')
def favicon():
    return '', 204

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "iplan-document-rag-backend"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)