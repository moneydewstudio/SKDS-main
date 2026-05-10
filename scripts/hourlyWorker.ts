#!/usr/bin/env node
import 'dotenv/config';
import { loadPipelines } from '../src/core/pipelineLoader';
import { selectPipelines, generateHourBucket, getDifficultyForHour } from '../src/core/router';
import { runPipeline, buildContext } from '../src/core/promptBuilder';
import { validateAndRefine } from '../src/core/qc';
import { saveBatchToNeon, checkHourExists } from '../src/core/neonWriter';
import { GeneratedQuestion, PipelineSpec } from '../src/core/types';

import { getMultiKeyClientStatus, resetFailedApiKeys } from '../src/core/promptBuilder';

interface WorkerOptions {
  force?: boolean;
  query?: string;
  hourOverride?: number;
  showStatus?: boolean;
  resetKeys?: boolean;
}

const runHourlyGeneration = async (options: WorkerOptions = {}): Promise<void> => {
  const startTime = Date.now();
  
  // Load environment variables
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const neonConnectionString = process.env.NEON_CONNECTION_STRING;
  
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY not set in environment');
  }
  
  if (!neonConnectionString) {
    throw new Error('NEON_CONNECTION_STRING not set in environment');
  }
  
  // Calculate hour bucket
  const hourBucket = options.hourOverride ?? generateHourBucket();
  console.log(`[Worker] Starting hourly generation for hour bucket: ${hourBucket}`);
  
  // Check idempotency (skip if already exists, unless force mode)
  if (!options.force) {
    const exists = await checkHourExists(neonConnectionString, hourBucket);
    if (exists) {
      console.log(`[Worker] Hour ${hourBucket} already processed. Skipping (use --force to override).`);
      process.exit(0);
    }
  } else {
    console.log(`[Worker] Force mode enabled - skipping idempotency check`);
  }
  
  // Load all pipelines
  console.log('[Worker] Loading pipelines...');
  const pipelines = loadPipelines('./pipelines');
  console.log(`[Worker] Loaded ${pipelines.length} pipelines`);
  
  if (pipelines.length === 0) {
    throw new Error('No pipelines found. Create pipeline JSONs in ./pipelines/');
  }
  
  // Select pipelines for this hour (1 TWK, 1 TIU, 1 TKP)
  console.log('[Worker] Selecting pipelines for this hour...');
  const selected = selectPipelines(hourBucket, pipelines);
  
  console.log(`[Worker] Selected:`);
  console.log(`  - TWK: ${selected.twk.id} (difficulty: ${getDifficultyForHour(hourBucket, selected.twk)})`);
  console.log(`  - TIU: ${selected.tiu.id} (difficulty: ${getDifficultyForHour(hourBucket, selected.tiu)})`);
  console.log(`  - TKP: ${selected.tkp.id} (difficulty: ${getDifficultyForHour(hourBucket, selected.tkp)})`);
  
  // Generate questions for each pipeline
  const allQuestions: GeneratedQuestion[] = [];
  
  const generateForPipeline = async (pipeline: PipelineSpec): Promise<GeneratedQuestion[]> => {
    console.log(`[Worker] Running pipeline: ${pipeline.id} (${pipeline.category})`);
    
    try {
      // Update difficulty based on schedule
      const difficulty = getDifficultyForHour(hourBucket, pipeline);
      const pipelineWithDifficulty = {
        ...pipeline,
        difficultySchedule: { [hourBucket % 24]: difficulty }
      };
      
      // Run pipeline to generate question
      const draft = await runPipeline(pipelineWithDifficulty, hourBucket, options.query);
      
      // Apply QC
      console.log(`[Worker] Applying QC for ${pipeline.id}...`);
      const refined = await validateAndRefine(draft, pipeline.id);
      
      return refined.questions || [];
    } catch (error) {
      console.error(`[Worker] Failed to generate for pipeline ${pipeline.id}:`, error);
      return [];
    }
  };
  
  // Run all three pipelines
  const [twkQuestions, tiuQuestions, tkpQuestions] = await Promise.all([
    generateForPipeline(selected.twk),
    generateForPipeline(selected.tiu),
    generateForPipeline(selected.tkp)
  ]);
  
  allQuestions.push(...twkQuestions, ...tiuQuestions, ...tkpQuestions);
  
  console.log(`[Worker] Generated ${allQuestions.length} questions total`);
  
  if (allQuestions.length === 0) {
    throw new Error('No questions generated from any pipeline');
  }
  
  // Save to Neon
  console.log('[Worker] Saving to Neon DB...');
  await saveBatchToNeon(neonConnectionString, allQuestions, hourBucket);
  
  const duration = (Date.now() - startTime) / 1000;
  console.log(`[Worker] Completed in ${duration}s. Saved ${allQuestions.length} questions.`);
};

// Parse CLI arguments
const parseArgs = (): WorkerOptions => {
  const args = process.argv.slice(2);
  return {
    force: args.includes('--force'),
    query: args.find(arg => arg.startsWith('--query='))?.split('=')[1],
    hourOverride: args.find(arg => arg.startsWith('--hour=')) 
      ? parseInt(args.find(arg => arg.startsWith('--hour='))!.split('=')[1], 10)
      : undefined,
    showStatus: args.includes('--status'),
    resetKeys: args.includes('--reset-keys'),
  };
};

// Main execution
if (require.main === module) {
  const options = parseArgs();
  
  // Handle status display
  if (options.showStatus) {
    try {
      const status = getMultiKeyClientStatus();
      console.log('\n[API Key Status]');
      status.forEach((key, idx) => {
        console.log(`  Key ${idx + 1}: ${key.key}`);
        console.log(`    Active: ${key.isActive}`);
        console.log(`    Failures: ${key.consecutiveFailures}`);
        console.log(`    Last Used: ${key.lastUsed ? new Date(key.lastUsed).toISOString() : 'Never'}`);
        if (key.lastError) console.log(`    Last Error: ${key.lastError}`);
      });
      process.exit(0);
    } catch (error: any) {
      console.error('[Worker] Failed to get status:', error.message);
      process.exit(1);
    }
  }
  
  // Handle key reset
  if (options.resetKeys) {
    try {
      resetFailedApiKeys();
      console.log('[Worker] All failed API keys have been reset');
      process.exit(0);
    } catch (error: any) {
      console.error('[Worker] Failed to reset keys:', error.message);
      process.exit(1);
    }
  }
  
  runHourlyGeneration(options)
    .then(() => {
      console.log('[Worker] Success');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Worker] Failed:', error.message);
      process.exit(1);
    });
}

export { runHourlyGeneration };
