
import { Upload, Calendar, Layers, AlertCircle, X, FileType, Loader2, Sparkles, ChevronRight, PenTool, Hash, Clock, Database, Trash2, Check, BookOpen, FileText, ClipboardList, RefreshCw, Copy } from 'lucide-react';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GradeLevel, LessonPlanRequest } from '../types';
import FilePreview from './FilePreview';
import { saveStoredFile, getAllStoredFiles, deleteStoredFile, clearAllStoredFiles, StoredFile, getSampleLessonPlan, saveSampleLessonPlan, deleteSampleLessonPlan } from '../services/dbService';
import { DEFAULT_SAMPLE_LESSON_PLAN } from '../constants/defaultSamplePlan';


const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 1200; // Optimal size for legibility and payload weight
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // Convert to quality 0.75 jpeg
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const loadPdfJs = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    script.onerror = (err) => {
      console.error("Failed to load PDF.js from CDN", err);
      reject(new Error("পিডিএফ রিডার লোড করা যায়নি। অনুগ্রহ করে ইন্টারনেট সংযোগ পরীক্ষা করুন।"));
    };
    document.head.appendChild(script);
  });
};

const extractTextFromPdf = async (
  file: File, 
  ranges: { start: number | string; end: number | string }[]
): Promise<string> => {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  const numPages = pdf.numPages;
  
  for (const range of ranges) {
    const sPage = parseInt(String(range.start), 10) || 1;
    const ePage = parseInt(String(range.end), 10) || numPages;
    
    // Calculate exact bounds
    const start = Math.max(1, Math.min(sPage, numPages));
    const end = Math.max(start, Math.min(ePage, numPages));
    
    for (let i = start; i <= end; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n';
    }
  }
  
  return fullText;
};

interface LessonFormProps {
  onSubmit: (request: LessonPlanRequest) => void;
  isLoading: boolean;
  progress: number;
  statusMessage: string;
}

const dataURLtoFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || '';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

