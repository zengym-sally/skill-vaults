import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { LLMConfig } from "../types/llm";
import { GitConfig } from "../types/git";

export interface SyncConfig {
  autoSyncEnabled: boolean;
  syncInterval: "daily" | "weekly" | "monthly" | "never";
}

interface SettingsState {
  llmConfig: LLMConfig | null;
  gitConfig: GitConfig | null;
  syncConfig: SyncConfig | null;
  isLoading: boolean;
  error: string | null;
  loadLLMConfig: () => Promise<void>;
  saveLLMConfig: (config: LLMConfig) => Promise<void>;
  loadGitConfig: () => Promise<void>;
  saveGitConfig: (config: GitConfig) => Promise<void>;
  loadSyncConfig: () => Promise<void>;
  saveSyncConfig: (config: SyncConfig) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  llmConfig: null,
  gitConfig: null,
  syncConfig: null,
  isLoading: false,
  error: null,

  loadLLMConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const apiKey = await invoke<string>("get_config", {
        key: "llm.openai.api_key",
      }).catch(() => null);
      const baseUrl = await invoke<string>("get_config", {
        key: "llm.openai.base_url",
      }).catch(() => null);
      const model = await invoke<string>("get_config", {
        key: "llm.openai.model",
      }).catch(() => "gpt-4o");

      if (apiKey) {
        set({
          llmConfig: {
            apiKey,
            baseUrl: baseUrl || undefined,
            model: model || "gpt-4o",
          },
        });
      }
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  saveLLMConfig: async (config: LLMConfig) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("set_config", {
        key: "llm.openai.api_key",
        value: config.apiKey,
      });
      if (config.baseUrl) {
        await invoke("set_config", {
          key: "llm.openai.base_url",
          value: config.baseUrl,
        });
      } else {
        await invoke("delete_config", { key: "llm.openai.base_url" });
      }
      await invoke("set_config", {
        key: "llm.openai.model",
        value: config.model,
      });

      set({ llmConfig: config });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  loadGitConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await invoke<{
        username: string | null;
        email: string | null;
        sshKeyPath: string | null;
      }>("get_git_config");

      set({
        gitConfig: {
          username: config.username || "",
          email: config.email || "",
          sshKeyPath: config.sshKeyPath || undefined,
        },
      });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  saveGitConfig: async (config: GitConfig) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("save_git_config", {
        username: config.username,
        email: config.email,
        sshKeyPath: config.sshKeyPath,
      });

      set({ gitConfig: config });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  loadSyncConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await invoke<{
        autoSyncEnabled: boolean;
        syncInterval: "daily" | "weekly" | "monthly" | "never";
      }>("get_sync_config");

      set({
        syncConfig: {
          autoSyncEnabled: config.autoSyncEnabled,
          syncInterval: config.syncInterval,
        },
      });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  saveSyncConfig: async (config: SyncConfig) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("save_sync_config", {
        autoSyncEnabled: config.autoSyncEnabled,
        syncInterval: config.syncInterval,
      });

      set({ syncConfig: config });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
}));
