import React, { useRef, useEffect, useState } from 'react';
import { Send, Paperclip, MoreVertical, History, Bot, Loader2, Sparkles, Menu, Trash2, Download } from 'lucide-react';
import type { ChatMessage } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onToggleSidebar: () => void;
  onClearHistory: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  isLoading, 
  onSendMessage, 
  onToggleSidebar,
  onClearHistory 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    onSendMessage(inputValue);
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const adjustTextareaHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0f172a] relative h-full">
      {/* Header */}
      <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
            <button 
                onClick={onToggleSidebar}
                className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
                <Menu size={20} />
            </button>
            <h2 className="text-lg font-semibold text-white">AI Assistant</h2>
        </div>

        <div className="flex items-center gap-2 relative">
          <button 
            onClick={onClearHistory}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="Clear Chat History"
          >
            <History size={20} />
          </button>
          
          <div className="relative">
            <button 
                onClick={() => setShowOptions(!showOptions)}
                className={`p-2 rounded-lg transition-colors ${showOptions ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
                <MoreVertical size={20} />
            </button>
            
            {showOptions && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#1e293b] border border-slate-700 rounded-xl shadow-xl overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-100">
                    <button 
                        onClick={() => { setShowOptions(false); onClearHistory(); }}
                        className="w-full text-left px-4 py-3 text-sm text-rose-400 hover:bg-slate-800 flex items-center gap-2"
                    >
                        <Trash2 size={16} />
                        Clear Conversation
                    </button>
                    <button 
                        className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 flex items-center gap-2 border-t border-slate-700/50"
                    >
                        <Download size={16} />
                        Export Chat
                    </button>
                </div>
            )}
          </div>
          {/* Backdrop for dropdown */}
          {showOptions && <div className="fixed inset-0 z-10" onClick={() => setShowOptions(false)} />}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-6 custom-scrollbar relative">
        {messages.length === 0 ? (
          // Welcome / Empty State
          <div className="h-full flex flex-col items-center justify-center -mt-10">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center mb-6 shadow-lg shadow-blue-900/10">
              <Bot className="text-blue-400 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome!</h2>
            <p className="text-slate-400 text-center max-w-md mb-10">
              Upload a document and ask me anything. I can help you analyse, summarise, and extract information.
            </p>
          </div>
        ) : (
          // Message List
          <div className="w-full max-w-4xl mx-auto space-y-6 pb-4">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'model' && (
                   <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex-shrink-0 flex items-center justify-center mt-1">
                     <Sparkles className="w-4 h-4 text-blue-400" />
                   </div>
                )}
                
                <div 
                  className={`relative max-w-[85%] px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                  } ${msg.isError ? 'border-red-500/50 bg-red-900/10' : ''}`}
                >
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  ) : (
                    /* Allow HTML rendering for model responses (images, tables) */
                    <div 
                      className="chat-content prose prose-invert max-w-none break-words prose-p:mb-4 [&>img]:rounded-lg [&>img]:max-w-full [&>img]:shadow-lg"
                      dangerouslySetInnerHTML={{ __html: msg.text }} 
                    />
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-slate-700 flex-shrink-0 flex items-center justify-center mt-1">
                    <UserIcon />
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-4 justify-start">
                 <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex-shrink-0 flex items-center justify-center mt-1">
                   <Bot className="w-4 h-4 text-blue-400" />
                 </div>
                 <div className="bg-slate-800 px-5 py-4 rounded-2xl rounded-tl-none border border-slate-700 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                    <span className="text-slate-400 text-sm">Thinking...</span>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 sm:p-6 bg-[#0f172a]">
        <div className="max-w-3xl mx-auto relative group">
          <textarea 
            ref={textareaRef}
            rows={1}
            value={inputValue}
            onChange={adjustTextareaHeight}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="w-full bg-[#1e293b] border border-slate-700 text-slate-200 rounded-xl pl-4 pr-24 py-4 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all resize-none overflow-hidden min-h-[56px] max-h-[200px]"
          />
          
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Attach file">
              <Paperclip size={18} />
            </button>
            <button 
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className={`p-2 rounded-lg transition-all ${
                inputValue.trim() && !isLoading 
                  ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20' 
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-slate-500 mt-3">
          AI can make mistakes. Please verify important information.
        </p>
      </div>
    </div>
  );
};

const UserIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#475569"/>
    <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" fill="#CBD5E1"/>
    <path d="M12 13C7.58172 13 4 16.5817 4 21H20C20 16.5817 16.4183 13 12 13Z" fill="#CBD5E1"/>
  </svg>
);

export default ChatInterface;