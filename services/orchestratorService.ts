import { fetchNewsContext } from "./geminiAgent";
import { generateDraftQuestions } from "./mistralAgent";
import { auditAndRefineQuestions } from "./qualityAgent";
import { GeneratedQuestionBatch } from "@/core/types";
import { BANK_SOAL_1 } from "../constants/bankSoal";

export type ProcessStage = 'IDLE' | 'FETCHING_CONTEXT' | 'GENERATING_CONTENT' | 'QUALITY_CONTROL' | 'COMPLETED' | 'ERROR';

export const runAgentWorkflow = async (
  input: string, // text search query
  categories: string[],
  isHots: boolean,
  selectedTopic?: string,
  useNews: boolean = true,
  onStatusUpdate?: (stage: ProcessStage) => void
): Promise<GeneratedQuestionBatch> => {
  
  try {
    // 1. AGENT A: SCOUT (Gemini)
    if (onStatusUpdate) onStatusUpdate('FETCHING_CONTEXT');
    let contextMaterial = "";
    
    if (!useNews) {
        // If not using news, use the bank soal as context
        contextMaterial = `Gunakan referensi gaya dan format dari Bank Soal berikut:\n\n${BANK_SOAL_1.substring(0, 15000)}`; // limit to avoid token issues
    } else {
        // If input is short (search query) or empty, we fetch news/context via Gemini.
        // If it's a long text pasted by user (> 200 chars), we use it directly as the context source.
        if (input.length > 200) {
            contextMaterial = input; 
        } else {
            // Pass the input as a query (e.g. "IKN" or "Korupsi Timah")
            // If input is empty, fetchNewsContext handles it by fetching trending news.
            contextMaterial = await fetchNewsContext(input);
        }
    }

    // 2. AGENT B: ARCHITECT (Mistral)
    if (onStatusUpdate) onStatusUpdate('GENERATING_CONTENT');
    const draftJson = await generateDraftQuestions(contextMaterial, categories, isHots, selectedTopic);

    // 3. AGENT C: AUDITOR (Xiaomi/Mimo)
    if (onStatusUpdate) onStatusUpdate('QUALITY_CONTROL');
    const finalBatch = await auditAndRefineQuestions(draftJson, selectedTopic);

    if (onStatusUpdate) onStatusUpdate('COMPLETED');
    return finalBatch;

  } catch (error) {
    if (onStatusUpdate) onStatusUpdate('ERROR');
    throw error;
  }
};
