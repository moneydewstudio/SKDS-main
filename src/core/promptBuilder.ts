import { PipelineSpec, PipelineContext, GeneratedQuestionBatch } from './types';
import { createMultiKeyClient, MultiKeyGeminiClient } from './geminiClientMulti';
import { BANK_SOAL_1 } from '../../constants/bankSoal';

// Global client instance with fallback support
let multiKeyClient: MultiKeyGeminiClient | null = null;

const getClient = (): MultiKeyGeminiClient => {
  if (!multiKeyClient) {
    multiKeyClient = createMultiKeyClient();
  }
  return multiKeyClient;
};

export const buildContext = async (
  pipeline: PipelineSpec,
  query: string = ''
): Promise<string> => {
  switch (pipeline.contextSource) {
    case 'bank':
      return `REFERENSI BANK SOAL:\n${BANK_SOAL_1.substring(0, 15000)}`;
    
    case 'syllabus':
      return `SILABUS REFERENSI:\nTopik: ${pipeline.topic}\nSubtopik: ${pipeline.subtopic}\nMateri: ${pipeline.syllabus}`;
    
    default:
      return '';
  }
};

export const buildPrompt = (
  pipeline: PipelineSpec,
  context: PipelineContext
): string => {
  const examplesText = context.examples || pipeline.examples
    .map((ex, i) => `Contoh ${i + 1}:\nSoal: ${ex.question}\nOpsi: A. ${ex.options.A} B. ${ex.options.B} C. ${ex.options.C} D. ${ex.options.D} E. ${ex.options.E}\nJawaban: ${ex.answer}\nPembahasan: ${ex.explanation}`)
    .join('\n\n');

  return pipeline.promptTemplate
    .replace('{{topic}}', context.topic)
    .replace('{{subtopic}}', context.subtopic)
    .replace('{{syllabus}}', context.syllabus)
    .replace('{{difficulty}}', String(context.difficulty))
    .replace('{{examples}}', examplesText)
    .replace('{{contextMaterial}}', context.contextMaterial);
};

export const runPipeline = async (
  pipeline: PipelineSpec,
  epochHour: number,
  query: string = ''
): Promise<GeneratedQuestionBatch> => {
  // Build context based on pipeline configuration
  const contextMaterial = await buildContext(pipeline, query);
  
  // Prepare pipeline context
  const pipelineContext: PipelineContext = {
    topic: pipeline.topic,
    subtopic: pipeline.subtopic,
    syllabus: pipeline.syllabus,
    difficulty: pipeline.difficultySchedule[epochHour % Object.keys(pipeline.difficultySchedule).length] || 3,
    examples: '',
    contextMaterial,
  };
  
  // Build and send prompt
  const prompt = buildPrompt(pipeline, pipelineContext);
  
  // Use multi-key client with automatic fallback
  const client = getClient();
  const useGrounding = pipeline.contextSource === 'news';
  const result = await client.generateJSON(prompt, useGrounding) as GeneratedQuestionBatch;
  
  // Handle different response formats from AI
  // AI might return: { questions: [...] } or { question: {...} } or just [...] array
  let questions = result.questions;
  
  // If result itself is an array (AI returned questions directly), use it
  if (Array.isArray(result)) {
    console.log('[PromptBuilder] AI returned questions as direct array');
    questions = result;
  } else if (!questions) {
    console.error('[PromptBuilder] No questions field in result:', JSON.stringify(result, null, 2));
    throw new Error('AI response missing questions field');
  }
  
  // If questions is not an array (single question object), wrap it
  if (!Array.isArray(questions)) {
    console.log('[PromptBuilder] AI returned single question object, wrapping in array');
    questions = [questions];
  }
  
  if (questions.length === 0) {
    console.error('[PromptBuilder] Empty questions array in result:', JSON.stringify(result, null, 2));
    throw new Error('AI response contains empty questions array');
  }
  
  console.log(`[PromptBuilder] Received ${questions.length} question(s) from AI`);
  
  // Inject pipeline metadata into each question
  // For TIU: 3-level hierarchy (topic → subtopic → theme)
  // For TWK/TKP: 2-level hierarchy (topic → subtopic, theme is null)
  const hasTheme = pipeline.themeCode !== null;
  const pipelineCode = hasTheme 
    ? `${pipeline.subtopicCode}|${pipeline.themeCode}`
    : pipeline.subtopicCode;
  
  for (const q of questions) {
    q.meta.pipeline_id = pipeline.id;
    q.meta.pipeline_code = pipelineCode;
    q.meta.topic_code = pipeline.topicCode;
    q.meta.subtopic_code = pipeline.subtopicCode;
    q.meta.theme_code = pipeline.themeCode;
    
    // Ensure question content matches pipeline metadata
    q.content.category = pipeline.category;
    
    if (hasTheme) {
      // TIU: 3-level - topic = subtopicName, subtopic = themeName
      q.content.topic = pipeline.subtopicName;
      q.content.subtopic = pipeline.themeName;
    } else {
      // TWK/TKP: 2-level - topic = topicName, subtopic = subtopicName
      q.content.topic = pipeline.topicName;
      q.content.subtopic = pipeline.subtopicName;
    }
  }
  
  // Return the result with the processed questions array
  return {
    ...result,
    questions
  };
};

// Export for monitoring/debugging
export const getMultiKeyClientStatus = () => {
  return getClient().getStatus();
};

export const resetFailedApiKeys = () => {
  return getClient().resetFailedKeys();
};
