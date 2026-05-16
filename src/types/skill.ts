export interface Skill {
  id: string;
  name: string;
  type: string;
  sourceType: string;
  repositoryId?: string;
  localPath: string;
  description?: string;
  aiSummary?: string;
  usage?: string;
  tags: string[];
  dependencies: string[];
  llmAnalyzed: boolean;
  qualityScore?: number;
  status: "active" | "archived" | "broken";
  firstDiscoveredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  dispatchCount: number;
  repositoryName?: string;
}

export interface CreateSkill {
  name: string;
  type: string;
  sourceType: string;
  repositoryId?: string;
  localPath: string;
  description?: string;
  usage?: string;
  tags: string[];
  dependencies: string[];
  llmAnalyzed?: boolean;
  qualityScore?: number;
  status: "active" | "archived" | "broken";
}

export interface UpdateSkill {
  name?: string;
  type?: string;
  sourceType?: string;
  repositoryId?: string;
  localPath?: string;
  description?: string;
  aiSummary?: string;
  usage?: string;
  tags?: string[];
  dependencies?: string[];
  llmAnalyzed?: boolean;
  qualityScore?: number;
  status?: "active" | "archived" | "broken";
}
