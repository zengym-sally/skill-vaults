export interface Repository {
  id: string;
  name: string;
  url?: string;
  path: string;
  source_type: string;
  local_path: string;
  auth_type?: string;
  auth_config?: string;
  branch?: string;
  skills_path: string;
  last_synced_at?: string;
  last_checked_at?: string;
  status: "pending" | "syncing" | "synced" | "error";
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRepositoryRequest {
  name: string;
  url?: string;
  path: string;
  source_type: string;
  local_path: string;
  auth_type?: string;
  auth_config?: string;
  branch?: string;
  skills_path?: string;
}
