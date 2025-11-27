export interface DocumentItem {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'md' | 'other';
  date: string;
  status: 'active' | 'indexing' | 'error';
  size?: string;
  clientId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isError?: boolean;
}

export interface DocumentFilter {
  id: 'all' | 'active' | 'processing';
  label: string;
}

export type ViewMode = 'dashboard' | 'documents' | 'settings';