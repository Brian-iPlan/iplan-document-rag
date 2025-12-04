import type { ChatMessage, DocumentItem } from "../types";
import { API_BASE_URL } from '../config';

const mapStatus = (s: string) => (s === 'active' ? 'active' : s === 'indexing' ? 'indexing' : 'error');

export const getDocuments = async (): Promise<DocumentItem[]> => {
  const response = await fetch(`${API_BASE_URL}/documents`);
  if (!response.ok) throw new Error('Backend unreachable');
  const data = await response.json();
  return data.map((doc: any) => ({ ...doc, status: mapStatus(doc.status) }));
};

export const getDocumentContent = async (id: string): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/documents/${id}`);
  if (!response.ok) throw new Error('Backend unreachable');
  const data = await response.json();
  return data.content || "No content available.";
};

export const uploadDocument = async (file: File, clientId: string, newName: string): Promise<DocumentItem> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('clientId', clientId);
  formData.append('newName', newName);

  const response = await fetch(`${API_BASE_URL}/documents`, { method: 'POST', body: formData });
  if (!response.ok) throw new Error('Upload failed');

  const doc = await response.json();
  return { ...doc, status: mapStatus(doc.status) };
};

export const deleteDocument = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/documents/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Deletion failed');
};

export const sendMessageToGemini = async (
  message: string, 
  clientId: string, 
  history: ChatMessage[],
  onChunk: (chunk: string) => void
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, clientId, history: history.map(msg => ({ role: msg.role, content: msg.text })) }),
  });

  if (!response.ok || !response.body) {
    throw new Error('Chat request failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunk = decoder.decode(value, { stream: true });
    onChunk(chunk);
  }
};