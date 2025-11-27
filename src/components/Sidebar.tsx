import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  Settings, 
  User, 
  Upload, 
  Search, 
  FileText, 
  FileCode, 
  AlertCircle, 
  File,
  X,
  Loader2,
  Trash2
} from 'lucide-react';
import type { DocumentItem, ViewMode } from '../types';
import { getDocumentContent } from '../services/geminiService';

interface SidebarProps {
  documents: DocumentItem[];
  onUpload: () => void;
  isConnected: boolean;
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onCloseMobile?: () => void;
  onDelete?: (id: string) => void;
}

const AppLogo = () => (
  <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 mb-2 relative group">
    <img 
      src="/logo.png" 
      alt="Logo" 
      className="w-full h-full object-cover"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
        e.currentTarget.nextElementSibling?.classList.remove('hidden');
      }} 
    />
    <div className="hidden w-full h-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 absolute inset-0">
       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
    </div>
  </div>
);

const Sidebar: React.FC<SidebarProps> = ({ 
  documents, 
  onUpload, 
  isConnected, 
  activeView, 
  onViewChange,
  onCloseMobile,
  onDelete
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'processing'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Preview State
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewContent, setPreviewContent] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'indexing': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'error': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />;
      case 'indexing': return <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />;
      case 'error': return <AlertCircle size={12} className="text-rose-400" />;
      default: return null;
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="text-rose-500" size={24} />;
      case 'docx': return <FileText className="text-blue-500" size={24} />;
      case 'md': return <FileCode className="text-slate-300" size={24} />;
      default: return <File className="text-slate-400" size={24} />;
    }
  };

  const handleDocClick = async (doc: DocumentItem) => {
    setPreviewDoc(doc);
    setLoadingPreview(true);
    setPreviewContent('');
    
    try {
        const content = await getDocumentContent(doc.id);
        setPreviewContent(content);
    } catch (e) {
        setPreviewContent("Failed to load document content.");
    } finally {
        setLoadingPreview(false);
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = 
      filter === 'all' ? true : 
      filter === 'active' ? doc.status === 'active' :
      filter === 'processing' ? doc.status === 'indexing' : true;
    return matchesSearch && matchesFilter;
  });

  const NavButton = ({ view, icon: Icon }: { view: ViewMode, icon: any }) => (
    <button 
      onClick={() => {
        onViewChange(view);
        if (window.innerWidth < 768 && onCloseMobile) onCloseMobile();
      }}
      className={`p-2 rounded-lg transition-colors ${
        activeView === view 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon size={20} />
    </button>
  );

  return (
    <div className="flex h-full bg-[#1e293b] border-r border-slate-700/50">
      {/* Navigation Rail */}
      <div className="w-16 flex flex-col items-center py-6 gap-6 bg-[#0f172a] border-r border-slate-800 shrink-0 z-20">
        <AppLogo />
        
        <NavButton view="dashboard" icon={LayoutDashboard} />
        <NavButton view="documents" icon={Database} />
        <NavButton view="settings" icon={Settings} />
        
        <div className="flex-1"></div>
        
        <div className="relative group">
          <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors mb-2">
            <User size={20} />
          </button>
          {/* Connection Status Indicator */}
          <div 
            className={`absolute bottom-3 right-1 w-2.5 h-2.5 rounded-full border-2 border-[#0f172a] ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} 
          />
          <div className="absolute left-full ml-2 bottom-2 bg-slate-800 text-slate-200 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50 border border-slate-700">
            {isConnected ? 'Connected to Backend' : 'Offline / Check Connection'}
          </div>
        </div>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 flex flex-col w-[280px] sm:w-[300px]">
        {/* Mobile Header (Close Button) */}
        <div className="md:hidden flex justify-end p-2">
            <button onClick={onCloseMobile} className="p-2 text-slate-400 hover:text-white">
                <X size={20} />
            </button>
        </div>

        <div className="p-6 pb-2 pt-2 md:pt-6">
          <h1 className="text-xl font-bold text-white mb-1">iPlan Document RAG</h1>
          <p className="text-xs text-slate-400 mb-6">Manage and upload your documents</p>

          <button 
            onClick={onUpload}
            className="w-full font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors mb-6 shadow-lg bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20"
          >
            <Upload size={18} />
            <span>Upload Document</span>
          </button>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search documents..."
              className="w-full bg-[#0f172a] border border-slate-700 text-slate-200 text-sm rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex bg-[#0f172a] p-1 rounded-lg mb-2">
            {(['all', 'active', 'processing'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  filter === t 
                    ? 'bg-slate-700 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar">
          {filteredDocs.map((doc) => (
            <div 
              key={doc.id}
              onClick={() => handleDocClick(doc)}
              className="group flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-700/50 cursor-pointer relative"
            >
              <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 group-hover:bg-slate-700/50 transition-colors">
                {getFileIcon(doc.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-slate-200 truncate">{doc.name}</h3>
                <p className="text-xs text-slate-500">{doc.date}</p>
              </div>
              <div className={`px-2 py-1 rounded-full text-[10px] font-medium border flex items-center gap-1.5 ${getStatusColor(doc.status)}`}>
                {getStatusIcon(doc.status)}
                {doc.status === 'active' ? 'Active' : doc.status === 'indexing' ? 'Indexing...' : 'Error'}
              </div>
              
              {/* Delete Button - Appears on hover */}
              {onDelete && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if(confirm('Are you sure you want to delete this document?')) {
                            onDelete(doc.id);
                        }
                    }}
                    className="absolute right-2 opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-slate-700 rounded-lg shadow-lg border border-slate-700 transition-all z-10"
                    title="Delete document"
                >
                    <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          
          {filteredDocs.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-sm">
              No documents found
            </div>
          )}
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPreviewDoc(null)}>
            <div 
                className="bg-[#0f172a] border border-slate-700 w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-[#1e293b]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-800 border border-slate-700">
                            {getFileIcon(previewDoc.type)}
                        </div>
                        <div>
                            <h3 className="font-medium text-slate-100">{previewDoc.name}</h3>
                            <p className="text-xs text-slate-400">{previewDoc.date} • {previewDoc.status}</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setPreviewDoc(null)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#0f172a] custom-scrollbar">
                    {loadingPreview ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-3">
                            <Loader2 className="animate-spin text-blue-500" size={24} />
                            <p className="text-sm text-slate-400">Loading document content...</p>
                        </div>
                    ) : (
                        <div className="prose prose-invert max-w-none">
                            <pre className="whitespace-pre-wrap font-mono text-sm text-slate-300 leading-relaxed bg-[#1e293b] p-4 rounded-lg border border-slate-800">
                                {previewContent}
                            </pre>
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-[#1e293b] flex justify-end gap-2">
                     <button 
                        onClick={() => setPreviewDoc(null)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-700"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;