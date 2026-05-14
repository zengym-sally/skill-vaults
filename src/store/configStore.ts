import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { ConfigStore } from "../types/config";

export const useConfigStore = create<ConfigStore>((set) => ({
  basePath: null,
  isLoading: false,
  error: null,

  getBasePath: async () => {
    set({ isLoading: true, error: null });
    try {
      const basePath = await invoke<string | null>("get_base_path_command");
      set({ basePath, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to get base path";
      set({
        error: message,
        isLoading: false,
      });
      toast.error(message);
    }
  },

  setBasePath: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("set_base_path_command", { path });
      set({ basePath: path, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to set base path";
      set({
        error: message,
        isLoading: false,
      });
      toast.error(message);
      throw error;
    }
  },

  initBaseDirectory: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("init_base_directory_command", { path });
      set({ isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to initialize directory";
      set({
        error: message,
        isLoading: false,
      });
      toast.error(message);
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
