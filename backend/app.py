# --- backend/app.py ---

import os
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import google.generativeai as genai
from dotenv import load_dotenv
from markdown_it import MarkdownIt

# --- Text Extraction Libraries ---
import pypdf
import docx

# --- CONFIGURATION ---
load_dotenv() # Load environment variables from .env file

# Set up Google Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found. Please set it in a .env file.")
genai.configure(api_key=GEMINI_API_KEY)

# Ensure the upload folder exists
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt', 'md'}

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
CORS(app) # Enable Cross-Origin Resource Sharing

# --- IN-MEMORY DATABASE ---
documents_db = {}

# --- HELPER FUNCTIONS ---

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text(filepath):
    ext = filepath.rsplit('.', 1)[1].lower()
    text = ""
    try:
        if ext == 'pdf':
            with open(filepath, 'rb') as f:
                reader = pypdf.PdfReader(f)
                for page in reader.pages:
                    text += page.extract_text() or ""
        elif ext == 'docx':
            doc = docx.Document(filepath)
            for para in doc.paragraphs:
                text += para.text + "\n"
        elif ext in ['txt', 'md']:
            with open(filepath, 'r', encoding='utf-8') as f:
                text = f.read()
    except Exception as e:
        print(f"Error extracting text from {filepath}: {e}")
        return None
    return text

# --- API ENDPOINTS ---

@app.route('/documents', methods=['POST'])
def upload_document_handler():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    clientId = request.form.get('clientId')
    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({"error": "Invalid or no selected file"}), 400

    filename = secure_filename(file.filename)
    doc_id = str(uuid.uuid4())
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"{doc_id}_{filename}")
    file.save(filepath)

    doc_metadata = {
        "id": doc_id,
        "name": filename,
        "clientId": clientId,
        "type": filename.rsplit('.', 1)[1].lower(),
        "date": "Just now",
        "status": 'indexing',
        "content": "",
        "gemini_name": None
    }
    documents_db[doc_id] = doc_metadata

    text_content = extract_text(filepath)
    documents_db[doc_id]['content'] = text_content

    try:
        gemini_file = genai.upload_file(path=filepath, display_name=f"{clientId}_{filename}")
        documents_db[doc_id]['gemini_name'] = gemini_file.name
        documents_db[doc_id]['status'] = 'active'
    except Exception as e:
        documents_db[doc_id]['status'] = 'error'
        print(f"Gemini API upload failed: {e}")
        return jsonify({"error": str(e)}), 500
    
    return jsonify(documents_db[doc_id]), 201

@app.route('/documents/<doc_id>', methods=['DELETE'])
def delete_document_handler(doc_id):
    doc = documents_db.pop(doc_id, None)
    if doc and doc.get('gemini_name'):
        try:
            genai.delete_file(doc['gemini_name'])
        except Exception as e:
            print(f"Failed to delete file from Gemini: {e}")
    return jsonify({"message": "Document deleted"}), 200

@app.route('/documents', methods=['GET'])
def get_documents_list_handler():
    return jsonify(list(documents_db.values()))

@app.route('/documents/<doc_id>', methods=['GET'])
def get_document_content_handler(doc_id):
    doc = documents_db.get(doc_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404
    return jsonify({"id": doc_id, "content": doc.get('content', "No content available.")})

@app.route('/chat', methods=['POST'])
def chat_handler():
    data = request.get_json()
    if not data or 'message' not in data or 'clientId' not in data:
        return jsonify({"error": "Invalid request"}), 400

    user_message = data['message']
    client_id = data['clientId']
    
    context_files = []
    for doc in documents_db.values():
        if doc['status'] == 'active' and doc.get('clientId') == client_id and doc.get('gemini_name'):
            context_files.append(genai.get_file(name=doc['gemini_name']))

    if not context_files:
        return jsonify({"response": "I do not have access to any documents for that client. Please upload one first."})

    model_prompt = [user_message, *context_files]

    try:
        model = genai.GenerativeModel(model_name='models/gemini-pro-latest')
        response = model.generate_content(model_prompt)
        
        md = MarkdownIt()
        html_response = md.render(response.text)
        
        return jsonify({"response": html_response})
    except Exception as e:
        print(f"Gemini chat error: {e}")
        return jsonify({"error": "Failed to get response from Gemini."}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
