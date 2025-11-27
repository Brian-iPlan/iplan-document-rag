import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import Toast from './components/Toast';
import type { DocumentItem, ChatMessage, ViewMode } from './types';
import { INITIAL_DOCUMENTS } from './constants';
import { sendMessageToGemini, uploadDocument, getDocuments, deleteDocument } from './services/geminiService';
import { BarChart3, Database, HardDrive, Cpu, Settings as SettingsIcon, AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>(INITIAL_DOCUMENTS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Navigation & UI State
  const [activeView, setActiveView] = useState<ViewMode>('documents');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Fetch documents on mount
  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const docs = await getDocuments();
        setDocuments(docs);
        setIsConnected(true);
      } catch (err) {
        // Backend failure
        console.error("Backend Connection Error:", err);
        setIsConnected(false);
        // Do not show toast on initial load failure to avoid annoyance, just visual indicator in sidebar
      }
    };
    fetchDocs();
  }, []);

  const handleUpload = () => {
    // Create a hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,.txt,.md,.csv';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Optimistic UI update
        const tempId = Date.now().toString();
        const optimisticDoc: DocumentItem = {
          id: tempId,
          name: file.name,
          type: (file.name.split('.').pop() as any) || 'other',
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: 'indexing'
        };
        
        setDocuments(prev => [optimisticDoc, ...prev]);

        try {
          const uploadedDoc = await uploadDocument(file);
          // Replace optimistic doc with returned doc
          setDocuments(prev => prev.map(d => d.id === tempId ? uploadedDoc : d));
          setToast({ message: "Document uploaded successfully", type: 'success' });
          setIsConnected(true);
        } catch (error: any) {
          // Set error state
          setDocuments(prev => prev.map(d => 
            d.id === tempId ? { ...d, status: 'error' } : d
          ));
          console.error("Upload failed", error);
          
          let errorMsg = "Upload failed. Is the Docker backend running at http://localhost:8000?";
          setToast({ message: errorMsg, type: 'error' });
        }
      }
    };
    
    input.click();
  };

  const handleDeleteDocument = async (id: string) => {
    // Optimistic delete
    const prevDocs = documents;
    setDocuments(prev => prev.filter(d => d.id !== id));
    
    try {
        await deleteDocument(id);
        setToast({ message: "Document deleted successfully", type: 'success' });
    } catch (error) {
        // Revert on failure
        setDocuments(prevDocs);
        console.error("Delete failed", error);
        setToast({ message: "Failed to delete document. Check backend.", type: 'error' });
    }
  };

  const handleSendMessage = async (text: string) => {
    // Add user message immediately
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: new Date()
    };
    
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Call Backend API
      const responseText = await sendMessageToGemini(text, updatedMessages);
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMsg]);
      setIsConnected(true);
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `<b>Connection Error:</b> Could not reach the AI service.<br/><br/>1. Is the Docker container running?<br/>2. Is it accessible at <a href="http://localhost:8000" target="_blank" class="text-blue-400 underline">http://localhost:8000</a>?`,
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

  // Placeholder components for other views
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
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">API Endpoint</label>
              <input 
                type="text" 
                value="http://localhost:8000" 
                disabled 
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2.5 text-slate-300 focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-500 mt-2">The docker container address (readonly)</p>
            </div>
            
            <div className="pt-4 border-t border-slate-700">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="w-10 h-6 bg-blue-600 rounded-full relative transition-colors">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                </div>
                <span className="text-slate-300 group-hover:text-white transition-colors">Dark Mode</span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-3 mb-4 text-amber-400">
            <AlertTriangle />
            <h3 className="text-lg font-medium">Data Management</h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Clearing local data will remove your chat history. Documents in the database are not affected.
          </p>
          <button 
            onClick={handleClearHistory}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-lg transition-colors text-sm font-medium"
          >
            Clear Chat History
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0f172a]">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Responsive Wrapper */}
      <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar 
          documents={documents} 
          onUpload={handleUpload} 
          isConnected={isConnected}
          activeView={activeView}
          onViewChange={(view) => {
            setActiveView(view);
            setIsSidebarOpen(false);
          }}
          onCloseMobile={() => setIsSidebarOpen(false)}
          onDelete={handleDeleteDocument}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
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
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
};

export default App;