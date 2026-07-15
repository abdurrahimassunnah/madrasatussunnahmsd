
import React, { useState, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LessonForm from './components/LessonForm';
import PlanDisplay from './components/PlanDisplay';
import { LessonPlanRequest, GenerationState, HistoryItem } from './types';
import { generateLessonPlanStream, regenerateDayContent } from './services/geminiService';

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentRequest, setCurrentRequest] = useState<LessonPlanRequest | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<GenerationState>({
    isLoading: false,
    progress: 0,
    statusMessage: '',
    error: null,
    result: null,
  });

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('lessonPlanHistory');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to read history from localStorage", e);
    }
  }, []);

  useEffect(() => {
    try {
      // Create a clean list with NO fileData or raw File objects to prevent QuotaExceededError
      const cleanHistory = history.map(item => {
        if (item.requestContext) {
          return {
            ...item,
            requestContext: {
              ...item.requestContext,
              file: null,
              fileData: null, // Clear huge base64 data to save localStorage space
            }
          };
        }
        return item;
      });
      localStorage.setItem('lessonPlanHistory', JSON.stringify(cleanHistory));
    } catch (e) {
      console.error("Failed to save history to localStorage due to quota limits", e);
      // Fallback: keep only the 5 most recent history items and strip all text data
      try {
        const smallHistory = history.slice(0, 5).map(item => ({
          ...item,
          requestContext: item.requestContext ? {
            ...item.requestContext,
            file: null,
            fileData: null,
            extractedText: undefined
          } : undefined
        }));
        localStorage.setItem('lessonPlanHistory', JSON.stringify(smallHistory));
      } catch (innerE) {
        console.error("Failed to save even small history", innerE);
        try {
          localStorage.removeItem('lessonPlanHistory');
        } catch (_) {}
      }
    }
  }, [history]);

  useEffect(() => {
    if (state.result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.result]);

  const handleGenerationRequest = async (request: LessonPlanRequest) => {
    setCurrentRequest(request);
    setState({ 
      isLoading: true, 
      progress: 0, 
      statusMessage: 'প্রস্তুতি চলছে...', 
      error: null, 
      result: null 
    });
    
    try {
      const plan = await generateLessonPlanStream(request, (progress, message) => {
        setState(prev => ({ ...prev, progress, statusMessage: message }));
      });
      
      const newItem: HistoryItem = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
        timestamp: Date.now(),
        gradeLevel: request.gradeLevel,
        duration: request.duration,
        previewText: request.additionalContext.substring(0, 50) || `পরিকল্পনা - ${request.gradeLevel} (${request.duration} দিন)`,
        fullContent: plan,
        requestContext: request
      };

      setHistory(prev => [newItem, ...prev].slice(0, 100));
      
      setState({
        isLoading: false,
        progress: 100,
        statusMessage: 'সম্পন্ন!',
        error: null,
        result: plan,
      });
    } catch (error: any) {
      setState({
        isLoading: false,
        progress: 0,
        statusMessage: '',
        error: error.message || "একটি ত্রুটি ঘটেছে",
        result: null,
      });
    }
  };

  const handleDayRegenerate = async (date: string, previousContent: string) => {
    if (!currentRequest) throw new Error("No active request context found.");
    return await regenerateDayContent(currentRequest, date, previousContent);
  };

  const handleReset = () => {
    setState({ isLoading: false, progress: 0, statusMessage: '', error: null, result: null });
    setCurrentRequest(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleHistorySelect = (item: HistoryItem) => {
    if (item.requestContext) {
      setCurrentRequest(item.requestContext);
    } else {
      setCurrentRequest({
        file: null,
        fileData: null,
        mimeType: '',
        duration: item.duration,
        startDate: new Date(item.timestamp).toISOString().split('T')[0],
        startPage: 60,
        endPage: 68,
        gradeLevel: item.gradeLevel,
        additionalContext: item.previewText,
        holidays: '',
        weeks: 1
      });
    }
    setState({
      isLoading: false,
      progress: 100,
      statusMessage: '',
      error: null,
      result: item.fullContent
    });
  };

  const handleDeleteHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleClearHistory = () => {
    if (window.confirm("আপনি কি নিশ্চিতভাবে সমস্ত ইতিহাস মুছে ফেলতে চান?")) {
      setHistory([]);
    }
  };

  return (
    <div className="flex h-screen bg-[#fcfdfd] font-sans overflow-hidden">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        history={history}
        onSelectHistory={handleHistorySelect}
        onDeleteHistory={handleDeleteHistory}
        onClearHistory={handleClearHistory}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden w-full transition-all duration-300 z-10">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className="max-w-7xl mx-auto px-4 py-12 md:px-6 lg:px-10 flex flex-col min-h-full">
            
            <div className={`transition-all duration-700 ${state.result ? 'opacity-50 scale-95 origin-top blur-[1px]' : 'opacity-100 scale-100'}`}>
              <div className="text-center mb-16 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <h2 className="text-5xl font-black text-gray-900 sm:text-6xl mb-6 tracking-tight leading-[1.1]">
                  মাদরাসাতুস সুন্নাহর স্মার্ট <br/>
                  <span className="text-emerald-600">এআই পাঠ পরিকল্পনা</span>
                </h2>
                <p className="text-xl text-gray-500 font-medium max-w-lg mx-auto">
                  আপনার বিশ্বস্ত এআই সহায়ক।
                </p>
              </div>
              
              <div className="w-full max-w-3xl mx-auto animate-in zoom-in-95 duration-700 delay-200">
                <LessonForm 
                  onSubmit={handleGenerationRequest} 
                  isLoading={state.isLoading} 
                  progress={state.progress}
                  statusMessage={state.statusMessage}
                />
                
                {state.error && (
                  <div className="mt-10 rounded-[2rem] bg-rose-50/50 p-6 md:p-8 border border-rose-100 shadow-xl shadow-rose-900/5 max-w-2xl mx-auto">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 bg-rose-100 p-2 rounded-xl">
                        <svg className="h-6 w-6 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      </div>
                      <div className="ml-4 flex-1">
                        <h3 className="text-base font-black text-rose-900 uppercase tracking-wider">ত্রুটি সনাক্ত হয়েছে</h3>
                        <p className="mt-1 text-[14px] font-medium text-rose-700/90 leading-relaxed whitespace-pre-line">{state.error}</p>
                        
                        {(state.error.includes("GEMINI_API_KEY") || state.error.includes("জেমিনি") || state.error.includes("এপিআই") || state.error.includes("API Key") || state.error.includes("api key")) && (
                          <div className="mt-6 bg-white p-5 rounded-2xl border border-rose-100 shadow-inner space-y-4">
                            <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                              <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                              </svg>
                              এখানে সরাসরি এপিআই কী (API Key) বসান:
                            </h4>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                placeholder="এখানে আপনার জেমিনি এপিআই কী (যেমন: AIzaSy... বা AQ...) দিন"
                                id="error-api-key-input"
                                className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono shadow-inner"
                              />
                              <button
                                onClick={async () => {
                                  const input = document.getElementById("error-api-key-input") as HTMLInputElement;
                                  if (input && input.value.trim()) {
                                    localStorage.setItem("GEMINI_API_KEY", input.value.trim());
                                    setState(prev => ({ ...prev, error: null }));
                                    if (currentRequest) {
                                      handleGenerationRequest(currentRequest);
                                    }
                                  }
                                }}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black transition-all shadow-md hover:shadow-emerald-600/20 shadow-emerald-600/10 active:scale-95 animate-pulse"
                              >
                                সংরক্ষণ ও পুনরায় চেষ্টা করুন
                              </button>
                            </div>
                            
                            <div className="pt-2 border-t border-gray-100">
                              <details className="group cursor-pointer">
                                <summary className="text-[11px] font-black text-emerald-700 uppercase tracking-wider flex items-center justify-between">
                                  <span>নেটলিফাই সাইটে এপিআই কী সেট করার নিয়ম দেখুন:</span>
                                  <span className="transition-transform group-open:rotate-180">▼</span>
                                </summary>
                                <ol className="mt-3 text-xs text-gray-600 space-y-2 list-decimal list-inside leading-relaxed bg-emerald-50/50 p-4 rounded-xl">
                                  <li>আপনার <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold underline">Google AI Studio</a> একাউন্ট থেকে একটি ফ্রি API Key তৈরি করুন।</li>
                                  <li>আপনার <strong>Netlify Dashboard</strong> এ যান ও আপনার সাইটটি নির্বাচন করুন।</li>
                                  <li><strong>Site Settings</strong> &gt; <strong>Environment variables</strong> এ প্রবেশ করুন।</li>
                                  <li><strong>Add a variable</strong> এ ক্লিক করে <code>GEMINI_API_KEY</code> নামে ভ্যারিয়েবল তৈরি করুন এবং জেমিনি থেকে পাওয়া এপিআই কী (Value) হিসেবে বসিয়ে সেভ করুন।</li>
                                  <li>সাইটটি পুনরায় ডিপ্লয় (Redeploy) করুন। ব্যাস, কাজ শেষ!</li>
                                </ol>
                              </details>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {state.result && (
              <div ref={resultRef} className="mt-20 mb-20 w-full max-w-5xl mx-auto scroll-mt-10 space-y-6">
                <div className="mb-8 flex items-center justify-between">
                   <div className="h-px bg-slate-200 flex-grow mr-6"></div>
                   <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em] flex-shrink-0">নিচে ফলাফল দেখুন</span>
                   <div className="h-px bg-slate-200 flex-grow ml-6"></div>
                </div>
                <PlanDisplay 
                  content={state.result} 
                  onReset={handleReset} 
                  onRegenerateDay={handleDayRegenerate}
                />

                {/* Delete and Credit Panel Below the Result */}
                <div className="bg-[#fcfdfd] rounded-3xl border border-slate-100 p-6 shadow-xl shadow-slate-900/5 flex flex-col sm:flex-row items-center justify-between gap-6 max-w-3xl mx-auto transition-all duration-300 hover:shadow-2xl hover:border-slate-200/80">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-black text-slate-800">ফলাফল মুছে ফেলুন</h4>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ডায়েরি ও কুইজ সম্পূর্ণ খালি করতে এখানে ক্লিক করুন</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                    <button
                      onClick={() => {
                        if (window.confirm("আপনি কি নিশ্চিতভাবে এই সম্পূর্ণ ডায়েরি ও জেনারেটকৃত ফলাফল মুছে ফেলতে চান?")) {
                          handleReset();
                        }
                      }}
                      className="w-full sm:w-auto px-6 py-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-2xl text-xs font-black transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>ডিলিট করুন</span>
                    </button>
                    
                    <div className="text-center sm:text-right border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-4">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">তৈরি করেছেন:</span>
                      <p className="text-xs font-black text-emerald-700 whitespace-nowrap bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        আব্দুর রহিম দ্বারা ডিজাইন ও ডেভেলপকৃত
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <footer className="mt-auto py-12 text-center border-t border-gray-100/50 space-y-2">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">© {new Date().getFullYear()} মাদরাসাতুস সুন্নাহ এআই</p>
              <p className="text-xs font-black text-slate-500 bg-slate-100/50 inline-block px-4 py-1.5 rounded-full border border-slate-200/30">
                আব্দুর রহিম দ্বারা ডিজাইন ও ডেভেলপকৃত
              </p>
            </footer>
          </div>
        </main>
      </div>

      <style>{`
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-short { animation: bounce-short 2s infinite; }
      `}</style>
    </div>
  );
};

export default App;
