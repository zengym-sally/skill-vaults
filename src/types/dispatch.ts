export enum DispatchMethod {
  Symlink = "symlink",
  Copy = "copy",
}

export function parseDispatchMethod(value: string): DispatchMethod {
  if (Object.values(DispatchMethod).includes(value as DispatchMethod)) {
    return value as DispatchMethod;
  }
  return DispatchMethod.Symlink;
}

export enum SyncStatus {
  Synced = "synced",
  Outdated = "outdated",
  Conflict = "conflict",
  Error = "error",
}

export interface Dispatch {
  id: string;
  target_dir: string;
  skill_id: string;
  method: DispatchMethod;
  source_path: string;
  dest_path: string;
  dispatched_at: string;
  last_synced_at?: string | null;
  sync_status: SyncStatus;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TargetDir {
  id: string;
  name: string;
  path: string;
  skillsSubdir: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTargetDir {
  [key: string]: unknown;
  name: string;
  path: string;
  skillsSubdir?: string;
  description?: string | null;
}

export interface BulkDispatchResult {
  successful: Dispatch[];
  errors: [string, string][]; // [skill_id, error_message]
}

export interface DispatchTemplate {
  id: string;
  name: string;
  description?: string | null;
  skill_ids: string; // JSON string of skill IDs array
  created_at: string;
  updated_at: string;
}

export interface CreateDispatchTemplateInput {
  [key: string]: unknown;
  name: string;
  description?: string | null;
  skillIds: string[];
}

export interface UpdateDispatchTemplateInput {
  name?: string | null;
  description?: string | null;
  skillIds?: string[] | null;
}
