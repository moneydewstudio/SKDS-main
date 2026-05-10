import { PipelineSpec } from './types';
import * as fs from 'fs';
import * as path from 'path';

export const loadPipelines = (pipelinesDir: string, examplesDir?: string): PipelineSpec[] => {
  const pipelines: PipelineSpec[] = [];
  
  const categories = ['twk', 'tiu', 'tkp'];
  
  // Default examples directory is sibling of pipelines
  const baseDir = path.dirname(pipelinesDir);
  const examplesRoot = examplesDir || path.join(baseDir, 'examples');
  
  for (const category of categories) {
    const categoryPath = path.join(pipelinesDir, category);
    
    if (!fs.existsSync(categoryPath)) {
      console.warn(`Pipeline directory not found: ${categoryPath}`);
      continue;
    }
    
    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      try {
        const spec: PipelineSpec = JSON.parse(content);
        
        // Validate required fields
        if (!spec.id || !spec.category || !spec.topic) {
          console.warn(`Invalid pipeline spec in ${filePath}: missing required fields`);
          continue;
        }
        
        // Ensure category matches directory
        if (spec.category.toLowerCase() !== category) {
          console.warn(`Category mismatch in ${filePath}: ${spec.category} vs ${category}`);
        }
        
        // Load external examples if inline examples are empty and examplesFile is specified
        if ((!spec.examples || spec.examples.length === 0) && spec.examplesFile) {
          const examplesPath = path.join(examplesRoot, category, spec.examplesFile);
          if (fs.existsSync(examplesPath)) {
            try {
              const examplesContent = fs.readFileSync(examplesPath, 'utf-8');
              spec.examples = JSON.parse(examplesContent);
              console.log(`Loaded ${spec.examples.length} examples from ${examplesPath} for ${spec.id}`);
            } catch (e) {
              console.error(`Failed to load examples from ${examplesPath}:`, e);
            }
          } else {
            console.warn(`Examples file not found: ${examplesPath}`);
          }
        }
        
        pipelines.push(spec);
      } catch (e) {
        console.error(`Failed to parse pipeline ${filePath}:`, e);
      }
    }
  }
  
  return pipelines;
};

export const validatePipeline = (spec: PipelineSpec): string[] => {
  const errors: string[] = [];
  
  if (!spec.id) errors.push('Missing id');
  if (!spec.category || !['TWK', 'TIU', 'TKP'].includes(spec.category)) {
    errors.push('Invalid or missing category (must be TWK, TIU, or TKP)');
  }
  if (!spec.topic) errors.push('Missing topic');
  if (!spec.subtopic) errors.push('Missing subtopic');
  if (!spec.syllabus) errors.push('Missing syllabus');
  if (!spec.promptTemplate) errors.push('Missing promptTemplate');
  if (!spec.contextSource || !['news', 'bank', 'syllabus'].includes(spec.contextSource)) {
    errors.push('Invalid or missing contextSource');
  }
  // Allow either inline examples or external examplesFile reference
  const hasInlineExamples = spec.examples && spec.examples.length > 0;
  const hasExternalExamples = spec.examplesFile && spec.examplesFile.length > 0;
  if (!hasInlineExamples && !hasExternalExamples) {
    errors.push('Missing examples (provide inline examples[] or examplesFile path)');
  }
  if (!spec.difficultySchedule || Object.keys(spec.difficultySchedule).length === 0) {
    errors.push('Missing or empty difficultySchedule');
  }
  
  return errors;
};
