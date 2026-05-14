import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { TargetDir, CreateTargetDir } from "../types/dispatch";

interface DispatchStore {
  targetDirs: TargetDir[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchTargetDirs: () => Promise<void>;
  addTargetDir: (create: CreateTargetDir) => Promise<TargetDir>;
  deleteTargetDir: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useDispatchStore = create<DispatchStore>((set, get) => ({
  targetDirs: [],
  loading: false,
  error: null,

  fetchTargetDirs: async () => {
    set({ loading: true, error: null });
    try {
      const targetDirs = await invoke<TargetDir[]>("list_target_dirs");
      set({ targetDirs, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
      throw error;
    }
  },

  addTargetDir: async (create: CreateTargetDir) => {
    set({ loading: true, error: null });
    try {
      const targetDir = await invoke<TargetDir>("add_target_dir", create);
      await get().fetchTargetDirs();
      return targetDir;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
      throw error;
    }
  },

  deleteTargetDir: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await invoke("delete_target_dir", { id });
      set((state) => ({
        targetDirs: state.targetDirs.filter((dir) => dir.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
