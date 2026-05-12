#!/usr/bin/env node
import 'dotenv/config';
import { saveBatchToNeon } from '../src/core/neonWriter';
import { GeneratedQuestion } from '../src/core/types';

const testQuestion: GeneratedQuestion = {
  meta: {
    news_topic: 'Test',
    question_type: 'single_correct',
    subtopic_code: 'test-subtopic',
    theme_code: 'test-theme'
  },
  content: {
    category: 'TIU',
    topic: 'Numerik',
    subtopic: 'Aritmatika',
    question_text: 'Test question?',
    options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D', E: 'Option E' },
    answer_key: { correct_option: 'A' },
    explanation: 'Test explanation',
    difficulty: 3
  }
};

const run = async () => {
  const conn = process.env.NEON_CONNECTION_STRING;
  if (!conn) {
    console.error('NEON_CONNECTION_STRING not set');
    process.exit(1);
  }
  
  console.log('Testing DB insert...');
  try {
    await saveBatchToNeon(conn, [testQuestion], 999999);
    console.log('SUCCESS: Question saved');
  } catch (e: any) {
    console.error('FAILED:', e.message);
    console.error(e.stack);
  }
};

run();
