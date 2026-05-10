export interface QuestionMeta {
  news_topic: string;
  question_type: string;
  pipeline_id?: string;      // e.g., "tiu-numerik-deret"
  pipeline_code?: string;    // e.g., "TIU_NUMERIK|NUMERIK_DERET_ANGKA"
  topic_code?: string;       // e.g., "TIU"
  subtopic_code?: string;  // e.g., "TIU_NUMERIK"
  theme_code?: string;       // e.g., "NUMERIK_DERET_ANGKA"
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
  category: 'TWK' | 'TIU' | 'TKP' | string;
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

// Pipeline-specific types for multi-pipeline architecture
// Compliant with metadata.json structure: topic -> subtopic -> theme
export interface PipelineSpec {
  id: string;
  
  // Topic level (TWK, TIU, TKP)
  category: 'TWK' | 'TIU' | 'TKP';        // Maps to metadata.topicCode
  topicCode: string;                       // e.g., "TIU", "TWK", "TKP"
  topicName: string;                       // e.g., "Tes Intelegensia Umum"
  
  // Subtopic level (e.g., TIU_NUMERIK, TWK_PANCASILA)
  subtopicCode: string;                    // e.g., "TIU_NUMERIK"
  subtopicName: string;                    // e.g., "Numerik"
  
  // Theme level (granular subject matter) - NULL for TWK/TKP (2-level hierarchy)
  themeCode: string | null;                // e.g., "NUMERIK_DERET_ANGKA" or null
  themeName: string | null;                // e.g., "Deret Angka" or null
  
  // Legacy fields for backward compatibility
  topic: string;                           // Maps to topicName for TWK/TKP, subtopicName for TIU
  subtopic: string;                        // Maps to subtopicName for TWK/TKP, themeName for TIU
  
  syllabus: string;
  promptTemplate: string;
  contextSource: 'news' | 'bank' | 'syllabus';
  
  // Examples: either inline or external file (examples/<category>/<file>)
  examples?: Array<{
    question: string;
    options: QuestionOptions;
    answer: string;
    explanation: string;
  }>;
  examplesFile?: string; // e.g., "tiu-numerik-logika.examples.json"
  
  difficultySchedule: Record<string, number>; // hourBucket % N -> difficulty 1-5
}

// Metadata-compliant structure for validation
export interface MetadataTopic {
  topicCode: string;
  topicName: string;
}

export interface MetadataSubtopic {
  topicCode: string;
  subtopicCode: string;
  subtopicName: string;
}

export interface MetadataTheme {
  subtopicCode: string;
  themeCode: string;
  themeName: string;
}

export interface PipelineContext {
  topic: string;
  subtopic: string;
  syllabus: string;
  difficulty: number;
  examples: string;
  contextMaterial: string;
}

export type ProcessStage = 'IDLE' | 'FETCHING_CONTEXT' | 'GENERATING_CONTENT' | 'QUALITY_CONTROL' | 'COMPLETED' | 'ERROR';

export interface RouterConfig {
  twk: PipelineSpec[];
  tiu: PipelineSpec[];
  tkp: PipelineSpec[];
}
