import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { LLMConfig } from "../types/llm";

interface SettingsState {
  llmConfig: LLMConfig | null;
  isLoading: boolean;
  error: string | null;
  loadLLMConfig: () => Promise<void>;
  saveLLMConfig: (config: LLMConfig) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  llmConfig: null,
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
}));
