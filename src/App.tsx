import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import Toast from './components/Toast';
import type { DocumentItem, ChatMessage, ViewMode } from './types';
import { sendMessageToGemini, uploadDocument, getDocuments, deleteDocument } from './services/geminiService';
import { BarChart3, Database, HardDrive, Cpu, Settings as SettingsIcon } from 'lucide-react';

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

  const DashboardView = () => (
    <div className="flex-1 overflow-y-auto p-6 bg-[#0f172a] text-slate-200">
      <h2 className="text-2xl font-bold text-white mb-6">Dashboard Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-600/20 rounded-lg text-blue-400"><Database size={24} /></div>
            <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded">Total</span>
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">{documents.length}</h3>
          <p className="text-sm text-slate-400">Documents Indexed</p>
        </div>
        
        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-500/20 rounded-lg text-emerald-400"><HardDrive size={24} /></div>
            <span className="text-xs font-medium text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded">Online</span>
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">{isConnected ? 'Active' : 'Offline'}</h3>
          <p className="text-sm text-slate-400">System Status</p>
        </div>

        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-500/20 rounded-lg text-purple-400"><Cpu size={24} /></div>
            <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded">Model</span>
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">Gemini Pro</h3>
          <p className="text-sm text-slate-400">Active Model</p>
        </div>
      </div>

      <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-8 text-center">
        <div className="inline-block p-4 rounded-full bg-slate-800 mb-4 text-slate-400">
          <BarChart3 size={48} />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">Analytics Coming Soon</h3>
        <p className="text-slate-400 max-w-md mx-auto">
          Detailed document analytics and usage insights will be available in a future update.
        </p>
      </div>
    </div>
  );

  const SettingsView = () => (
    <div className="flex-1 overflow-y-auto p-6 bg-[#0f172a] text-slate-200">
      <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>
      <div className="max-w-2xl space-y-6">
        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-3 mb-6">
            <SettingsIcon className="text-blue-400" />
            <h3 className="text-lg font-medium text-white">General Configuration</h3>
          </div>
        </div>
      </div>
    </div>
  );

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
          onCloseMobile={() => setIsSidebarOpen(false)}
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
