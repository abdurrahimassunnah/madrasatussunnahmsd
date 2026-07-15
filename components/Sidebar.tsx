
import React from 'react';
import { History, Clock, FileText, ChevronRight, X, Trash2, Key } from 'lucide-react';
import { HistoryItem } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelectHistory: (item: HistoryItem) => void;
  onDeleteHistory: (id: string) => void;
  onClearHistory?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, history, onSelectHistory, onDeleteHistory, onClearHistory }) => {
  const [apiKey, setApiKey] = React.useState('');
  const [isSaved, setIsSaved] = React.useState(false);
  const [validationError, setValidationError] = React.useState('');

  React.useEffect(() => {
    const savedKey = localStorage.getItem('GEMINI_API_KEY');
    if (savedKey) {
      const trimmed = savedKey.trim();
      setApiKey(trimmed);
      setIsSaved(true);
      setValidationError('');
    }
  }, []);

  const handleSaveKey = () => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      if (!trimmed.startsWith('AIzaSy') && !trimmed.startsWith('AQ.')) {
        setValidationError("জেমিনি এপিআই কী সাধারণত 'AIzaSy' অথবা 'AQ.' দিয়ে শুরু হতে হবে।");
        return;
      }
      localStorage.setItem('GEMINI_API_KEY', trimmed);
      setIsSaved(true);
      setValidationError('');
      window.dispatchEvent(new Event('storage'));
    }
  };

  const handleDeleteKey = () => {
    localStorage.removeItem('GEMINI_API_KEY');
    setApiKey('');
    setIsSaved(false);
    setValidationError('');
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-50 z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col h-full shadow-xl lg:shadow-none`}>
        
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-gray-800">
            <History className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-lg">পূর্ববর্তী কাজ</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {history.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">কোনো পূর্ববর্তী রেকর্ড নেই</p>
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => {
                    onSelectHistory(item);
                    if (window.innerWidth < 1024) onClose();
                  }}
                  className="w-full text-left bg-white hover:bg-emerald-50 border border-gray-100 hover:border-emerald-200 rounded-lg p-3 transition-all shadow-sm hover:shadow-md pr-10"
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex-shrink-0">
                      {item.gradeLevel}
                    </span>
                    <span className="text-[10px] text-gray-400 text-right whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleDateString('bn-BD')} • {new Date(item.timestamp).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-gray-800 line-clamp-2 mb-1 leading-snug">
                    {item.previewText}
                  </h4>
                  <div className="flex items-center text-xs text-gray-500 mt-2">
                    <Clock className="w-3 h-3 mr-1" />
                    {item.duration} দিনের পরিকল্পনা
                    <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500" />
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteHistory(item.id);
                  }}
                  className="absolute top-2 right-2 p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                  title="মুছে ফেলুন"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
          
          {history.length > 0 && onClearHistory && (
            <div className="pt-2 flex justify-center">
              <button
                onClick={onClearHistory}
                className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                <Trash2 className="w-4 h-4" />
                <span>সব ইতিহাস মুছে ফেলুন</span>
              </button>
            </div>
          )}
        </div>
        
        {/* Gemini API Key Settings Panel */}
        <div className="p-4 border-t border-gray-100 bg-emerald-50/30">
          <div className="flex items-center space-x-2 text-gray-800 mb-2">
            <Key className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-xs text-gray-700">জেমিনি এপিআই সেটিংস</span>
          </div>
          
          <div className="space-y-2">
            <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
              নেটলিফাই বা স্ট্যাটিক হোস্টিং-এ রান করতে এখানে আপনার জেমিনি এপিআই কী সেট করুন। এটি আপনার ব্রাউজারে সুরক্ষিত থাকবে।
            </p>
            
            <div className="flex gap-2">
              <input
                type={isSaved ? "password" : "text"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setIsSaved(false);
                }}
                placeholder="AIzaSy..."
                className="flex-1 px-2.5 py-1.5 text-[11px] bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono shadow-inner text-gray-700"
              />
              {isSaved ? (
                <button
                  onClick={handleDeleteKey}
                  className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg text-xs font-bold transition-all shadow-sm"
                  title="মুছে ফেলুন"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleSaveKey}
                  disabled={!apiKey.trim()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                >
                  সংরক্ষণ
                </button>
              )}
            </div>
            {isSaved && (
              <div className="flex items-center space-x-1 text-[9px] text-emerald-600 font-bold">
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                <span>সফলভাবে সংরক্ষিত হয়েছে!</span>
              </div>
            )}
            {validationError && (
              <div className="text-[10px] text-rose-600 font-medium leading-normal mt-1 bg-rose-50 p-2 rounded-md border border-rose-100">
                {validationError}
              </div>
            )}
          </div>
        </div>

        <div className="p-3 border-t border-gray-100 bg-gray-50 text-center">
          <p className="text-[10px] text-gray-400">কাজসমূহ আপনার ব্রাউজারে সুরক্ষিত সংরক্ষিত থাকে</p>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
