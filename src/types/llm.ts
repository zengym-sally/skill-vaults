export interface LLMConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export interface SkillAnalysisResult {
  skillType: string;
  description: string;
  usageInstructions: string;
  tags: string[];
  dependencies: string[];
  qualityScore: number;
}
