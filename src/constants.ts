import type { DocumentItem } from './types';

export const INITIAL_DOCUMENTS: DocumentItem[] = [];

export const WELCOME_SUGGESTIONS = [
  {
    title: 'Summarise a document',
    description: 'Upload a file and ask: "Summarise the key points in this document"',
  },
  {
    title: 'Ask specific questions',
    description: 'e.g., "What are the key dates mentioned in the uploaded file?"',
  },
];