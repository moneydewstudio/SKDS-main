import { PipelineSpec, RouterConfig } from './types';

export interface SelectedPipelines {
  twk: PipelineSpec;
  tiu: PipelineSpec;
  tkp: PipelineSpec;
}

export const groupPipelinesByCategory = (pipelines: PipelineSpec[]): RouterConfig => {
  return {
    twk: pipelines.filter(p => p.category === 'TWK'),
    tiu: pipelines.filter(p => p.category === 'TIU'),
    tkp: pipelines.filter(p => p.category === 'TKP'),
  };
};

export const selectPipelines = (epochHour: number, pipelines: PipelineSpec[]): SelectedPipelines => {
  const byCategory = groupPipelinesByCategory(pipelines);
  
  // Ensure we have pipelines in each category
  if (byCategory.twk.length === 0) throw new Error('No TWK pipelines available');
  if (byCategory.tiu.length === 0) throw new Error('No TIU pipelines available');
  if (byCategory.tkp.length === 0) throw new Error('No TKP pipelines available');
  
  return {
    twk: byCategory.twk[epochHour % byCategory.twk.length],
    tiu: byCategory.tiu[epochHour % byCategory.tiu.length],
    tkp: byCategory.tkp[epochHour % byCategory.tkp.length],
  };
};

export const getDifficultyForHour = (
  epochHour: number, 
  pipeline: PipelineSpec
): number => {
  const scheduleKeys = Object.keys(pipeline.difficultySchedule).map(Number).sort((a, b) => a - b);
  
  if (scheduleKeys.length === 0) {
    return 3; // Default difficulty
  }
  
  // Use modulo to cycle through the schedule
  const scheduleIndex = epochHour % scheduleKeys.length;
  const selectedKey = scheduleKeys[scheduleIndex];
  
  return pipeline.difficultySchedule[selectedKey] ?? 3;
};

export const generateHourBucket = (date: Date = new Date()): number => {
  return Math.floor(date.getTime() / 3600000);
};
