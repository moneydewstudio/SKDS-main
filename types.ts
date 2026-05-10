export interface QuestionMeta {
  news_topic: string;
  question_type: string;
}

export interface QuestionOptions {
  A: string;
  B: string;
  C: string;
  D: string;
  E: string;
}

export interface TkpPoints {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
}

export interface AnswerKey {
  correct_option: string; // "A" | "B" | "C" | "D" | "E"
  tkp_points?: TkpPoints | null;
}

export interface QuestionContent {
  category: 'TIU' | string;
  topic: string;
  subtopic: string;
  question_text: string;
  options: QuestionOptions;
  answer_key: AnswerKey;
  explanation: string;
  difficulty: number; // 1-5
}

export interface GeneratedQuestion {
  meta: QuestionMeta;
  content: QuestionContent;
}

export interface GeneratedQuestionBatch {
  questions: GeneratedQuestion[];
}

export interface NeonConfig {
  connectionString: string;
}

export enum AppState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  GENERATED = 'GENERATED',
  ERROR = 'ERROR'
}