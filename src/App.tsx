import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import Toast from './components/Toast';
import type { DocumentItem, ChatMessage, ViewMode } from './types';
import { sendMessageToGemini, uploadDocument, getDocuments, deleteDocument } from './services/geminiService';

const App: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [clientId, setClientId] = useState('CLIENT-001');
  const [activeView, setActiveView] = useState<ViewMode>('documents');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const docs = await getDocuments();
        setDocuments(docs);
        setIsConnected(true);
      } catch (err) {
        console.error("Backend Connection Error:", err);
        setIsConnected(false);
      }
    };
    fetchDocs();
  }, []);

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,.txt,.md,.csv';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const tempId = Date.now().toString();
        const optimisticDoc: DocumentItem = {
          id: tempId,
          name: file.name,
          clientId: clientId,
          type: (file.name.split('.').pop() as any) || 'other',
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: 'indexing'
        };
        
        setDocuments(prev => [optimisticDoc, ...prev]);

        try {
          const uploadedDoc = await uploadDocument(file, clientId);
          setDocuments(prev => prev.map(d => d.id === tempId ? uploadedDoc : d));
          setToast({ message: "Document uploaded successfully", type: 'success' });
          setIsConnected(true);
        } catch (error: any) {
          setDocuments(prev => prev.map(d => d.id === tempId ? { ...d, status: 'error' } : d));
          console.error("Upload failed", error);
          setIsConnected(false);
          setToast({ message: "Upload failed. Is the backend running?", type: 'error' });
        }
      }
    };
    
    input.click();
  };

  const handleDeleteDocument = async (id: string) => {
    const prevDocs = documents;
    setDocuments(prev => prev.filter(d => d.id !== id));
    
    try {
        await deleteDocument(id);
        setToast({ message: "Document deleted", type: 'success' });
    } catch (error) {
        setDocuments(prevDocs);
        console.error("Delete failed", error);
        setIsConnected(false);
        setToast({ message: "Failed to delete document", type: 'error' });
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const responseText = await sendMessageToGemini(text, clientId, messages);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);
      setIsConnected(true);
    } catch (error: any) {
      setIsConnected(false);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `<b>Connection Error:</b> Could not reach the AI service. Please check the backend connection.`,
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    setToast({ message: "Conversation history cleared", type: 'success' });
  };

  const filteredDocumentsForSidebar = documents.filter(doc => !clientId || doc.clientId === clientId);

  const DashboardView = () => ( <div className="flex-1 p-6"><h2 className="text-2xl font-bold">Dashboard</h2></div> );
  const SettingsView = () => ( <div className="flex-1 p-6"><h2 className="text-2xl font-bold">Settings</h2></div> );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0f172a]">
      {isSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      <div className={`fixed inset-y-0 left-0 z-50 w-full sm:w-auto transform transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar 
          documents={filteredDocumentsForSidebar}
          onUpload={handleUpload} 
          isConnected={isConnected}
          activeView={activeView}
          onViewChange={setActiveView}
          onDelete={handleDeleteDocument}
          clientId={clientId}
          onClientIdChange={setClientId}
        />
      </div>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {activeView === 'documents' && (
          <ChatInterface 
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            onToggleSidebar={() => setIsSidebarOpen(true)}
            onClearHistory={handleClearHistory}
          />
        )}
        {activeView === 'dashboard' && <DashboardView />}
        {activeView === 'settings' && <SettingsView />}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default App;
