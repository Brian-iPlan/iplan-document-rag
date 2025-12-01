# --- backend/app.py ---

import os
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import google.generativeai as genai
from dotenv import load_dotenv
from markdown_it import MarkdownIt
import datetime

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

def rehydrate_db_from_gemini():
    """Connect to Gemini API on startup and rebuild the in-memory DB."""
    print("--- Rehydrating database from Gemini File API ---")
    try:
        for file in genai.list_files():
            # Attempt to parse clientId and name from the display_name
            if '_' in file.display_name:
                parts = file.display_name.split('_', 1)
                client_id = parts[0]
                original_name = parts[1]

                # Use Gemini file's unique name as the primary key for our DB
                doc_id = file.name 

                doc_metadata = {
                    "id": doc_id,
                    "name": original_name,
                    "clientId": client_id,
                    "type": original_name.rsplit('.', 1)[1].lower() if '.' in original_name else 'other',
                    "date": file.create_time.strftime('%b %d, %Y'),
                    "status": 'active',
                    "content": "Content is not stored in memory for rehydrated files.",
                    "gemini_name": file.name
                }
                documents_db[doc_id] = doc_metadata
        print(f"--- Found and loaded {len(documents_db)} existing documents. ---")
    except Exception as e:
        print(f"Could not rehydrate database from Gemini: {e}")


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- API ENDPOINTS ---

@app.route('/documents', methods=['POST'])
def upload_document_handler():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    clientId = request.form.get('clientId')
    if not all([file, clientId]) or not allowed_file(file.filename):
        return jsonify({"error": "Invalid request"}), 400

    # Create a new unique name for the file to be displayed
    newName = f"{clientId}_{file.filename}"

    filename = secure_filename(file.filename) # Keep original for saving
    doc_id = str(uuid.uuid4()) # Temp ID for saving
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"{doc_id}_{filename}")
    file.save(filepath)

    try:
        print(f"Uploading {newName} to Gemini File API...")
        gemini_file = genai.upload_file(path=filepath, display_name=newName)
        
        # Use the permanent Gemini ID as the key from now on
        final_doc_id = gemini_file.name 

        doc_metadata = {
            "id": final_doc_id,
            "name": file.filename, # Show original name in UI
            "clientId": clientId,
            "type": filename.rsplit('.', 1)[1].lower(),
            "date": datetime.datetime.now().strftime('%b %d, %Y'),
            "status": 'active',
            "content": "", # We can extract preview text if needed
            "gemini_name": gemini_file.name
        }
        documents_db[final_doc_id] = doc_metadata
        print(f"Upload successful. Gemini Name: {gemini_file.name}")
        return jsonify(doc_metadata), 201

    except Exception as e:
        print(f"Gemini API upload failed: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/documents/<path:doc_id>', methods=['DELETE'])
def delete_document_handler(doc_id):
    doc = documents_db.pop(doc_id, None)
    if doc and doc.get('gemini_name'):
        try:
            print(f"Deleting {doc['gemini_name']} from Gemini...")
            genai.delete_file(doc['gemini_name'])
        except Exception as e:
            print(f"Failed to delete file from Gemini: {e}")
    return jsonify({"message": "Document deleted"}), 200

@app.route('/documents', methods=['GET'])
def get_documents_list_handler():
    return jsonify(list(documents_db.values()))

@app.route('/documents/<path:doc_id>', methods=['GET'])
def get_document_content_handler(doc_id):
    # This is for preview, so we need to fetch and extract text on demand
    doc = documents_db.get(doc_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404
    return jsonify({"id": doc_id, "content": "Preview not available for reloaded documents."})

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

# --- SERVER STARTUP ---
if __name__ != '__main__':
    # This block runs when gunicorn starts the server on Render
    rehydrate_db_from_gemini()

if __name__ == '__main__':
    # This block runs when you start the server locally with `py app.py`
    rehydrate_db_from_gemini()
    app.run(host='0.0.0.0', port=8000, debug=True)
