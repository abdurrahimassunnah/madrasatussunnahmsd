import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { 
  Copy, Check, Printer, BookCheck, RefreshCw, RotateCcw, Loader2, 
  BookOpen, Calendar, Map, CheckCircle2, Circle, PlayCircle, 
  ChevronLeft, ChevronRight, Edit2, Palette, Save, HelpCircle, FileText, PenTool, FileSpreadsheet
} from 'lucide-react';
import { generateQuiz } from '../services/geminiService';
import { QuizResponse } from '../types';

interface PlanDisplayProps {
  content: string;
  onReset: () => void;
  onRegenerateDay?: (date: string, previousContent: string) => Promise<{ cw: string, hw: string }>;
}

interface RoutineDay {
  date: string;
  cw: string;
  hw: string;
  index: number;
}

interface DayCustomization {
  status: 'planned' | 'current' | 'completed';
  color: 'emerald' | 'blue' | 'amber' | 'rose';
  teacherNotes: string;
  cwChecked: boolean;
  hwChecked: boolean;
}

const PlanDisplay: React.FC<PlanDisplayProps> = ({ content, onReset, onRegenerateDay }) => {
  const [copied, setCopied] = useState(false);
  const [editableContent, setEditableContent] = useState(content);
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
  
  // Tabs: 'table' (রুটিন টেবিল), 'diary' (শ্রেণি ডায়েরি), 'map' (ইন্টারেক্টিভ রোডম্যাপ), 'quiz' (কুইজ জেনারেটর)
  const [activeTab, setActiveTab] = useState<'table' | 'diary' | 'map' | 'quiz'>('table');
  
  // Diary current page selection
  const [currentDiaryPage, setCurrentDiaryPage] = useState(0);
  
  // Customizations for each date
  const [customizations, setCustomizations] = useState<Record<string, DayCustomization>>({});
  
  // Editing state for day content (C.W and H.W)
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editCw, setEditCw] = useState('');
  const [editHw, setEditHw] = useState('');

  // Quiz Generator States
  const [quizDay, setQuizDay] = useState<string>('all');
  const [quizCount, setQuizCount] = useState<number>(5);
  const [quizType, setQuizType] = useState<'mcq' | 'short' | 'true_false' | 'mix' | 'essay'>('mcq');
  const [quizDifficulty, setQuizDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [quizInstructions, setQuizInstructions] = useState<string>('');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState<boolean>(false);
  const [quizResult, setQuizResult] = useState<QuizResponse | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState<Record<number, boolean>>({});
  const [showAllAnswers, setShowAllAnswers] = useState<boolean>(false);
  const [quizClassSubject, setQuizClassSubject] = useState<string>('মাদরাসা কুইজ');
  const [copiedQuiz, setCopiedQuiz] = useState<boolean>(false);
  const [copiedExcel, setCopiedExcel] = useState<boolean>(false);
  const [includeAnswersInPrint, setIncludeAnswersInPrint] = useState<boolean>(false);

  // Load customizations on mount
  useEffect(() => {
    const saved = localStorage.getItem('madrasah_map_customizations');
    if (saved) {
      try {
        setCustomizations(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load map customizations", e);
      }
    }
  }, []);

  const cleanMarkdown = (text: string): string => {
    if (!text) return '';
    
    let cleaned = text.trim();
    
    // Remove triple backticks wrapping markdown table if any (e.g. ```markdown ... ``` or ``` ... ```)
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/gm, '');
    cleaned = cleaned.replace(/```$/gm, '');
    cleaned = cleaned.trim();
    
    // Ensure there is a newline before any table start to help GFM parse it correctly
    if (cleaned.startsWith('|')) {
      cleaned = '\n' + cleaned;
    } else {
      // If there is preamble text before the table, ensure we have double newlines before the table starts
      cleaned = cleaned.replace(/([^\n])(\n*)\|/g, '$1\n\n|');
    }
    
    return cleaned;
  };

  const isEnglishText = (text: string): boolean => {
    if (!text) return false;
    const englishMatches = text.match(/[a-zA-Z]/g) || [];
    const bengaliMatches = text.match(/[\u0980-\u09FF]/g) || [];
    return englishMatches.length > bengaliMatches.length;
  };

  const toBengaliNumber = (num: number | string): string => {
    const englishToBengaliMap: Record<string, string> = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
    };
    return String(num).replace(/[0-9]/g, (char) => englishToBengaliMap[char] || char);
  };

  const parseQuizOption = (opt: string, index: number) => {
    if (!opt) return { prefix: '', text: '' };
    
    const trimmed = opt.trim();
    
    // Try to match Bengali prefix: ক, খ, গ, ঘ followed by dot, hyphen, closing paren, colon, or space
    const bengaliMatch = trimmed.match(/^([কখগঘ]|[কখগঘা-ী]*)\s*[\.\-\)\s:]\s*(.*)$/);
    if (bengaliMatch && ['ক', 'খ', 'গ', 'ঘ'].includes(bengaliMatch[1].trim())) {
      return {
        prefix: bengaliMatch[1].trim(),
        text: bengaliMatch[2].trim()
      };
    }
    
    // Try to match English letters A, B, C, D or a, b, c, d
    const englishMatch = trimmed.match(/^([A-Da-d])\s*[\.\-\)\s:]\s*(.*)$/);
    if (englishMatch) {
      return {
        prefix: englishMatch[1].trim().toUpperCase(),
        text: englishMatch[2].trim()
      };
    }

    // Try to match phonetic Ka, Kha, Ga, Gha
    const phoneticMatch = trimmed.match(/^(Ka|Kha|Ga|Gha)\s*[\.\-\)\s:]\s*(.*)$/i);
    if (phoneticMatch) {
      const pMap: Record<string, string> = {
        'ka': 'ক', 'kha': 'খ', 'ga': 'গ', 'gha': 'ঘ',
        'KA': 'ক', 'KHA': 'খ', 'GA': 'গ', 'GHA': 'ঘ',
        'Ka': 'ক', 'Kha': 'খ', 'Ga': 'গ', 'Gha': 'ঘ'
      };
      const key = phoneticMatch[1].toLowerCase();
      return {
        prefix: pMap[key] || phoneticMatch[1],
        text: phoneticMatch[2].trim()
      };
    }

    // Fallback if no prefix is matched
    const fallbackPrefixes = ['ক', 'খ', 'গ', 'ঘ'];
    const fallbackLetters = ['A', 'B', 'C', 'D'];
    const isBengali = /[\u0980-\u09FF]/.test(trimmed);
    const prefix = isBengali ? (fallbackPrefixes[index] || '') : (fallbackLetters[index] || '');
    
    return {
      prefix,
      text: trimmed
    };
  };

  // Update local content when prop content changes
  useEffect(() => {
    setEditableContent(cleanMarkdown(content));
    setCurrentDiaryPage(0); // Reset page selection when content changes to prevent out-of-bounds crashes
  }, [content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(editableContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=800,width=1000');
    if (printWindow) {
        const contentDiv = document.getElementById('printable-content');
        if (contentDiv) {
             printWindow.document.write('<html><head><title>মাদরাসাতুস সুন্নাহ - পাঠ পরিকল্পনা</title>');
             printWindow.document.write('<link href="https://fonts.maateen.me/solaiman-lipi/font.css" rel="stylesheet">');
             printWindow.document.write('<style>');
             printWindow.document.write(`
               body { font-family: "SolaimanLipi", sans-serif; padding: 20px; background: #fff; color: #1e293b; }
               .header { text-align: center; margin-bottom: 20px; }
               .header h1 { color: #047857; margin: 0; font-size: 26px; font-weight: 800; }
               .header p { color: #64748b; font-size: 14px; margin-top: 5px; }
               table { width: 100%; border-collapse: collapse; margin-top: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
               th, td { border: 1.5px solid #cbd5e1; padding: 14px; text-align: center; font-size: 15px; }
               th { background-color: #10b981; color: white; font-weight: 800; }
               td { font-weight: bold; }
               .red-text { color: #dc2626; font-weight: 800; }
               th:last-child, td:last-child { display: none; } /* Hide action column */
               @media print { .no-print { display: none !important; } }
             `);
             printWindow.document.write('</style>');
             printWindow.document.write('</head><body>');
             printWindow.document.write('<div class="header"><h1>মাদরাসাতুস সুন্নাহ - পাঠ পরিকল্পনা ও রুটিন</h1><p>এআই দ্বারা জেনারেটকৃত পাঠ বিবরণী</p></div>');
             printWindow.document.write(contentDiv.innerHTML);
             printWindow.document.write('</body></html>');
             printWindow.document.close();
             printWindow.focus();
             setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
        }
    }
  };

  const isSpecialText = (text: string) => {
    const specials = ['ক্লাস নেই', 'ছুটি', 'শনিবার', 'রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার'];
    return specials.some(s => text.includes(s));
  };

  // Parsing the Markdown Table into structured objects
  const parseTableToDays = (markdown: string): RoutineDay[] => {
    const lines = markdown.split('\n');
    const days: RoutineDay[] = [];
    let idx = 0;
    
    for (const line of lines) {
      if (!line.includes('|')) continue;
      
      const upperLine = line.toUpperCase();
      // Skip separator lines or lines containing header keywords
      if (line.includes('---') || 
          upperLine.includes('DATE') || 
          upperLine.includes('তারিখ') || 
          upperLine.includes('C.W') || 
          upperLine.includes('H.W') ||
          upperLine.includes('শ্রেণির কাজ') ||
          upperLine.includes('বাড়ির কাজ')) {
        continue;
      }
      
      // Split by pipe and filter out empty cells at the start/end if they are just because of leading/trailing pipes
      let parts = line.split('|').map(p => p.trim());
      
      // If there are leading/trailing pipes, the split will have empty strings at index 0 and/or last index
      if (parts[0] === '') {
        parts.shift();
      }
      if (parts[parts.length - 1] === '') {
        parts.pop();
      }
      
      if (parts.length >= 3) {
        const date = parts[0];
        const cw = parts[1];
        const hw = parts[2];
        
        if (date && cw && hw) {
          days.push({ date, cw, hw, index: idx++ });
        }
      }
    }
    return days;
  };

  const parsedDays = parseTableToDays(editableContent);

  // Sync state back to local storage
  const updateCustomization = (date: string, field: keyof DayCustomization, value: any) => {
    const current = customizations[date] || {
      status: 'planned',
      color: 'emerald',
      teacherNotes: '',
      cwChecked: false,
      hwChecked: false
    };
    
    const updated = { ...current, [field]: value };
    const newCustomizations = { ...customizations, [date]: updated };
    setCustomizations(newCustomizations);
    localStorage.setItem('madrasah_map_customizations', JSON.stringify(newCustomizations));
  };

  const handleRegenRow = async (date: string, currentCw: string, currentHw: string) => {
    if (!onRegenerateDay || isRegenerating) return;
    
    setIsRegenerating(date);
    try {
      const { cw, hw } = await onRegenerateDay(date, `CW: ${currentCw}, HW: ${currentHw}`);
      
      const rows = editableContent.split('\n');
      const updatedRows = rows.map(row => {
        if (row.includes(date)) {
          const parts = row.split('|');
          if (parts.length >= 4) {
              parts[2] = ` ${cw} `;
              parts[3] = ` ${hw} `;
              return parts.join('|');
          }
        }
        return row;
      });
      
      setEditableContent(updatedRows.join('\n'));
    } catch (error) {
      console.error("Regeneration failed", error);
    } finally {
      setIsRegenerating(null);
    }
  };

  // Editing logic for C.W / H.W directly in Diary/Map views
  const startEditing = (day: RoutineDay) => {
    setEditingDate(day.date);
    setEditCw(day.cw);
    setEditHw(day.hw);
  };

  const saveEditing = () => {
    if (!editingDate) return;
    
    const rows = editableContent.split('\n');
    const updatedRows = rows.map(row => {
      if (row.includes(editingDate)) {
        const parts = row.split('|');
        if (parts.length >= 4) {
            parts[2] = ` ${editCw} `;
            parts[3] = ` ${editHw} `;
            return parts.join('|');
        }
      }
      return row;
    });
    
    setEditableContent(updatedRows.join('\n'));
    setEditingDate(null);
  };

  // Helper colors for Roadmap Map
  const colorSchemes = {
    emerald: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      badge: 'bg-emerald-600',
      glow: 'shadow-emerald-200',
      darkText: 'text-emerald-900',
      line: 'bg-emerald-300'
    },
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
      badge: 'bg-blue-600',
      glow: 'shadow-blue-200',
      darkText: 'text-blue-900',
      line: 'bg-blue-300'
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      badge: 'bg-amber-600',
      glow: 'shadow-amber-200',
      darkText: 'text-amber-900',
      line: 'bg-amber-300'
    },
    rose: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      text: 'text-rose-700',
      badge: 'bg-rose-600',
      glow: 'shadow-rose-200',
      darkText: 'text-rose-900',
      line: 'bg-rose-300'
    }
  };

  // Auto-guess class name from content
  useEffect(() => {
    if (content) {
      const match = content.match(/(প্রথম|দ্বিতীয়|তৃতীয়|চতুর্থ|পঞ্চম|১ম|২য়|৩য়|৪র্থ|৫ম)\s*শ্রেণি/i);
      if (match) {
        setQuizClassSubject(match[0]);
      } else {
        setQuizClassSubject('মাদরাসা কুইজ');
      }
    }
  }, [content]);

  const handleGenerateQuiz = async () => {
    setIsGeneratingQuiz(true);
    setQuizError(null);
    setQuizResult(null);
    setShowAnswers({});
    setShowAllAnswers(false);

    try {
      // Determine what content to base the quiz on
      let lessonText = '';
      if (quizDay === 'all') {
        lessonText = editableContent;
      } else {
        const found = parsedDays.find(d => d.date === quizDay);
        if (found) {
          lessonText = `তারিখ: ${found.date}\nশ্রেণির কাজ: ${found.cw}\nবাড়ির কাজ: ${found.hw}`;
        } else {
          lessonText = editableContent;
        }
      }

      // Call the API
      const result = await generateQuiz({
        lessonContent: lessonText,
        gradeLevel: quizClassSubject,
        questionCount: quizCount,
        questionType: quizType,
        difficulty: quizDifficulty,
        additionalInstructions: quizInstructions
      });

      if (!result || !result.questions || result.questions.length === 0) {
        throw new Error("কোনো কুইজ তৈরি করা সম্ভব হয়নি। আবার চেষ্টা করুন।");
      }

      setQuizResult(result);
    } catch (err: any) {
      console.error("Error generating quiz:", err);
      setQuizError(err.message || "কুইজ জেনারেট করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const cleanQuestionNumbering = (qText: string) => {
    if (!qText) return '';
    return qText.replace(/^[১২৩৪৫৬৭৮৯০\d]+\s*[\.\-\)\s:]\s*/, '').trim();
  };

  const getGroupedQuestions = () => {
    if (!quizResult) return [];

    const mcqGroup: any[] = [];
    const shortGroup: any[] = [];
    const trueFalseGroup: any[] = [];
    const essayGroup: any[] = [];

    quizResult.questions.forEach((q, idx) => {
      const qWithIdx = { ...q, originalIdx: idx };
      const type = q.type || (
        q.options && q.options.length > 0 ? 'mcq' :
        (q.answer.includes('সত্য') || q.answer.includes('মিথ্যা') || q.question.includes('সত্য') || q.question.includes('মিথ্যা') || q.answer.includes('True') || q.answer.includes('False') || q.question.includes('True') || q.question.includes('False') ? 'true_false' : 
         (q.question.includes('বর্ণনা') || q.question.includes('রচনামূলক') || q.question.includes('বড় প্রশ্ন') || q.question.includes('বিশ্লেষণ') || q.question.includes('ব্যাখ্যা') || q.question.includes('essay') || q.question.includes('describe') || q.question.includes('explain') ? 'essay' : 'short'))
      );

      if (quizType === 'mcq') {
        mcqGroup.push(qWithIdx);
      } else if (quizType === 'short') {
        shortGroup.push(qWithIdx);
      } else if (quizType === 'true_false') {
        trueFalseGroup.push(qWithIdx);
      } else if (quizType === 'essay') {
        essayGroup.push(qWithIdx);
      } else {
        if (type === 'mcq') {
          mcqGroup.push(qWithIdx);
        } else if (type === 'true_false') {
          trueFalseGroup.push(qWithIdx);
        } else if (type === 'essay') {
          essayGroup.push(qWithIdx);
        } else {
          shortGroup.push(qWithIdx);
        }
      }
    });

    const isEng = isEnglishText(editableContent);
    const groups = [];
    if (mcqGroup.length > 0) {
      groups.push({
        type: 'mcq',
        heading: isEng ? 'Choose the correct answer.' : 'সঠিক উত্তরটি নির্বাচন করো।',
        questions: mcqGroup
      });
    }
    if (shortGroup.length > 0) {
      groups.push({
        type: 'short',
        heading: isEng ? 'Answer the short questions.' : 'সংক্ষিপ্ত প্রশ্নের উত্তর দাও।',
        questions: shortGroup
      });
    }
    if (trueFalseGroup.length > 0) {
      groups.push({
        type: 'true_false',
        heading: isEng ? 'Write true or false.' : 'সত্য অথবা মিথ্যা লেখো।',
        questions: trueFalseGroup
      });
    }
    if (essayGroup.length > 0) {
      groups.push({
        type: 'essay',
        heading: isEng ? 'Answer the essay questions.' : 'রচনামূলক প্রশ্নের উত্তর দাও।',
        questions: essayGroup
      });
    }

    return groups;
  };

  const handlePrintQuiz = () => {
    const isPlanEng = isEnglishText(editableContent);
    const isQuizEng = quizResult?.questions.some(q => /[a-zA-Z]/.test(q.question)) || false;
    const maxScore = isQuizEng ? 30 : (quizResult?.questions.length || 0) * 2;
    const displayMaxScore = isPlanEng ? String(maxScore) : toBengaliNumber(maxScore);

    // Create an iframe element dynamically to bypass window.open popup blockers inside iframe sandbox environments
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '0';
    iframe.style.top = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-9999';
    iframe.style.opacity = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc && quizResult) {
      doc.open();
      doc.write('<html><head><title>কুইজ পরীক্ষা - মাদরাসাতুস সুন্নাহ</title>');
      doc.write('<link href="https://fonts.maateen.me/solaiman-lipi/font.css" rel="stylesheet">');
      doc.write('<style>');
      doc.write(`
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          box-sizing: border-box;
        }
        body { 
          font-family: "SolaimanLipi", "Inter", sans-serif; 
          padding: 40px; 
          background: #fff; 
          color: #1e293b; 
        }
        .quiz-header { 
          text-align: center; 
          margin-bottom: 30px; 
          border-bottom: 2px double #cbd5e1; 
          padding-bottom: 20px; 
        }
        .quiz-header h4 { 
          color: #065f46; 
          margin: 0 0 4px 0; 
          font-size: 24px; 
          font-weight: 800; 
          text-align: center; 
        }
        .quiz-header p { 
          color: #64748b; 
          font-size: 12px; 
          margin: 0 0 16px 0; 
          font-weight: bold; 
          text-align: center; 
        }
        .quiz-header h3 { 
          color: #1e293b; 
          font-size: 18px; 
          font-weight: 800; 
          margin: 0; 
          text-align: center; 
        }
        .meta-info { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 15px; 
          margin-top: 20px; 
          font-size: 13px; 
          font-weight: bold; 
          color: #475569; 
        }
        .question-item { 
          margin-bottom: 25px; 
          page-break-inside: avoid; 
        }
        .section-heading { 
          font-size: 16px; 
          font-weight: 800; 
          color: #047857; 
          margin-top: 25px; 
          margin-bottom: 15px; 
          border-bottom: 1.5px solid #e2e8f0; 
          padding-bottom: 5px; 
          text-align: left; 
        }
        .question-text { 
          font-size: 15px; 
          font-weight: bold; 
          color: #1e293b; 
          margin-bottom: 10px; 
          line-height: 1.6; 
        }
        .options-grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 12px; 
          margin-left: 24px; 
          margin-top: 8px; 
        }
        .option-item { 
          font-size: 14px; 
          color: #334155; 
          font-weight: 600; 
          display: flex; 
          align-items: center; 
          gap: 6px; 
        }
        .option-circle { 
          width: 22px; 
          height: 22px; 
          border: 1.5px solid #94a3b8; 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-size: 11px; 
          font-weight: bold; 
          background: #f8fafc; 
          color: #475569; 
          flex-shrink: 0; 
        }
        .answer-key { 
          margin-top: 12px; 
          margin-left: 24px; 
          padding: 10px 16px; 
          background: #ecfdf5; 
          border-left: 4px solid #10b981; 
          border-radius: 0 8px 8px 0; 
          font-size: 12px; 
          font-weight: bold; 
          color: #047857; 
          display: ${includeAnswersInPrint ? 'block' : 'none'}; 
        }
        .footer-section { 
          margin-top: 60px; 
          padding-top: 30px; 
          border-top: 1px solid #f1f5f9; 
          display: flex; 
          justify-content: space-between; 
          font-size: 11px; 
          color: #94a3b8; 
          font-weight: bold; 
        }
        .signature-box { 
          border-top: 1px dashed #cbd5e1; 
          padding-top: 8px; 
          padding-left: 24px; 
          padding-right: 24px; 
          text-align: right; 
          margin-top: 30px; 
        }
        @media print { 
          .no-print { display: none !important; } 
          body { padding: 20px; }
        }
      `);
      doc.write('</style>');
      doc.write('</head><body>');

      let quizHtml = `
        <div class="quiz-header">
          <div style="display: flex; justify-content: center; margin-bottom: 15px;">
            <div style="background: #f0fdf4; border: 1px solid #d1fae5; border-radius: 12px; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
              <img 
                src="https://madrasatussunnah.org/wp-content/uploads/cropped-logo-192x192.png" 
                onerror="this.onerror=null; this.src='https://madrasatussunnah.org/favicon.ico';"
                style="width: 54px; height: 54px; object-fit: contain;"
                alt="${isPlanEng ? 'Madrasatus Sunnah' : 'মাদরাসাতুস সুন্নাহ'}"
              />
            </div>
          </div>
          <h4>${isPlanEng ? 'Madrasatus Sunnah' : 'মাদরাসাতুস সুন্নাহ'}</h4>
          <p>${isPlanEng ? 'Annual/Term Evaluation Exam' : 'বার্ষিক/সাময়িক মূল্যায়ন পরীক্ষা'}</p>
          <h3>${quizResult.quizTitle}</h3>
          <div class="meta-info">
            <div>${isPlanEng ? 'Class/Subject:' : 'শ্রেণি/বিষয়:'} ${quizClassSubject}</div>
            <div style="text-align: center;">${isPlanEng ? 'Full Marks:' : 'পূর্ণমান:'} ${displayMaxScore}</div>
            <div style="text-align: right;">${isPlanEng ? 'Time:' : 'সময়:'} ${isPlanEng ? '20 Minutes' : '২০ মিনিট'}</div>
          </div>
        </div>
        <div style="margin-top: 30px;">
      `;

      const grouped = getGroupedQuestions();
      grouped.forEach(g => {
        quizHtml += `
          <div class="section-heading">
            ${g.heading}
          </div>
        `;
        
        g.questions.forEach((q, qIdx) => {
          const numStr = isPlanEng ? String(qIdx + 1) : toBengaliNumber(qIdx + 1);
          quizHtml += `
            <div class="question-item">
              <div class="question-text">${numStr}. ${cleanQuestionNumbering(q.question)}</div>
          `;
          
          if (q.options && q.options.length > 0) {
            quizHtml += `<div class="options-grid">`;
            q.options.forEach((opt, oIdx) => {
              const parsed = parseQuizOption(opt, oIdx);
              quizHtml += `
                <div class="option-item">
                  <span class="option-circle">${parsed.prefix}</span>
                  <span>${parsed.text}</span>
                </div>
              `;
            });
            quizHtml += `</div>`;
          }

          if (includeAnswersInPrint) {
            quizHtml += `
              <div class="answer-key">
                ${isPlanEng ? 'Answer:' : 'উত্তর:'} ${q.answer}
              </div>
            `;
          }

          quizHtml += `</div>`;
        });
      });

      quizHtml += `
        </div>
        <div class="footer-section">
          <span>${isPlanEng ? 'Question paper generated and verified by AI' : 'প্রশ্নপত্রটি এআই দ্বারা পরীক্ষিত ও অনুমোদিত'}</span>
          <div class="signature-box">${isPlanEng ? "Principal's Signature" : 'প্রধান শিক্ষকের স্বাক্ষর'}</div>
        </div>
      `;

      doc.write(quizHtml);
      doc.write('</body></html>');
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
  };

  const handleCopyQuiz = () => {
    if (!quizResult) return;
    const isPlanEng = isEnglishText(editableContent);
    const isQuizEng = quizResult.questions.some(q => /[a-zA-Z]/.test(q.question));
    const maxScore = isQuizEng ? 30 : quizResult.questions.length * 2;
    const displayMaxScore = isPlanEng ? String(maxScore) : toBengaliNumber(maxScore);

    let text = `📋 ${quizResult.quizTitle}\n`;
    text += `${isPlanEng ? 'Class/Subject:' : 'শ্রেণি/বিষয়:'} ${quizClassSubject}\n`;
    text += `${isPlanEng ? 'Full Marks:' : 'পূর্ণমান:'} ${displayMaxScore} | ${isPlanEng ? 'Time: 20 Minutes' : 'সময়: ২০ মিনিট'}\n`;
    text += `-------------------------------------------\n\n`;
    
    const grouped = getGroupedQuestions();
    grouped.forEach(g => {
      text += `👉 ${g.heading}\n\n`;
      g.questions.forEach((q, qIdx) => {
        const numStr = isPlanEng ? String(qIdx + 1) : toBengaliNumber(qIdx + 1);
        text += `${numStr}. ${cleanQuestionNumbering(q.question)}\n`;
        if (q.options && q.options.length > 0) {
          text += `   ${q.options.join('   ')}\n`;
        }
        if (showAllAnswers || showAnswers[q.originalIdx]) {
          text += `   ${isPlanEng ? 'Answer:' : 'উত্তর:'} ${q.answer}\n`;
        }
        text += `\n`;
      });
    });

    navigator.clipboard.writeText(text);
    setCopiedQuiz(true);
    setTimeout(() => setCopiedQuiz(false), 2000);
  };

  const handleCopyExcelQuiz = () => {
    if (!quizResult) return;
    const isPlanEng = isEnglishText(editableContent);
    
    // Header Row matching spreadsheet standard
    const headers = isPlanEng 
      ? ['No.', 'Question Type', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer']
      : ['ক্রমিক নং', 'প্রশ্নের ধরন', 'প্রশ্ন', 'অপশন ক', 'অপশন খ', 'অপশন গ', 'অপশন ঘ', 'সঠিক উত্তর'];
      
    const rows = [headers.join('\t')];
    
    quizResult.questions.forEach((q, idx) => {
      const qNum = isPlanEng ? String(idx + 1) : toBengaliNumber(idx + 1);
      
      let qTypeStr = q.type || 'mcq';
      if (!isPlanEng) {
        if (qTypeStr === 'mcq') qTypeStr = 'বহুনির্বাচনী (MCQ)';
        else if (qTypeStr === 'short') qTypeStr = 'সংক্ষিপ্ত উত্তর';
        else if (qTypeStr === 'true_false') qTypeStr = 'সত্য/মিথ্যা';
        else if (qTypeStr === 'essay') qTypeStr = 'রচনামূলক প্রশ্ন';
      }
      
      // Remove tabs and newlines inside texts to prevent breaking spreadsheet cell formats
      const questionText = cleanQuestionNumbering(q.question).replace(/\r?\n|\r|\t/g, ' ');
      
      let optA = '';
      let optB = '';
      let optC = '';
      let optD = '';
      
      if (q.options && q.options.length > 0) {
        optA = parseQuizOption(q.options[0] || '', 0).text.replace(/\r?\n|\r|\t/g, ' ');
        optB = parseQuizOption(q.options[1] || '', 1).text.replace(/\r?\n|\r|\t/g, ' ');
        optC = parseQuizOption(q.options[2] || '', 2).text.replace(/\r?\n|\r|\t/g, ' ');
        optD = parseQuizOption(q.options[3] || '', 3).text.replace(/\r?\n|\r|\t/g, ' ');
      }
      
      const answerText = q.answer.replace(/\r?\n|\r|\t/g, ' ');
      
      rows.push([
        qNum,
        qTypeStr,
        questionText,
        optA,
        optB,
        optC,
        optD,
        answerText
      ].join('\t'));
    });
    
    const tsvText = rows.join('\n');
    navigator.clipboard.writeText(tsvText);
    setCopiedExcel(true);
    setTimeout(() => setCopiedExcel(false), 2000);
  };

  // Render content based on active tab
  return (
    <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-700">
      
      {/* Dynamic Header */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between shrink-0 border-b border-emerald-900/10 gap-4">
        <div className="flex items-center text-white">
          <div className="p-2.5 bg-white/10 rounded-xl mr-3">
            <BookCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-lg tracking-tight">পাঠ পরিকল্পনা ও রুটিন হাব</h3>
            <p className="text-emerald-100 text-xs font-semibold">আপনার পরিকল্পনা কাস্টমাইজ ও ব্যবস্থাপনা করুন</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button 
            onClick={handlePrint} 
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all duration-300" 
            title="প্রিন্ট করুন"
          >
            <Printer className="w-5 h-5" />
          </button>
          <button 
            onClick={handleCopy} 
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all duration-300"
            title="কপি করুন"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-300" /> : <Copy className="w-5 h-5" />}
          </button>
          <button 
            onClick={onReset} 
            className="bg-white text-emerald-900 px-5 py-2.5 rounded-xl text-xs font-black hover:bg-emerald-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" /> নতুন তৈরি করুন
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="border-b border-slate-100 bg-slate-50/50 p-1.5 sm:p-2 flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('table')}
          className={`flex items-center space-x-1 sm:space-x-2 px-3 py-2 sm:px-5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-black transition-all ${
            activeTab === 'table' 
              ? 'bg-white text-emerald-700 shadow-sm border border-slate-100' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
          <span>রুটিন টেবিল</span>
        </button>

        <button
          onClick={() => setActiveTab('diary')}
          className={`flex items-center space-x-1 sm:space-x-2 px-3 py-2 sm:px-5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-black transition-all ${
            activeTab === 'diary' 
              ? 'bg-white text-emerald-700 shadow-sm border border-slate-100' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
          <span>দৈনিক ডায়েরি</span>
        </button>

        <button
          onClick={() => setActiveTab('map')}
          className={`flex items-center space-x-1 sm:space-x-2 px-3 py-2 sm:px-5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-black transition-all ${
            activeTab === 'map' 
              ? 'bg-white text-emerald-700 shadow-sm border border-slate-100' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
          }`}
        >
          <Map className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
          <span>রোডম্যাপ (Map)</span>
        </button>

        <button
          onClick={() => setActiveTab('quiz')}
          className={`flex items-center space-x-1 sm:space-x-2 px-3 py-2 sm:px-5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-black transition-all ${
            activeTab === 'quiz' 
              ? 'bg-white text-emerald-700 shadow-sm border border-slate-100' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
          <span>কুইজ (Quiz)</span>
        </button>
      </div>
      
      {/* Main Content Pane */}
      <div className="p-4 md:p-8 bg-slate-50/30 flex-1 min-h-[500px]">
        
        {/* VIEW 1: ACADEMIC TABLE */}
        {activeTab === 'table' && (
          <div className="animate-in fade-in duration-300">
            <div className="mb-4 flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
              <span>একাডেমিক রুটিন টেবিল</span>
              <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">স্বয়ংক্রিয় লেআউট</span>
            </div>
            
            <div id="printable-content" className="lesson-table-container overflow-x-auto rounded-2xl border border-slate-200/60 shadow-lg shadow-slate-100 bg-white">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]} 
                rehypePlugins={[rehypeRaw]}
                components={{
                  table: ({node, ...props}) => <table className="w-full border-collapse text-left" {...props} />,
                  thead: ({node, ...props}) => <thead className="bg-emerald-600 text-white border-b-2 border-emerald-700" {...props} />,
                  th: ({node, ...props}) => {
                    const text = String(props.children);
                    const isAction = text.toLowerCase().includes('action') || text.includes('অ্যাকশন') || text.toLowerCase().includes('regenerate');
                    return <th className={`text-white border-b border-emerald-700 px-3 py-3 sm:px-6 sm:py-4 text-[11px] sm:text-xs font-black text-center uppercase tracking-wider ${isAction ? 'no-print w-16 sm:w-20' : ''}`} {...props} />;
                  },
                  tr: ({node, ...props}) => <tr className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0" {...props} />,
                  td: ({node, ...props}) => {
                    const text = String(props.children);
                    const isSpecial = isSpecialText(text);
                    const isDayOnly = ['শনিবার', 'রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার'].includes(text.trim());
                    const isRegenMarker = text.includes('[REGENERATE]');
                    
                    const trimmedText = text.trim();
                    const isDate = trimmedText.length >= 5 && /^[0-9\-\/\.\u09E6-\u09EF\s]+$/.test(trimmedText) && (trimmedText.includes('-') || trimmedText.includes('/') || trimmedText.includes('.'));

                    if (isRegenMarker) {
                      const rowElement = (node as any)?.position?.start?.line;
                      let rowDate = '';
                      let currentCwVal = '';
                      let currentHwVal = '';

                      if (rowElement) {
                        const rows = editableContent.split('\n');
                        const lineText = rows[rowElement - 1];
                        if (lineText) {
                          const dateMatch = lineText.match(/(\d{2}-\d{2}-\d{2})/) || lineText.match(/(\d{4}-\d{2}-\d{2})/);
                          rowDate = dateMatch ? dateMatch[0] : '';
                          const parts = lineText.split('|');
                          if (parts.length >= 4) {
                            currentCwVal = parts[2].trim();
                            currentHwVal = parts[3].trim();
                          }
                        }
                      }

                      const isThisRowRegenerating = !!isRegenerating && !!rowDate && isRegenerating === rowDate;

                      return (
                        <td className="px-3 py-3 sm:px-6 sm:py-4 text-center align-middle no-print">
                          <button 
                            type="button"
                            onClick={() => {
                              if (rowDate && currentCwVal && currentHwVal) {
                                handleRegenRow(rowDate, currentCwVal, currentHwVal);
                              }
                            }}
                            disabled={!!isRegenerating}
                            className={`p-1.5 sm:p-2 rounded-xl transition-all ${
                              isThisRowRegenerating 
                                ? 'text-emerald-600 bg-emerald-50 border border-emerald-100 scale-105' 
                                : isRegenerating 
                                  ? 'text-gray-300 border border-slate-100 bg-slate-50 cursor-not-allowed opacity-50' 
                                  : 'text-emerald-600 hover:bg-emerald-50 hover:scale-105 active:scale-95 border border-emerald-100 shadow-sm bg-white'
                            }`}
                            title="এই দিনের কাজ পরিবর্তন করুন"
                          >
                            {isThisRowRegenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                          </button>
                        </td>
                      );
                    }

                    return (
                      <td 
                        className={`px-3 py-3.5 sm:px-6 sm:py-5 text-xs sm:text-[15px] font-bold text-center align-middle border-r border-slate-100 last:border-0 ${isSpecial ? 'text-rose-600 font-black bg-rose-50/20' : 'text-slate-700'} ${isDayOnly ? 'bg-emerald-500/10 text-emerald-800' : ''} ${isDate ? 'whitespace-nowrap font-mono font-semibold text-slate-600 tracking-normal' : ''}`} 
                        {...props} 
                      />
                    );
                  },
                }}
              >
                {editableContent}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* VIEW 2: DAILY DIARY */}
        {activeTab === 'diary' && (
          <div className="animate-in fade-in duration-300 max-w-2xl mx-auto">
            {parsedDays.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-bold">কোনো রুটিন ডেটা খুঁজে পাওয়া যায়নি।</p>
              </div>
            ) : (
              <div>
                {/* Diary book mockup wrapper */}
                <div className="bg-[#fdfbf7] rounded-3xl shadow-xl border border-amber-900/10 p-6 md:p-10 relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
                  {/* Spiral binding mockup */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-full flex flex-col justify-around py-4 pointer-events-none opacity-20">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="w-5 h-2 bg-slate-800 rounded-full shadow-inner" />
                    ))}
                  </div>

                  {/* Ribbon header */}
                  <div className="border-b-2 border-emerald-800/20 pb-4 mb-6 flex justify-between items-center">
                    <span className="text-xs font-black text-emerald-800 tracking-widest uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100/50">
                      মাদরাসাতুস সুন্নাহ • দৈনিক পাঠ ডায়েরি
                    </span>
                    <span className="text-xs text-slate-400 font-bold">পৃষ্ঠা: {currentDiaryPage + 1}/{parsedDays.length}</span>
                  </div>

                  {/* Active Diary Page Content */}
                  {(() => {
                    const activeDay = parsedDays[currentDiaryPage];
                    if (!activeDay) {
                      return (
                        <div className="text-center py-12">
                          <p className="text-slate-500 font-bold">পৃষ্ঠা লোড হচ্ছে বা কোনো ডাটা পাওয়া যায়নি।</p>
                        </div>
                      );
                    }
                    const activeCust = customizations[activeDay.date] || {
                      status: 'planned',
                      color: 'emerald',
                      teacherNotes: '',
                      cwChecked: false,
                      hwChecked: false
                    };

                    const isEditing = editingDate === activeDay.date;

                    return (
                      <div className="space-y-6">
                        {/* Stamp Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#f8f5ed] p-4 rounded-2xl border border-amber-900/5">
                          <div className="flex items-center space-x-3">
                            <div className="w-11 h-11 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-md">
                              {currentDiaryPage + 1}
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-800">তারিখ ও বার</h4>
                              <p className="text-xs font-bold text-slate-500">{activeDay.date}</p>
                            </div>
                          </div>
                          
                          {/* Quick edit button */}
                          <div className="flex gap-2">
                            {isEditing ? (
                              <button
                                onClick={saveEditing}
                                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-black shadow-md transition-all active:scale-95"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>সংরক্ষণ করুন</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => startEditing(activeDay)}
                                className="flex items-center space-x-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-sm transition-all active:scale-95"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>সম্পাদনা</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Page Lines (C.W) */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-dashed border-amber-900/15 pb-1">
                            <label className="text-xs font-black text-emerald-800 tracking-wider flex items-center">
                              <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2" />
                              শ্রেণির কাজ (Class Work)
                            </label>
                            <input
                              type="checkbox"
                              checked={activeCust.cwChecked}
                              onChange={(e) => updateCustomization(activeDay.date, 'cwChecked', e.target.checked)}
                              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                            />
                          </div>
                          
                          {isEditing ? (
                            <textarea
                              value={editCw}
                              onChange={(e) => setEditCw(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-[15px] font-medium leading-relaxed focus:ring-2 focus:ring-emerald-500 outline-none"
                              rows={3}
                            />
                          ) : (
                            <p className="text-[16px] font-bold text-slate-700 bg-white/40 p-3 rounded-xl min-h-[60px] leading-relaxed relative pl-4 border-l-4 border-emerald-400">
                              {activeDay.cw}
                            </p>
                          )}
                        </div>

                        {/* Page Lines (H.W) */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-dashed border-amber-900/15 pb-1">
                            <label className="text-xs font-black text-emerald-800 tracking-wider flex items-center">
                              <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2" />
                              বাড়ির কাজ (Home Work)
                            </label>
                            <input
                              type="checkbox"
                              checked={activeCust.hwChecked}
                              onChange={(e) => updateCustomization(activeDay.date, 'hwChecked', e.target.checked)}
                              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                            />
                          </div>
                          
                          {isEditing ? (
                            <textarea
                              value={editHw}
                              onChange={(e) => setEditHw(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-[15px] font-medium leading-relaxed focus:ring-2 focus:ring-emerald-500 outline-none"
                              rows={3}
                            />
                          ) : (
                            <p className="text-[16px] font-bold text-slate-700 bg-white/40 p-3 rounded-xl min-h-[60px] leading-relaxed relative pl-4 border-l-4 border-amber-400">
                              {activeDay.hw}
                            </p>
                          )}
                        </div>

                        {/* Custom Teacher Note section inside Diary */}
                        <div className="space-y-2 bg-[#f4ebd9]/30 p-4 rounded-2xl border border-amber-900/5">
                          <label className="text-xs font-black text-slate-600 flex items-center">
                            <Edit2 className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                            শিক্ষকের ব্যক্তিগত মন্তব্য ও ডায়েরি নোট
                          </label>
                          <textarea
                            value={activeCust.teacherNotes}
                            onChange={(e) => updateCustomization(activeDay.date, 'teacherNotes', e.target.value)}
                            placeholder="এই দিনটির জন্য বিশেষ কোনো নির্দেশনা থাকলে এখানে লিখে রাখুন..."
                            className="w-full bg-transparent border-b border-amber-900/10 py-1 text-sm font-semibold text-slate-800 placeholder:text-slate-400/80 focus:border-emerald-600 focus:ring-0 outline-none resize-none"
                            rows={2}
                          />
                        </div>

                        {/* Traditional Signature Block */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dashed border-amber-900/15">
                          <div className="text-center">
                            <div className="h-8 border-b border-amber-900/10 flex items-end justify-center pb-1">
                              {activeCust.cwChecked && activeCust.hwChecked ? (
                                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">অনুমোদিত</span>
                              ) : null}
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 block">শিক্ষকের স্বাক্ষর</span>
                          </div>
                          <div className="text-center">
                            <div className="h-8 border-b border-amber-900/10" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 block">অভিভাবকের মন্তব্য ও সই</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Page Navigation Controls */}
                <div className="flex items-center justify-between mt-6 bg-white p-4 rounded-2xl border border-slate-200/55 shadow-sm">
                  <button
                    onClick={() => setCurrentDiaryPage(p => Math.max(0, p - 1))}
                    disabled={currentDiaryPage === 0}
                    className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-black border border-slate-200 transition-all active:scale-95"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>পূর্ববর্তী</span>
                  </button>

                  <div className="flex items-center space-x-1 font-mono text-sm font-black text-slate-500">
                    <span>{currentDiaryPage + 1}</span>
                    <span className="opacity-40">/</span>
                    <span>{parsedDays.length}</span>
                  </div>

                  <button
                    onClick={() => setCurrentDiaryPage(p => Math.min(parsedDays.length - 1, p + 1))}
                    disabled={currentDiaryPage === parsedDays.length - 1}
                    className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-black border border-slate-200 transition-all active:scale-95"
                  >
                    <span>পরবর্তী</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: INTERACTIVE LEARNING MAP (ROADMAP) */}
        {activeTab === 'map' && (
          <div className="animate-in fade-in duration-300">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
              <div>
                <h4 className="text-sm font-black text-slate-800">ইন্টারেক্টিভ লার্নিং রোডম্যাপ (Map)</h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">প্রতিটি দিনের ধাপ কাস্টমাইজ করুন এবং অগ্রগতি ট্র্যাকিং করুন</p>
              </div>
              <div className="flex items-center space-x-2 text-xs font-black bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl">
                <span>সম্পন্ন: {parsedDays.filter(d => (customizations[d.date]?.status === 'completed')).length} / {parsedDays.length} দিন</span>
              </div>
            </div>

            {parsedDays.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <Map className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-bold">কোনো রুটিন ডেটা খুঁজে পাওয়া যায়নি।</p>
              </div>
            ) : (
              <div className="relative pl-6 sm:pl-8 space-y-12 before:absolute before:top-4 before:left-3 before:sm:left-4 before:bottom-4 before:w-1 before:bg-slate-200/80">
                {parsedDays.map((day, idx) => {
                  const cust = customizations[day.date] || {
                    status: 'planned',
                    color: 'emerald',
                    teacherNotes: '',
                    cwChecked: false,
                    hwChecked: false
                  };

                  const isEditing = editingDate === day.date;
                  const scheme = colorSchemes[cust.color || 'emerald'] || colorSchemes.emerald;

                  return (
                    <div key={day.date} className="relative group transition-all duration-300">
                      
                      {/* Timeline Dot with Interactive Status */}
                      <button
                        onClick={() => {
                          const nextStatus = 
                            cust.status === 'planned' ? 'current' :
                            cust.status === 'current' ? 'completed' : 'planned';
                          updateCustomization(day.date, 'status', nextStatus);
                        }}
                        className={`absolute -left-[30px] sm:-left-[34px] top-1.5 w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all z-10 border-4 border-white shadow-md active:scale-90 ${
                          cust.status === 'completed' ? 'bg-emerald-600 text-white' :
                          cust.status === 'current' ? 'bg-amber-500 text-white animate-pulse' :
                          'bg-slate-300 text-slate-600 hover:bg-slate-400'
                        }`}
                        title="অগ্রগতি পরিবর্তন করতে ক্লিক করুন"
                      >
                        {cust.status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                        {cust.status === 'current' && <PlayCircle className="w-4 h-4" />}
                        {cust.status === 'planned' && <Circle className="w-4 h-4 fill-white" />}
                      </button>

                      {/* Bento Card representing each node */}
                      <div className={`rounded-3xl border-2 p-6 transition-all duration-500 bg-white hover:shadow-xl ${scheme.border} shadow-lg ${scheme.glow}/10`}>
                        
                        {/* Day Card Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
                          <div className="flex items-center space-x-3">
                            <span className={`text-xs font-black uppercase tracking-wider text-white px-3 py-1 rounded-full ${scheme.badge}`}>
                              ধাপ {idx + 1}
                            </span>
                            <div>
                              <h4 className="text-base font-black text-slate-800 flex items-center gap-1.5">
                                {day.date} 
                              </h4>
                              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">লার্নিং নোড</p>
                            </div>
                          </div>

                          {/* Quick Controls: Status, Color picker & Edit */}
                          <div className="flex flex-wrap items-center gap-3">
                            {/* Color Selector */}
                            <div className="flex items-center space-x-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                              <Palette className="w-3.5 h-3.5 text-slate-500 mr-1" />
                              {(['emerald', 'blue', 'amber', 'rose'] as const).map(color => (
                                <button
                                  key={color}
                                  onClick={() => updateCustomization(day.date, 'color', color)}
                                  className={`w-4.5 h-4.5 rounded-full border-2 transition-transform hover:scale-110 ${
                                    color === 'emerald' ? 'bg-emerald-500' :
                                    color === 'blue' ? 'bg-blue-500' :
                                    color === 'amber' ? 'bg-amber-500' : 'bg-rose-500'
                                  } ${cust.color === color ? 'border-white ring-2 ring-emerald-600 scale-105' : 'border-transparent'}`}
                                  title={`${color} থিম কাস্টমাইজ করুন`}
                                />
                              ))}
                            </div>

                            {/* Editing Button */}
                            {isEditing ? (
                              <button
                                onClick={saveEditing}
                                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>সংরক্ষণ</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => startEditing(day)}
                                className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 transition-all"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                                <span>সম্পাদনা</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Day Card content */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          
                          {/* Class work card */}
                          <div className={`p-4 rounded-2xl border ${scheme.border} ${scheme.bg}/40 flex flex-col justify-between`}>
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className={`text-[11px] font-black uppercase tracking-wider ${scheme.text}`}>শ্রেণির কাজ (C.W)</span>
                                <input
                                  type="checkbox"
                                  checked={cust.cwChecked}
                                  onChange={(e) => updateCustomization(day.date, 'cwChecked', e.target.checked)}
                                  className="w-4.5 h-4.5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                />
                              </div>
                              {isEditing ? (
                                <textarea
                                  value={editCw}
                                  onChange={(e) => setEditCw(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                                  rows={2}
                                />
                              ) : (
                                <p className="text-sm font-bold text-slate-700 leading-relaxed">{day.cw}</p>
                              )}
                            </div>
                          </div>

                          {/* Home work card */}
                          <div className={`p-4 rounded-2xl border ${scheme.border} ${scheme.bg}/40 flex flex-col justify-between`}>
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className={`text-[11px] font-black uppercase tracking-wider ${scheme.text}`}>বাড়ির কাজ (H.W)</span>
                                <input
                                  type="checkbox"
                                  checked={cust.hwChecked}
                                  onChange={(e) => updateCustomization(day.date, 'hwChecked', e.target.checked)}
                                  className="w-4.5 h-4.5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                />
                              </div>
                              {isEditing ? (
                                <textarea
                                  value={editHw}
                                  onChange={(e) => setEditHw(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                                  rows={2}
                                />
                              ) : (
                                <p className="text-sm font-bold text-slate-700 leading-relaxed">{day.hw}</p>
                              )}
                            </div>
                          </div>

                        </div>

                        {/* Visual Progress bar inside Node */}
                        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                          {/* Text Comment Edit */}
                          <div className="flex-grow flex items-center space-x-2 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200/50">
                            <PenTool className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <input
                              type="text"
                              value={cust.teacherNotes}
                              onChange={(e) => updateCustomization(day.date, 'teacherNotes', e.target.value)}
                              placeholder="এই নোডের জন্য কাস্টম শিক্ষক নোট যোগ করুন..."
                              className="bg-transparent border-none text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:ring-0 outline-none w-full"
                            />
                          </div>

                          <span className={`text-[11px] font-black uppercase tracking-wider self-end sm:self-auto px-3 py-1 rounded-full ${
                            cust.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                            cust.status === 'current' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            অবস্থা: {
                              cust.status === 'completed' ? 'সম্পন্ন' :
                              cust.status === 'current' ? 'চলমান' : 'পরিকল্পিত'
                            }
                          </span>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'quiz' && (
          <div className="animate-in fade-in duration-300">
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h4 className="text-xl font-black text-slate-800">স্মার্ট কুইজ ও মূল্যায়ন জেনারেটর</h4>
                <p className="text-xs font-semibold text-slate-500 mt-1">পাঠ পরিকল্পনার বিষয়বস্তু থেকে স্বয়ংক্রিয়ভাবে মানসম্মত কুইজ তৈরি করুন</p>
              </div>
              <span className="self-start md:self-auto bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider">
                সহকারী এআই মডিউল
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Form Settings */}
              <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm flex flex-col space-y-6">
                <div>
                  <h5 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">কুইজ কনফিগারেশন</h5>
                  
                  {/* Select Day */}
                  <div className="space-y-2 mb-4">
                    <label className="text-xs font-black text-slate-500 uppercase">উৎস বা পড়া সিলেক্ট করুন</label>
                    <select
                      value={quizDay}
                      onChange={(e) => setQuizDay(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    >
                      <option value="all">সম্পূর্ণ পাঠ পরিকল্পনা (সব দিন)</option>
                      {parsedDays.map((day) => (
                        <option key={day.date} value={day.date}>
                          {day.date} ({day.cw.substring(0, 20)}...)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Class / Subject Name */}
                  <div className="space-y-2 mb-4">
                    <label className="text-xs font-black text-slate-500 uppercase">শ্রেণি / বিষয় / শিরোনাম</label>
                    <input
                      type="text"
                      value={quizClassSubject}
                      onChange={(e) => setQuizClassSubject(e.target.value)}
                      placeholder="যেমন: ৫ম শ্রেণি - আকাইদ"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                  </div>

                  {/* Question Count Selection */}
                  <div className="space-y-2 mb-4">
                    <label className="text-xs font-black text-slate-500 uppercase">প্রশ্নের সংখ্যা</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[5, 10, 15].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setQuizCount(count)}
                          className={`py-2 px-3 rounded-xl text-sm font-black transition-all ${
                            quizCount === count
                              ? 'bg-emerald-600 text-white shadow-md'
                              : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {count}টি প্রশ্ন
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question Type */}
                  <div className="space-y-2 mb-4">
                    <label className="text-xs font-black text-slate-500 uppercase">প্রশ্নের ধরন</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'mcq', label: 'বহুনির্বাচনী (MCQ)' },
                        { id: 'short', label: 'সংক্ষিপ্ত উত্তর' },
                        { id: 'true_false', label: 'সত্য / মিথ্যা' },
                        { id: 'essay', label: 'রচনামূলক প্রশ্ন' },
                        { id: 'mix', label: 'মিশ্র প্রকার' }
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setQuizType(t.id as any)}
                          className={`py-2 px-3 rounded-xl text-xs font-black transition-all border ${
                            quizType === t.id
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Difficulty */}
                  <div className="space-y-2 mb-4">
                    <label className="text-xs font-black text-slate-500 uppercase">কঠিনতার স্তর</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'easy', label: 'সহজ' },
                        { id: 'medium', label: 'মাঝারি' },
                        { id: 'hard', label: 'কঠিন' }
                      ].map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setQuizDifficulty(d.id as any)}
                          className={`py-2 px-3 rounded-xl text-xs font-black transition-all border ${
                            quizDifficulty === d.id
                              ? d.id === 'easy' ? 'bg-emerald-600 text-white border-emerald-600' :
                                d.id === 'medium' ? 'bg-amber-500 text-white border-amber-500' :
                                'bg-rose-600 text-white border-rose-600'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Instructions */}
                  <div className="space-y-2 mb-6">
                    <label className="text-xs font-black text-slate-500 uppercase">অতিরিক্ত কোনো নির্দেশ (ঐচ্ছিক)</label>
                    <textarea
                      value={quizInstructions}
                      onChange={(e) => setQuizInstructions(e.target.value)}
                      placeholder="যেমন: সূরা হুজুরাত থেকে প্রশ্ন করুন, অথবা বানান শুদ্ধিকরণে জোর দিন..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-400"
                      rows={3}
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={handleGenerateQuiz}
                    disabled={isGeneratingQuiz}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-3.5 px-4 rounded-xl text-sm font-black shadow-lg hover:shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isGeneratingQuiz ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>কুইজ তৈরি হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <HelpCircle className="w-4 h-4" />
                        <span>কুইজ জেনারেট করুন</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: Preview / Result Area */}
              <div className="lg:col-span-8">
                
                {/* Empty State */}
                {!isGeneratingQuiz && !quizResult && !quizError && (
                  <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center shadow-sm flex flex-col items-center justify-center h-full min-h-[400px]">
                    <div className="p-4 bg-emerald-50 rounded-full text-emerald-600 mb-4">
                      <HelpCircle className="w-12 h-12" />
                    </div>
                    <h5 className="text-lg font-black text-slate-800">কুইজ এখনো জেনারেট করা হয়নি</h5>
                    <p className="text-sm font-semibold text-slate-500 max-w-sm mt-2 leading-relaxed">
                      বামপাশের প্যানেলে প্রশ্নের ধরন ও কঠিনতা নির্বাচন করে "কুইজ জেনারেট করুন" বাটনে ক্লিক করুন।
                    </p>
                  </div>
                )}

                {/* Loading State */}
                {isGeneratingQuiz && (
                  <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center shadow-sm flex flex-col items-center justify-center h-full min-h-[400px] animate-pulse">
                    <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
                    <h5 className="text-lg font-black text-slate-800">প্রশ্নপত্র তৈরি হচ্ছে...</h5>
                    <p className="text-sm font-semibold text-slate-500 max-w-sm mt-2 leading-relaxed">
                      কৃত্রিম বুদ্ধিমত্তা আপনার সিলেবাস ও পাঠ পরিকল্পনা গভীরভাবে বিশ্লেষণ করে অত্যন্ত সুনিপুণভাবে মানসম্মত প্রশ্ন সাজাচ্ছে। অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন।
                    </p>
                  </div>
                )}

                {/* Error State */}
                {quizError && (
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-8 text-center shadow-sm flex flex-col items-center justify-center h-full min-h-[400px]">
                    <div className="p-3.5 bg-rose-100 text-rose-600 rounded-full mb-4">
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <h5 className="text-lg font-black text-rose-800">ত্রুটি দেখা দিয়েছে</h5>
                    <p className="text-sm font-semibold text-rose-600 max-w-md mt-2 leading-relaxed">
                      {quizError}
                    </p>
                    <button
                      type="button"
                      onClick={handleGenerateQuiz}
                      className="mt-6 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-black transition-all shadow-md"
                    >
                      আবার চেষ্টা করুন
                    </button>
                  </div>
                )}

                {/* Quiz Result Preview */}
                {quizResult && (
                  <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                    
                    {/* Preview Controls Header */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center space-x-3 gap-2">
                        <span className="text-xs font-black text-slate-500 uppercase">উত্তরপত্র নিয়ন্ত্রণ:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAllAnswers(!showAllAnswers);
                            const updated: Record<number, boolean> = {};
                            quizResult.questions.forEach((_, idx) => {
                              updated[idx] = !showAllAnswers;
                            });
                            setShowAnswers(updated);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${
                            showAllAnswers
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {showAllAnswers ? 'সব উত্তর লুকান' : 'সব উত্তর দেখুন'}
                        </button>
                        
                        <label className="flex items-center space-x-2 gap-1.5 cursor-pointer select-none border border-slate-200 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-all">
                          <input
                            type="checkbox"
                            checked={includeAnswersInPrint}
                            onChange={(e) => setIncludeAnswersInPrint(e.target.checked)}
                            className="w-3.5 h-3.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                          />
                          <span className="text-xs font-black text-slate-600">প্রিন্টে উত্তরমালা রাখুন</span>
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyQuiz}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-black text-slate-700 transition-all flex items-center gap-1.5"
                          title="মেসেঞ্জার বা ওয়ার্ড ফাইলে পেস্ট করার জন্য সাধারণ টেক্সট কপি করুন"
                        >
                          {copiedQuiz ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>সাধারণ কপি</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCopyExcelQuiz}
                          className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-black text-emerald-800 transition-all flex items-center gap-1.5"
                          title="গুগল শিট বা এক্সেলে পেস্ট করার জন্য কপি করুন"
                        >
                          {copiedExcel ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />}
                          <span>শীট কপি (Excel/Sheets)</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={handlePrintQuiz}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>প্রিন্ট করুন</span>
                        </button>
                      </div>
                    </div>

                    {/* Printable Exam Paper Document */}
                    <div 
                      id="printable-quiz-content" 
                      className="bg-white rounded-3xl border border-slate-200 p-8 md:p-12 shadow-md relative overflow-hidden"
                    >
                      {/* Madrasah styled header */}
                      <div className="text-center pb-6 mb-8 border-b-2 border-double border-slate-300 flex flex-col items-center">
                        <div className="flex justify-center mb-3">
                          <div className="bg-emerald-50 p-1 rounded-2xl border border-emerald-100 flex items-center justify-center overflow-hidden w-16 h-16 relative">
                            <img 
                              src="https://madrasatussunnah.org/wp-content/uploads/cropped-logo-192x192.png" 
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (target.src.includes('cropped-logo')) {
                                  target.src = 'https://madrasatussunnah.org/favicon.ico';
                                } else {
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const fallback = parent.querySelector('.fallback-icon');
                                    if (fallback) fallback.classList.remove('hidden');
                                  }
                                }
                              }}
                              className="w-14 h-14 object-contain"
                              alt="মাদরাসাতুস সুন্নাহ"
                              referrerPolicy="no-referrer"
                            />
                            <BookOpen className="w-8 h-8 text-emerald-600 fallback-icon hidden" />
                          </div>
                        </div>
                        <h4 className="text-2xl font-black text-emerald-800 tracking-wide mb-1">
                          {isEnglishText(editableContent) ? 'Madrasatus Sunnah' : 'মাদরাসাতুস সুন্নাহ'}
                        </h4>
                        <p className="text-xs font-black text-slate-500 uppercase tracking-[0.15em] mb-4">
                          {isEnglishText(editableContent) ? 'Annual/Term Evaluation Exam' : 'বার্ষিক/সাময়িক মূল্যায়ন পরীক্ষা'}
                        </p>
                        
                        <h3 className="text-xl font-extrabold text-slate-800 mb-6">{quizResult.quizTitle}</h3>
                        
                        {/* Exam Meta Row */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-sm font-bold text-slate-600 max-w-2xl mx-auto pt-2">
                          <div className="text-left flex items-center gap-1">
                            <span className="text-slate-400">{isEnglishText(editableContent) ? 'Class/Subject:' : 'শ্রেণি/বিষয়:'}</span> 
                            <span className="text-slate-800">{quizClassSubject}</span>
                          </div>
                          <div className="text-center flex items-center justify-center gap-1">
                            <span className="text-slate-400">{isEnglishText(editableContent) ? 'Full Marks:' : 'পূর্ণমান:'}</span> 
                            <span className="text-slate-800">
                              {(() => {
                                const isPlanEng = isEnglishText(editableContent);
                                const isQuizEng = quizResult.questions.some(q => /[a-zA-Z]/.test(q.question));
                                const maxScore = isQuizEng ? 30 : quizResult.questions.length * 2;
                                return isPlanEng ? String(maxScore) : toBengaliNumber(maxScore);
                              })()}
                            </span>
                          </div>
                          <div className="text-right flex items-center justify-end gap-1 col-span-2 md:col-span-1">
                            <span className="text-slate-400">{isEnglishText(editableContent) ? 'Time:' : 'সময়:'}</span> 
                            <span className="text-slate-800">{isEnglishText(editableContent) ? '20 Minutes' : '২০ মিনিট'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Question List */}
                      <div className="space-y-8">
                        {getGroupedQuestions().map((group, gIdx) => (
                          <div key={gIdx} className="space-y-6">
                            {/* Section Heading */}
                            <div className="border-b border-slate-100 pb-2 mb-4">
                              <h4 className="text-md font-black text-emerald-700 flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-emerald-600 rounded-full"></span>
                                {group.heading}
                              </h4>
                            </div>

                            {/* Section Questions */}
                            <div className="space-y-6">
                              {group.questions.map((q, qIdx) => {
                                const idx = q.originalIdx;
                                const isAnswerVisible = !!showAnswers[idx] || showAllAnswers;
                                
                                return (
                                  <div 
                                    key={idx} 
                                    onClick={() => setShowAnswers(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                    className="group transition-all rounded-2xl hover:bg-slate-50/50 -mx-4 px-4 py-3 border border-transparent hover:border-slate-100 cursor-pointer"
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <h5 className="text-[15px] font-black text-slate-800 leading-relaxed">
                                          <span className="text-emerald-700 mr-1.5">
                                            {isEnglishText(editableContent) ? (qIdx + 1) : toBengaliNumber(qIdx + 1)}.
                                          </span>
                                          {cleanQuestionNumbering(q.question)}
                                        </h5>
                                        
                                        {/* MCQ Options */}
                                        {q.options && q.options.length > 0 && (
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 ml-6">
                                            {q.options.map((opt, oIdx) => {
                                              const parsed = parseQuizOption(opt, oIdx);
                                              return (
                                                <div key={oIdx} className="flex items-center space-x-3 gap-2 text-sm font-bold text-slate-600 group/opt">
                                                  <div className="flex-shrink-0 w-7 h-7 rounded-full border-2 border-slate-300 flex items-center justify-center text-[11px] font-black bg-slate-50 text-slate-500 transition-all duration-200 group-hover/opt:border-emerald-500 group-hover/opt:bg-emerald-50 group-hover/opt:text-emerald-700 shadow-sm">
                                                    {parsed.prefix}
                                                  </div>
                                                  <span className="leading-normal">{parsed.text}</span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                        
                                        {/* Answer Key block */}
                                        {isAnswerVisible && (
                                          <div className="mt-3 ml-6 p-3 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-xl text-xs font-black text-emerald-800 flex items-start gap-2 animate-in slide-in-from-left-2 duration-200 no-print">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                              <span className="uppercase text-[10px] text-emerald-600 block mb-0.5">সঠিক উত্তর:</span>
                                              {q.answer}
                                            </div>
                                          </div>
                                        )}

                                        {/* Print-only answer list at bottom of question */}
                                        {includeAnswersInPrint && (
                                          <div className="hidden print:block mt-3 ml-6 p-2 bg-slate-50 border-l-4 border-slate-300 rounded text-xs font-black text-slate-700">
                                            উত্তর: {q.answer}
                                          </div>
                                        )}
                                      </div>

                                      {/* Eye toggler for teacher */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowAnswers(prev => ({ ...prev, [idx]: !prev[idx] }));
                                        }}
                                        className={`p-1.5 rounded-lg border transition-all no-print self-start ${
                                          isAnswerVisible
                                            ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                            : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                        }`}
                                        title={isAnswerVisible ? 'উত্তর লুকান' : 'উত্তর দেখুন'}
                                      >
                                        {isAnswerVisible ? (
                                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                                          </svg>
                                        ) : (
                                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                          </svg>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Madrasah Seal Placeholder */}
                      <div className="mt-16 pt-12 border-t border-slate-100 flex justify-between items-center text-xs font-bold text-slate-400">
                        <span>প্রশ্নপত্রটি এআই দ্বারা পরীক্ষিত ও অনুমোদিত</span>
                        <div className="text-right border-t border-dashed border-slate-300 pt-2 px-6">
                          প্রধান শিক্ষকের স্বাক্ষর
                        </div>
                      </div>

                    </div>
                  </div>
                )}

              </div>

            </div>
          </div>
        )}

      </div>
      
      <style>{`
        .lesson-table-container table {
          table-layout: auto;
          width: 100%;
          min-width: 650px;
        }
        @media (min-width: 768px) {
          .lesson-table-container table {
            table-layout: fixed;
            min-width: 100%;
          }
        }
        .lesson-table-container th:first-child, 
        .lesson-table-container td:first-child {
          width: 110px;
          min-width: 110px;
          white-space: nowrap;
        }
        .lesson-table-container th:last-child, 
        .lesson-table-container td:last-child {
          width: 70px;
          min-width: 70px;
        }
        @media print {
          .no-print {
            display: none !important;
          }
        }
        .animate-spin-hover:hover {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PlanDisplay;
