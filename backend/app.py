# --- backend/app.py ---

import os
import uuid
import redis
import json
import datetime
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename
import google.generativeai as genai
from markdown_it import MarkdownIt

# --- Text Extraction Libraries ---
import pypdf
import docx

# --- CONFIGURATION ---

# --- Gemini API Config ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found. Please set it in a .env file.")
genai.configure(api_key=GEMINI_API_KEY)

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
CORS(app)

# --- HELPER FUNCTIONS ---
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- API ENDPOINTS ---
@app.route('/documents', methods=['POST'])
def upload_document_handler():
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
        
        doc_id = gemini_file.name # Use the permanent Gemini ID
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

@app.route('/documents/<path:doc_id>', methods=['DELETE'])
def delete_document_handler(doc_id):
    try:
        r.hdel("documents", doc_id)
        genai.delete_file(doc_id)
        return jsonify({"message": "Document deleted"}), 200
    except Exception as e:
        print(f"Error during deletion: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/documents', methods=['GET'])
def get_documents_list_handler():
    try:
        all_docs_raw = r.hgetall("documents")
        all_docs = [json.loads(doc_json) for doc_json in all_docs_raw.values()]
        return jsonify(all_docs)
    except Exception as e:
        print(f"Error fetching documents: {e}")
        return jsonify([]), 500

@app.route('/chat', methods=['POST'])
def chat_handler():
    data = request.get_json()
    if not data or 'message' not in data or 'clientId' not in data:
        return jsonify({"error": "Invalid request"}), 400

    user_message = data['message']
    client_id = data['clientId']
    
    try:
        all_docs_raw = r.hgetall("documents")
        client_docs = [
            json.loads(doc_json) for doc_json in all_docs_raw.values() 
            if json.loads(doc_json).get('clientId') == client_id
        ]

        if not client_docs:
            return jsonify({"response": "No documents found for this client."})

        context_files = [genai.get_file(name=doc['gemini_name']) for doc in client_docs]
        model_prompt = [user_message, *context_files]

        model = genai.GenerativeModel(model_name='models/gemini-pro-latest')
        response = model.generate_content(model_prompt, stream=True)

        def generate():
            md = MarkdownIt()
            for chunk in response:
                yield md.render(chunk.text)

        return Response(generate(), mimetype='text/html')

    except Exception as e:
        print(f"Chat handler error: {e}")
        return jsonify({"error": "Failed to get response from Gemini."}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
