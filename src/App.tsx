import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import Toast from './components/Toast';
import type { DocumentItem, ChatMessage, ViewMode } from './types';
import { sendMessageToGemini, uploadDocument, getDocuments, deleteDocument } from './services/geminiService';
import { API_BASE_URL } from './config';
import { BarChart3, Database, HardDrive, Cpu, Settings as SettingsIcon, AlertTriangle, X, Users, Info } from 'lucide-react';

const App: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [clientId, setClientId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'processing'>('all');

  const [activeView, setActiveView] = useState<ViewMode>('documents');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [showCostExampleModal, setShowCostExampleModal] = useState(false);
  const [costExampleContent, setCostExampleContent] = useState('');

  const fetchDocuments = useCallback(async () => {
    try {
      const docs = await getDocuments();
      setDocuments(docs);
      setIsConnected(true);
    } catch (err) {
      console.error("Backend Connection Error:", err);
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = useCallback(async () => {
    if (!clientId) {
      setToast({ message: "Please enter a Client ID before uploading.", type: 'error' });
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,.txt,.md,.csv';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const newName = `${clientId}_${file.name}`;
        try {
          await uploadDocument(file, clientId, newName);
          setToast({ message: "Document uploaded successfully", type: 'success' });
          fetchDocuments(); // Fetch the ground truth
        } catch (error: any) {
          console.error("Upload failed", error);
          setIsConnected(false);
          setToast({ message: "Upload failed. Is the backend running?", type: 'error' });
        }
      }
    };
    
    input.click();
  }, [clientId, fetchDocuments]);

  const handleDeleteDocument = async (id: string) => {
    const docToDelete = documents.find(d => d.id === id);
    if (!docToDelete) return;

    if (docToDelete.status === 'error') {
      setDocuments(prev => prev.filter(d => d.id !== id));
      setToast({ message: "Removed errored upload entry.", type: 'success' });
      return;
    }
    
    try {
        await deleteDocument(id);
        setToast({ message: "Document deleted successfully", type: 'success' });
        fetchDocuments(); // Re-fetch documents to guarantee UI sync
    } catch (error) {
        console.error("Delete failed", error);
        setIsConnected(false);
        setToast({ message: "Failed to delete document from server.", type: 'error' });
        fetchDocuments(); // Even on failure, sync with the server state
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!clientId) {
      setToast({ message: "Please enter a Client ID in the field above to start a chat", type: 'error' });
      return;
    }
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

  const handleShowCostExample = async () => {
    try {
      const response = await fetch('/cost_example.txt');
      const text = await response.text();
      setCostExampleContent(text);
      setShowCostExampleModal(true);
    } catch (error) {
      console.error("Failed to fetch cost example:", error);
      setToast({ message: "Could not load cost example.", type: 'error' });
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesClient = !clientId || doc.clientId === clientId;
    const matchesSearch = !searchQuery || doc.name.toLowerCase().startsWith(searchQuery.toLowerCase());
    const matchesFilter = 
      filter === 'all' ? true : 
      filter === 'active' ? doc.status === 'active' :
      filter === 'processing' ? doc.status === 'indexing' : true;
    return matchesClient && matchesSearch && matchesFilter;
  });

  const DashboardView = () => {
    const activeDocs = documents.filter(d => d.status === 'active');
    const uniqueClientIds = [...new Set(documents.map(doc => doc.clientId))].filter(Boolean);

    return (
      <div className="flex-1 overflow-y-auto p-6 bg-[#0f172a] text-slate-200">
        <h2 className="text-2xl font-bold text-white mb-6">Dashboard Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-700">
            <div className="flex justify-between items-start mb-2">
              <div className="p-3 bg-blue-600/20 rounded-lg text-blue-400"><Database size={24} /></div>
              <button onClick={() => setShowDocsModal(true)} className="text-xs font-medium text-blue-400 hover:underline">View All</button>
            </div>
            <h3 className="text-3xl font-bold text-white mb-1">{activeDocs.length}</h3>
            <p className="text-sm text-slate-400">Active Documents</p>
          </div>
          <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-700">
            <div className="flex justify-between items-start mb-2">
              <div className="p-3 bg-green-600/20 rounded-lg text-green-400"><Users size={24} /></div>
              <button onClick={() => setShowClientsModal(true)} className="text-xs font-medium text-blue-400 hover:underline">View</button>
            </div>
            <h3 className="text-3xl font-bold text-white mb-1">{uniqueClientIds.length}</h3>
            <p className="text-sm text-slate-400">Client IDs</p>
          </div>
          <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-700">
            <div className="flex justify-between items-start mb-2">
              <div className="p-3 bg-purple-500/20 rounded-lg text-purple-400"><Cpu size={24} /></div>
              <div className="flex flex-col items-end gap-1">
                <button onClick={() => setShowCostModal(true)} className="text-xs font-medium text-blue-400 hover:underline">Cost Info</button>
                <button onClick={handleShowCostExample} className="text-xs font-medium text-blue-400 hover:underline">Example</button>
              </div>
            </div>
            <h3 className="text-3xl font-bold text-white mb-1">Gemini Pro</h3>
            <p className="text-sm text-slate-400">Active Model</p>
          </div>
        </div>
        <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-8 text-center">
          <div className="inline-block p-4 rounded-full bg-slate-800 mb-4 text-slate-400"><BarChart3 size={48} /></div>
          <h3 className="text-lg font-medium text-white mb-2">Analytics Coming Soon</h3>
          <p className="text-slate-400 max-w-md mx-auto">Detailed document analytics and usage insights will be available in a future update.</p>
        </div>
      </div>
    );
  };

  const SettingsView = () => (
    <div className="flex-1 overflow-y-auto p-6 bg-[#0f172a] text-slate-200">
      <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>
      <div className="max-w-2xl space-y-6">
        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-3 mb-6"><SettingsIcon className="text-blue-400" /><h3 className="text-lg font-medium text-white">General Configuration</h3></div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">AI Service Endpoint</label>
              <input 
                type="text" 
                value={API_BASE_URL}
                readOnly
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2.5 text-slate-300 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Active AI Model</label>
              <input 
                type="text" 
                value="models/gemini-pro-latest"
                readOnly
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2.5 text-slate-300 focus:outline-none"
              />
            </div>
          </div>
        </div>
        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-700">
            <div className="flex items-center gap-3 mb-4 text-amber-400"><AlertTriangle /><h3 className="text-lg font-medium">Data Management</h3></div>
            <p className="text-sm text-slate-400 mb-4">Clearing local data will remove your chat history. Documents in the database are not affected.</p>
            <button onClick={handleClearHistory} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-lg transition-colors text-sm font-medium">Clear Chat History</button>
        </div>
      </div>
    </div>
  );

  const Modal = ({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div 
            className="bg-[#1e293b] border border-slate-700 w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" 
            onClick={e => e.stopPropagation()}
        >
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <h3 className="font-semibold text-lg text-slate-100">{title}</h3>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 text-slate-300 space-y-2 custom-scrollbar">
              {children}
            </div>
        </div>
    </div>
  );

  const ClientIDsModal = ({ documents, onClose, onSelect }: { documents: DocumentItem[], onClose: () => void, onSelect: (clientId: string) => void }) => {
    const uniqueClientIds = [...new Set(documents.map(doc => doc.clientId))].filter(Boolean);
    return (
      <Modal title={`Select a Client ID (${uniqueClientIds.length})`} onClose={onClose}>
        {uniqueClientIds.length > 0 ? (
          uniqueClientIds.map(id => 
            <button key={id} onClick={() => onSelect(id!)} className="w-full text-left p-3 bg-slate-800/50 border border-slate-700/50 rounded-md text-sm hover:bg-slate-700/50 transition-colors">{id}</button>
          )
        ) : (
          <p>No Client IDs found. Upload a document to get started.</p>
        )}
      </Modal>
    );
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0f172a]">
      {isSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      <div className={`fixed inset-y-0 left-0 z-50 w-full sm:w-auto transform transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar 
          documents={filteredDocuments}
          onUpload={handleUpload} 
          isConnected={isConnected}
          activeView={activeView}
          onViewChange={setActiveView}
          onCloseMobile={() => setIsSidebarOpen(false)}
          onDelete={handleDeleteDocument}
          clientId={clientId}
          onClientIdChange={setClientId}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          filter={filter}
          onFilterChange={setFilter}
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
      {showDocsModal && <Modal title={`Active Documents (${documents.filter(d => d.status === 'active').length})`} onClose={() => setShowDocsModal(false)}>{documents.filter(d=>d.status === 'active').map(doc=><div key={doc.id} className="p-2 bg-slate-800 rounded-md">{doc.name}</div>)}</Modal>}
      {showClientsModal && <ClientIDsModal documents={documents} onClose={() => setShowClientsModal(false)} onSelect={(id) => { setClientId(id); setShowClientsModal(false); }}/>}
      {showCostModal && 
        <Modal title="Cost & Service Information" onClose={() => setShowCostModal(false)}>
          <div className="prose prose-invert max-w-none prose-sm">
            <p>This application utilizes several services that may incur costs based on usage.</p>
            <h4>Core Services:</h4>
            <ul>
              <li><strong>Google Gemini API:</strong> Used for all AI-powered chat and analysis. Costs are based on the amount of text sent and received (tokens) for each query.</li>
              <li><strong>Vercel:</strong> Hosts the frontend user interface.</li>
              <li><strong>Render:</strong> Hosts the backend server.</li>
            </ul>
            <p>This application is currently configured to use the free tiers of Vercel and Render. For detailed and up-to-date pricing for the AI model, please refer to the official Google Cloud pricing page.</p>
            <a href="https://cloud.google.com/vertex-ai/generative-ai/pricing" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">View Google AI Pricing</a>
          </div>
        </Modal>
      }
      {showCostExampleModal && 
        <Modal title="Example Cost Calculation" onClose={() => setShowCostExampleModal(false)}>
          <pre className="whitespace-pre-wrap font-mono text-sm text-slate-300 leading-relaxed">
            {costExampleContent}
          </pre>
        </Modal>
      }
    </div>
  );
};

export default App;
