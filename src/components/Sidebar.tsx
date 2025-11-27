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
  clientId: string;
  onClientIdChange: (id: string) => void;
}

const AppLogo = () => ( <div className="w-8 h-8 rounded-lg"><svg viewBox='0 0 24 24'><path d='M...'/></svg></div> );

const Sidebar: React.FC<SidebarProps> = ({ 
  documents, 
  onUpload, 
  isConnected, 
  activeView, 
  onViewChange,
  onCloseMobile,
  onDelete,
  clientId,
  onClientIdChange
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'processing'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Preview State
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewContent, setPreviewContent] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-emerald-400';
      case 'indexing': return 'text-amber-400';
      case 'error': return 'text-rose-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <div className="w-2 h-2 rounded-full bg-emerald-400" />;
      case 'indexing': return <Loader2 size={12} className="animate-spin text-amber-400" />;
      case 'error': return <AlertCircle size={12} className="text-rose-400" />;
      default: return null;
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="text-rose-500" size={20} />;
      case 'docx': return <FileText className="text-blue-500" size={20} />;
      default: return <File className="text-slate-400" size={20} />;
    }
  };

  const handleDocClick = async (doc: DocumentItem) => {
    setPreviewDoc(doc);
    setLoadingPreview(true);
    try {
        const content = await getDocumentContent(doc.id);
        setPreviewContent(content);
    } catch (e) { setPreviewContent("Failed to load content."); }
    finally { setLoadingPreview(false); }
  };

  const filteredDocs = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (filter === 'all' || doc.status === filter)
  );

  const NavButton = ({ view, icon: Icon }: { view: ViewMode, icon: any }) => (
    <button onClick={() => onViewChange(view)} className={`p-2 rounded-lg ${activeView === view ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><Icon size={20} /></button>
  );

  return (
    <div className="flex h-full bg-[#1e293b] border-r border-slate-800">
      <div className="w-16 flex flex-col items-center py-4 gap-4 bg-[#0f172a]">
        <AppLogo />
        <NavButton view="documents" icon={Database} />
        <NavButton view="dashboard" icon={LayoutDashboard} />
        <NavButton view="settings" icon={Settings} />
        <div className="flex-1"></div>
        <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      </div>
      <div className="flex-1 flex flex-col w-80">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-lg font-bold text-white">iPlan Document RAG</h1>
          <div className="mt-4">
            <label htmlFor="clientId" className="text-xs font-medium text-slate-400">Client ID</label>
            <input 
              type="text" 
              id="clientId"
              value={clientId}
              onChange={(e) => onClientIdChange(e.target.value)}
              className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-md px-3 py-2 text-white text-sm" 
              placeholder="Enter Client ID..."
            />
          </div>
          <button onClick={onUpload} className="w-full mt-4 py-2 px-4 rounded-md bg-blue-600 text-white font-semibold">Upload Document</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filteredDocs.map((doc) => (
            <div key={doc.id} onClick={() => handleDocClick(doc)} className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-800 cursor-pointer">
              {getFileIcon(doc.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{doc.name}</p>
                <p className="text-xs text-slate-400">{doc.date}</p>
              </div>
              <div className="flex items-center gap-1.5">{getStatusIcon(doc.status)}{doc.status}</div>
              {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}><Trash2 size={14} className='text-rose-500'/></button>}
            </div>
          ))}
        </div>
      </div>
      {previewDoc && ( <div className="fixed inset-0"><div onClick={() => setPreviewDoc(null)}></div><div>...</div></div> )}
    </div>
  );
};

export default Sidebar;