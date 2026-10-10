export interface HealthResponse {
  status: 'ok';
}

export const API_PREFIX = 'api/v1';

export * from './onboarding';
export * from './auth';
export * from './station';
export * from './dialogue/language';
export * from './dialogue/metadata';
export * from './dialogue/questions';
export * from './content';
export * from './quests';
export * from './conversations';
