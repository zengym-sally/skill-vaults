export enum DispatchMethod {
  Symlink = "symlink",
  Copy = "copy",
  Hardlink = "hardlink",
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
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTargetDir {
  [key: string]: unknown;
  name: string;
  path: string;
  description?: string | null;
}
