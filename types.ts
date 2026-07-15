
export enum GradeLevel {
  Grade1 = 'প্রথম শ্রেণি',
  Grade2 = 'দ্বিতীয় শ্রেণি',
  Grade3 = 'তৃতীয় শ্রেণি',
  Grade4 = 'চতুর্থ শ্রেণি',
  Grade5 = 'পঞ্চম শ্রেণি',
}

export interface LessonPlanRequest {
  file: File | null;
  fileId?: string;
  fileData: string | null; // Base64 string
  mimeType: string;
  extractedText?: string;
  duration: number; // 1, 2, 3, 5 days
  startDate: string; // YYYY-MM-DD
  startPage: number | string;
  endPage: number | string;
  pageRanges?: { start: number | string; end: number | string }[];
  gradeLevel: GradeLevel;
  additionalContext: string;
  holidays: string;
  weeks: number; // legacy support if needed
  sampleLessonPlan?: string;
}

export interface GenerationState {
  isLoading: boolean;
  progress: number;
  statusMessage: string;
  error: string | null;
  result: string | null;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  gradeLevel: GradeLevel;
  duration: number;
  previewText: string;
  fullContent: string;
  requestContext?: LessonPlanRequest;
}

export interface QuizQuestion {
  type?: 'mcq' | 'short' | 'true_false' | 'blank' | 'essay';
  question: string;
  options?: string[];
  answer: string;
}

export interface QuizRequest {
  lessonContent: string;
  gradeLevel: string;
  questionCount: number;
  questionType: 'mcq' | 'short' | 'true_false' | 'mix' | 'blank' | 'essay';
  difficulty: 'easy' | 'medium' | 'hard';
  additionalInstructions?: string;
}

export interface QuizResponse {
  quizTitle: string;
  questions: QuizQuestion[];
}

