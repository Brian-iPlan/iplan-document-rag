import type { ChatMessage, DocumentItem } from "../types";

// Configuration for the Dockerized Gemini File Search Service
// NOTE: This must match the port your Docker container is mapped to (usually 8000)
const API_BASE_URL = 'http://localhost:8000';

const mapStatus = (status: string): 'active' | 'indexing' | 'error' => {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'success' || s === 'processed' || s === 'ready') return 'active';
  if (s === 'indexing' || s === 'processing' || s === 'pending' || s === 'uploading') return 'indexing';
  return 'error';
};

export const getDocuments = async (): Promise<DocumentItem[]> => {
  const response = await fetch(`${API_BASE_URL}/documents`);
  if (!response.ok) {
    throw new Error('Backend unreachable');
  }
  const data = await response.json();
  return data.map((doc: any) => ({
    id: doc.id || Math.random().toString(36).substr(2, 9),
    name: doc.name || 'Untitled Document',
    type: doc.type || 'other',
    date: doc.date || new Date().toLocaleDateString(),
    status: mapStatus(doc.status),
    size: doc.size
  }));
};

export const getDocumentContent = async (id: string): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/documents/${id}`);
  if (!response.ok) {
    throw new Error('Backend unreachable');
  }
  const data = await response.json();
  return data.content || data.text || "No text content available for this document.";
};

export const uploadDocument = async (file: File): Promise<DocumentItem> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/documents`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  const doc = await response.json();
  return {
    ...doc,
    status: mapStatus(doc.status)
  };
};

export const deleteDocument = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/documents/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Delete failed');
  }
};

export const sendMessageToGemini = async (
  message: string,
  history: ChatMessage[]
): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      history: history.map(msg => ({
        role: msg.role,
        content: msg.text,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error('Chat request failed');
  }

  const data = await response.json();
  return data.response || data.text || data.html || data.answer || "No response content from server.";
};