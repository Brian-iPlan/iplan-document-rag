export interface DocumentItem {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'doc' | 'xls' | 'xlsx' | 'txt' | 'md' | 'csv' | 'other';
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

export type ViewMode = 'dashboard' | 'documents' | 'settings';