const LessonForm: React.FC<LessonFormProps> = ({ onSubmit, isLoading, progress, statusMessage }) => {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number>(5);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [pageRanges, setPageRanges] = useState<{ id: string; start: number | string; end: number | string }[]>([
    { id: 'default', start: 1, end: 10 }
  ]);
  // Defaulting to Grade 5 (পঞ্চম শ্রেণি) as requested
  const [grade, setGrade] = useState<GradeLevel>(GradeLevel.Grade5);
  const [context, setContext] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReadingPdf, setIsReadingPdf] = useState<boolean>(false);

  // Stored file states
  const [savedFiles, setSavedFiles] = useState<StoredFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [fileBase64Data, setFileBase64Data] = useState<string | null>(null);
  const [fileExtractedText, setFileExtractedText] = useState<string | null>(null);
  
  // Sample lesson plan states
  const [sampleText, setSampleText] = useState<string>(DEFAULT_SAMPLE_LESSON_PLAN);
  const [sampleFileName, setSampleFileName] = useState<string | null>(null);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [isSampleDragging, setIsSampleDragging] = useState<boolean>(false);
  const [isReadingSample, setIsReadingSample] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sampleFileInputRef = useRef<HTMLInputElement>(null);

  const loadSavedFiles = useCallback(async () => {
    try {
      const files = await getAllStoredFiles();
      setSavedFiles(files);
    } catch (err) {
      console.error("Error loading saved files:", err);
    }
  }, []);

  const loadSamplePlan = useCallback(async () => {
    try {
      const storedSample = await getSampleLessonPlan();
      if (storedSample) {
        setSampleText(storedSample.text);
        setSampleFileName(storedSample.fileName || "uploaded_sample.txt");
        if (storedSample.data) {
          try {
            const reconstructed = dataURLtoFile(storedSample.data, storedSample.fileName || "uploaded_sample.txt");
            setSampleFile(reconstructed);
          } catch (reconstErr) {
            console.error("Error reconstructing sample file:", reconstErr);
            const dummy = new File([storedSample.text], storedSample.fileName || "uploaded_sample.txt", { type: storedSample.type || "text/plain" });
            setSampleFile(dummy);
          }
        } else {
          const dummy = new File([storedSample.text], storedSample.fileName || "uploaded_sample.txt", { type: "text/plain" });
          setSampleFile(dummy);
        }
      } else {
        setSampleText(DEFAULT_SAMPLE_LESSON_PLAN);
        setSampleFileName(null);
        setSampleFile(null);
      }
    } catch (err) {
      console.error("Error loading sample lesson plan:", err);
    }
  }, []);

  useEffect(() => {
    loadSavedFiles();
    loadSamplePlan();
  }, [loadSavedFiles, loadSamplePlan]);

  const handleFileChange = async (selectedFile: File) => {
    setError(null);
    if (selectedFile.type === 'application/pdf' && selectedFile.size > 200 * 1024 * 1024) {
      setError("পিডিএফ ফাইলটি অনেক বড় (২০০ মেগাবাইটের বেশি)। অনুগ্রহ করে ২০০ মেগাবাইটের কম সাইজের পিডিএফ ব্যবহার করুন।");
      return;
    }

    try {
      setIsReadingPdf(true);
      let dataUrl = '';
      let extracted = '';

      if (selectedFile.type.startsWith('image/')) {
        dataUrl = await compressImage(selectedFile);
      } else {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(selectedFile);
        });
      }

      if (selectedFile.type === 'application/pdf') {
        try {
          extracted = await extractTextFromPdf(selectedFile, pageRanges);
        } catch (pdfErr) {
          console.warn("PDF extraction skipped or failed on initial load", pdfErr);
        }
      }

      const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await saveStoredFile({
        id: fileId,
        name: selectedFile.name,
        type: selectedFile.type,
        size: selectedFile.size,
        data: dataUrl,
        extractedText: extracted
      });

      setFile(selectedFile);
      setActiveFileId(fileId);
      setFileBase64Data(dataUrl);
      setFileExtractedText(extracted);
      
      loadSavedFiles();
    } catch (err: any) {
      console.error("Error processing/saving file:", err);
      setError("ফাইল প্রসেস ও ব্রাউজারে সংরক্ষণ করতে সমস্যা হয়েছে।");
    } finally {
      setIsReadingPdf(false);
    }
  };

  const handleSelectSavedFile = async (stored: StoredFile) => {
    try {
      const reconstructedFile = dataURLtoFile(stored.data, stored.name);
      setFile(reconstructedFile);
      setActiveFileId(stored.id);
      setFileBase64Data(stored.data);
      setFileExtractedText(stored.extractedText || '');
    } catch (err) {
      console.error("Error selecting saved file:", err);
      setError("সংরক্ষিত ফাইলটি লোড করতে সমস্যা হয়েছে।");
    }
  };

  const handleDeleteSavedFile = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteStoredFile(id);
      if (activeFileId === id) {
        setFile(null);
        setActiveFileId(null);
        setFileBase64Data(null);
        setFileExtractedText(null);
      }
      loadSavedFiles();
    } catch (err) {
      console.error("Error deleting saved file:", err);
      setError("সংরক্ষিত ফাইলটি মুছে ফেলা যায়নি।");
    }
  };

  const handleSampleFileChange = async (selectedFile: File) => {
    setError(null);
    setIsReadingSample(true);
    try {
      let text = '';
      let dataUrl = '';

      // Get base64 data URL
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(selectedFile);
      });

      if (selectedFile.type === 'application/pdf') {
        text = await extractTextFromPdf(selectedFile, 1, 15); // extract first 15 pages of sample
      } else if (selectedFile.type === 'text/plain') {
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsText(selectedFile);
        });
      } else if (selectedFile.type.startsWith('image/')) {
        text = `[নমুনা ছবি আপলোড করা হয়েছে: ${selectedFile.name}]`;
      } else {
        // Fallback text read
        try {
          text = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (err) => reject(err);
            reader.readAsText(selectedFile);
          });
        } catch (e) {
          text = `[নমুনা ফাইল আপলোড করা হয়েছে: ${selectedFile.name}]`;
        }
      }

      await saveSampleLessonPlan(text, selectedFile.name, selectedFile.type, selectedFile.size, dataUrl);
      setSampleText(text);
      setSampleFileName(selectedFile.name);
      setSampleFile(selectedFile);
    } catch (err: any) {
      console.error("Error reading sample file:", err);
      setError("নমুনা ফাইলটি লোড করতে সমস্যা হয়েছে।");
    } finally {
      setIsReadingSample(false);
    }
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file && !context.trim()) {
      setError("ফাইল আপলোড করুন অথবা সিলেবাস দিন।");
      return;
    }

    let fileData: string | null = fileBase64Data;
    let mimeType = file ? file.type : '';
    let extractedText = fileExtractedText || '';

    if (file) {
      if (file.type === 'application/pdf' && file.size > 200 * 1024 * 1024) {
        setError("পিডিএফ ফাইলটি অনেক বড় (২০০ মেগাবাইটের বেশি)। অনুগ্রহ করে ২০০ মেগাবাইটের কম সাইজের পিডিএফ ব্যবহার করুন।");
        return;
      }

      try {
        if (file.type === 'application/pdf') {
          setIsReadingPdf(true);
          try {
            extractedText = await extractTextFromPdf(file, pageRanges);
            mimeType = 'application/pdf';

            if (!extractedText || extractedText.trim().length < 20) {
              if (file.size > 3.5 * 1024 * 1024) {
                setError("এটি একটি স্ক্যান করা পিডিএফ (ছবি দিয়ে তৈরি) এবং এর সাইজ অনেক বড়। স্ক্যান করা বড় পিডিএফ ফাইল থেকে সিলেবাস পড়া সম্ভব হচ্ছে না। অনুগ্রহ করে সিলেবাসের মূল অংশটি কপি করে সরাসরি নিচের 'অতিরিক্ত নির্দেশাবলী' বক্সে দিন অথবা ছোট পিডিএফ/ছবি আপলোড করুন।");
                return;
              } else if (!fileData) {
                fileData = await new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = (err) => reject(err);
                  reader.readAsDataURL(file);
                });
              }
            }
          } catch (pdfErr: any) {
            console.error("PDF extraction error:", pdfErr);
            setError(pdfErr.message || "পিডিএফ ফাইলটি পড়া যায়নি। অনুগ্রহ করে সঠিক পিডিএফ আপলোড করুন।");
            return;
          } finally {
            setIsReadingPdf(false);
          }
        } else if (!fileData) {
          if (file.type.startsWith('image/')) {
            fileData = await compressImage(file);
            mimeType = 'image/jpeg';
          } else {
            fileData = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = (err) => reject(err);
              reader.readAsDataURL(file);
            });
            mimeType = file.type;
          }
        }
      } catch (err) {
        console.error("Error compressing/reading file:", err);
        setError("ফাইল প্রসেস করতে ত্রুটি হয়েছে। অনুগ্রহ করে অন্য ফাইল ব্যবহার করুন বা ম্যানুয়ালি লিখুন।");
        return;
      }
    }

    if (activeFileId && file && fileData) {
      saveStoredFile({
        id: activeFileId,
        name: file.name,
        type: file.type,
        size: file.size,
        data: fileData,
        extractedText: extractedText
      }).catch(err => console.error("Error updating cache in IndexedDB:", err));
    }

    onSubmit({
      file,
      fileId: activeFileId || undefined,
      fileData,
      mimeType,
      extractedText,
      duration,
      startDate,
      startPage: pageRanges[0]?.start || 1,
      endPage: pageRanges[0]?.end || 10,
      pageRanges: pageRanges.map(r => ({ start: r.start, end: r.end })),
      gradeLevel: grade,
      additionalContext: context,
      holidays: '',
      weeks: 1, // legacy support
      sampleLessonPlan: sampleText
    });
  }, [file, activeFileId, fileBase64Data, fileExtractedText, duration, startDate, pageRanges, grade, context, sampleText, onSubmit]);

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 p-8 md:p-12 transition-all relative overflow-hidden max-w-2xl mx-auto">
      <div className="transition-all duration-500">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center space-x-2 bg-emerald-50 text-emerald-700 px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest mb-5 border border-emerald-100/50">
            <Sparkles className="w-3.5 h-3.5" />
            <span>স্মার্ট শিক্ষা সহায়ক</span>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">নতুন রুটিন তৈরি করুন</h2>
          <p className="text-[15px] text-slate-500 mt-2 font-medium">প্রয়োজনীয় তথ্য দিয়ে আপনার পাঠ পরিকল্পনা তৈরি করুন</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center text-rose-800 text-sm font-bold animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 text-rose-500" />
              {error}
            </div>
          )}

          {/* Upload Section */}
          <div 
            onClick={() => !isLoading && !isReadingPdf && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if(!isLoading && !isReadingPdf) setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if(!isLoading && e.dataTransfer.files[0]) handleFileChange(e.dataTransfer.files[0]); }}
            className={`relative group border-2 border-dashed rounded-[2rem] p-10 transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
              isDragging ? 'border-emerald-500 bg-emerald-50 scale-[1.01]' : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/5'
            }`}
          >
            {!file ? (
              <>
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                  <Upload className="w-7 h-7" />
                </div>
                <h4 className="text-[17px] font-black text-slate-900 mb-1">সিলেবাস ফাইল আপলোড করুন</h4>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">PDF বা ইমেজ ড্র্যাগ করুন</p>
                <p className="text-[11px] text-slate-400">সর্বোচ্চ ২০০ মেগাবাইট (বড় পিডিএফ ফাইলের তথ্য ক্লায়েন্ট-সাইডে অত্যন্ত দ্রুত গতিতে বের করা হবে)</p>
              </>
            ) : (
              <div className="flex items-center space-x-5 w-full bg-white p-5 rounded-2xl shadow-sm border border-emerald-100">
                <div className="w-14 h-14 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-200/50">
                  <FileType className="w-7 h-7 text-white" />
                </div>
                <div className="text-left flex-grow overflow-hidden">
                  <p className="text-sm font-black truncate text-slate-900">{file.name}</p>
                  <FilePreview file={file} />
                </div>
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); setFile(null); setActiveFileId(null); setFileBase64Data(null); setFileExtractedText(null); }} 
                  className="p-2.5 hover:bg-rose-50 rounded-full text-slate-300 hover:text-rose-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => e.target.files && handleFileChange(e.target.files[0])} accept=".pdf,image/*" />
          </div>

          {/* Stored Files Browser Library */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-[2rem] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 gap-2 text-slate-800">
                <Database className="w-5 h-5 text-emerald-600" />
                <h4 className="text-sm font-black text-slate-800">পূর্বে আপলোড করা ফাইলসমূহ (লাইব্রেরি)</h4>
              </div>
              {savedFiles.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm("আপনি কি নিশ্চিতভাবে লাইব্রেরির সমস্ত ফাইল মুছে ফেলতে চান?")) {
                      await clearAllStoredFiles();
                      setFile(null);
                      setActiveFileId(null);
                      setFileBase64Data(null);
                      setFileExtractedText(null);
                      loadSavedFiles();
                    }
                  }}
                  className="text-xs font-black text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>সব মুছে ফেলুন</span>
                </button>
              )}
            </div>

            {savedFiles.length === 0 ? (
              <p className="text-xs font-bold text-slate-400 text-center py-4">
                কোনো ফাইল সংরক্ষিত নেই। নতুন ফাইল আপলোড করলে তা স্বয়ংক্রিয়ভাবে ব্রাউজার লাইব্রেরিতে যুক্ত হবে।
              </p>
            ) : (
              <div className="max-h-[180px] overflow-y-auto space-y-2.5 pr-1.5">
                {savedFiles.map((stored) => {
                  const isActive = activeFileId === stored.id;
                  const formattedSize = typeof stored.size === 'number' ? (stored.size / (1024 * 1024)).toFixed(2) + " MB" : "0.00 MB";
                  const formattedDate = stored.timestamp 
                    ? `${new Date(stored.timestamp).toLocaleDateString('bn-BD')} • ${new Date(stored.timestamp).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', hour12: true })}`
                    : "অজানা তারিখ";
                  
                  return (
                    <div
                      key={stored.id}
                      onClick={() => handleSelectSavedFile(stored)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isActive
                          ? 'bg-emerald-50/70 border-emerald-500 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3 gap-2.5 overflow-hidden">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <FileType className="w-4.5 h-4.5" />
                        </div>
                        <div className="text-left overflow-hidden">
                          <p className={`text-xs font-black truncate ${isActive ? 'text-emerald-900' : 'text-slate-800'}`}>
                            {stored.name}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400">
                            {formattedSize} • {formattedDate}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isActive ? (
                          <span className="bg-emerald-600 text-white px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5">
                            <Check className="w-3 h-3" />
                            <span>সক্রিয়</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 group-hover:text-emerald-600 text-[11px] font-black hover:underline">
                            সিলেক্ট
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleDeleteSavedFile(stored.id, e)}
                          className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-300 hover:text-rose-600 transition-colors"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sample Lesson Plan Upload Section */}
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1 flex items-center justify-between">
              <span className="flex items-center">
                <ClipboardList className="w-3.5 h-3.5 mr-2 text-emerald-500" /> নমুনা পাঠ পরিকল্পনা (ঐচ্ছিক)
              </span>
              <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider transition-all duration-300 ${
                sampleFile 
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200/50" 
                  : "bg-slate-100 text-slate-500 border border-slate-200/50"
              }`}>
                {sampleFile ? "কাস্টম নমুনা সক্রিয়" : "ডিফল্ট স্থায়ী নমুনা সক্রিয়"}
              </span>
            </label>

            <div 
              onClick={() => !isLoading && !isReadingSample && sampleFileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); if(!isLoading && !isReadingSample) setIsSampleDragging(true); }}
              onDragLeave={() => setIsSampleDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsSampleDragging(false); if(!isLoading && e.dataTransfer.files[0]) handleSampleFileChange(e.dataTransfer.files[0]); }}
              className={`relative group border-2 border-dashed rounded-[2rem] p-8 transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                isSampleDragging ? 'border-emerald-500 bg-emerald-50 scale-[1.01]' : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/5'
              }`}
            >
              {isReadingSample ? (
                <div className="flex flex-col items-center justify-center py-4 space-y-3">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                  <p className="text-xs text-emerald-700 font-black">নমুনা ফাইল প্রসেস করা হচ্ছে...</p>
                </div>
              ) : !sampleFile ? (
                <>
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                    <ClipboardList className="w-6 h-6 text-slate-400 group-hover:text-white" />
                  </div>
                  <h4 className="text-[15px] font-black text-slate-800 mb-1">এখানে নমুনা পাঠ পরিকল্পনা আপলোড করুন</h4>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">PDF, TXT বা ইমেজ ড্র্যাগ করুন</p>
                  <p className="text-[10px] text-slate-400 max-w-sm">এআই এই নমুনার গঠন (Format), ভাষা শৈলী ও সমন্বয় কঠোরভাবে অনুসরণ করে নতুন রুটিন তৈরি করবে</p>
                </>
              ) : (
                <div className="flex items-center space-x-5 w-full bg-white p-4 rounded-2xl shadow-sm border border-emerald-100">
                  <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-200/50">
                    <FileType className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left flex-grow overflow-hidden">
                    <p className="text-xs font-black truncate text-slate-900">{sampleFile.name}</p>
                    <p className="text-[10px] font-bold text-slate-400">
                      {(sampleFile.size / 1024).toFixed(1)} KB • {sampleFile.type || "text/plain"}
                    </p>
                  </div>
                  <button 
                    type="button" 
                    onClick={async (e) => { 
                      e.stopPropagation(); 
                      if (window.confirm("আপনি কি আপলোড করা নমুনা ফাইলটি ডিলিট করতে চান? ডিলিট করলে এটি ডিফল্ট নমুনায় ফিরে যাবে।")) {
                        await deleteSampleLessonPlan();
                        setSampleFile(null);
                        setSampleFileName(null);
                        setSampleText(DEFAULT_SAMPLE_LESSON_PLAN);
                      }
                    }} 
                    className="p-2 hover:bg-rose-50 rounded-full text-slate-400 hover:text-rose-600 transition-colors"
                    title="মুছে ফেলুন ও ডিফল্ট নমুনায় ফিরুন"
                  >
                    <Trash2 className="w-4.5 h-4.5 text-rose-500" />
                  </button>
                </div>
              )}
              <input 
                ref={sampleFileInputRef} 
                type="file" 
                className="hidden" 
                onChange={(e) => e.target.files && handleSampleFileChange(e.target.files[0])} 
                accept=".pdf,.txt,image/*" 
              />
            </div>
          </div>

          {/* Primary Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1 flex items-center">
                <Layers className="w-3.5 h-3.5 mr-2 text-emerald-500" /> শ্রেণি
              </label>
              <select 
                value={grade} 
                onChange={(e) => setGrade(e.target.value as GradeLevel)} 
                className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-[15px] font-bold text-slate-800 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer shadow-sm"
              >
                {Object.values(GradeLevel).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="space-y-2.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1 flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-2 text-emerald-500" /> শুরুর তারিখ
              </label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-[15px] font-bold text-slate-800 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer shadow-sm" 
              />
            </div>
          </div>

          {/* Duration Selector */}
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1 flex items-center">
              <Clock className="w-3.5 h-3.5 mr-2 text-emerald-500" /> রুটিনের ব্যাপ্তি (দিন)
            </label>
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 5].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`py-3 rounded-2xl text-sm font-black transition-all border-2 ${
                    duration === d 
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200' 
                      : 'bg-white border-slate-100 text-slate-500 hover:border-emerald-200'
                  }`}
                >
                  {d} দিন
                </button>
              ))}
            </div>
          </div>

          {/* Page Ranges Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.15em] ml-1 flex items-center">
                <Hash className="w-3.5 h-3.5 mr-2 text-emerald-600" /> পৃষ্ঠা সীমা (Page Ranges)
              </label>
              <button
                type="button"
                onClick={() => {
                  const newId = `range_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
                  setPageRanges([...pageRanges, { id: newId, start: '', end: '' }]);
                }}
                className="inline-flex items-center space-x-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border border-emerald-200/50 hover:scale-[1.02]"
              >
                <span>+ পৃষ্ঠা রেঞ্জ যোগ করুন</span>
              </button>
            </div>

            <div className="space-y-3">
              {pageRanges.map((range, index) => (
                <div key={range.id} className="flex items-center gap-4 bg-emerald-50/20 border border-emerald-100/30 p-4 rounded-2xl animate-in fade-in-50 zoom-in-95 duration-200">
                  <div className="text-xs font-black text-emerald-700 w-16">
                    রেঞ্জ #{index + 1}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 flex-grow">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400">শুরুর পৃষ্ঠা</span>
                      <input 
                        type="number" 
                        value={range.start} 
                        placeholder="১"
                        onChange={(e) => {
                          const updated = [...pageRanges];
                          updated[index].start = e.target.value;
                          setPageRanges(updated);
                        }} 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-black text-emerald-950 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400">শেষ পৃষ্ঠা</span>
                      <input 
                        type="number" 
                        value={range.end} 
                        placeholder="১০"
                        onChange={(e) => {
                          const updated = [...pageRanges];
                          updated[index].end = e.target.value;
                          setPageRanges(updated);
                        }} 
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-black text-emerald-950 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  {pageRanges.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPageRanges(pageRanges.filter(r => r.id !== range.id));
                      }}
                      className="p-2 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-600 transition-colors self-end"
                      title="রেঞ্জটি মুছে ফেলুন"
                    >
                      <Trash2 className="w-4.5 h-4.5 text-rose-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Additional Context */}
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1 flex items-center">
              <PenTool className="w-3.5 h-3.5 mr-2 text-emerald-500" /> অতিরিক্ত নির্দেশাবলী
            </label>
            <textarea 
              value={context} onChange={(e) => setContext(e.target.value)} 
              className="w-full bg-white border border-slate-200 rounded-[2rem] px-7 py-6 text-[15px] font-medium text-slate-700 min-h-[140px] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all resize-none leading-relaxed placeholder:text-gray-300 shadow-sm"
              placeholder="পড়া, মুখস্থ করা বা লেখার বিশেষ নির্দেশাবলী এখানে দিন..."
            />
          </div>

          {/* Submit Button */}
          <button 
            type="submit" disabled={isLoading || isReadingPdf}
            className={`w-full py-6 rounded-[1.75rem] text-white font-black text-xl shadow-2xl transition-all transform active:scale-[0.97] flex flex-col items-center justify-center relative overflow-hidden group ${
              isLoading || isReadingPdf ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-200'
            }`}
          >
            {isLoading || isReadingPdf ? (
              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center space-x-3">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                  <span className="tracking-tight">
                    {isReadingPdf ? 'সিলেবাস পড়া হচ্ছে...' : 'রুটিন জেনারেট হচ্ছে...'}
                  </span>
                </div>
              </div>
            ) : (
              <span className="flex items-center tracking-tight">
                পাঠ পরিকল্পনা তৈরি করুন
                <ChevronRight className="w-6 h-6 ml-2 group-hover:translate-x-1.5 transition-transform" />
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LessonForm;
