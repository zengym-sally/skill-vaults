import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import {
  TargetDir,
  CreateTargetDir,
  Dispatch,
  SyncStatus,
} from "../types/dispatch";

interface DispatchStore {
  targetDirs: TargetDir[];
  dispatches: Dispatch[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchTargetDirs: () => Promise<void>;
  fetchDispatches: () => Promise<void>;
  addTargetDir: (create: CreateTargetDir) => Promise<TargetDir>;
  deleteTargetDir: (id: string) => Promise<void>;
  checkDispatchSync: (dispatchId: string) => Promise<SyncStatus>;
  syncDispatchedSkill: (dispatchId: string) => Promise<Dispatch>;
  clearError: () => void;
}

export const useDispatchStore = create<DispatchStore>((set, get) => ({
  targetDirs: [],
  dispatches: [],
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

  fetchDispatches: async () => {
    set({ loading: true, error: null });
    try {
      const dispatches = await invoke<Dispatch[]>("list_dispatches");
      set({ dispatches, loading: false });
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

  checkDispatchSync: async (dispatchId: string) => {
    set({ loading: true, error: null });
    try {
      const status = await invoke<SyncStatus>("check_dispatch_sync", {
        dispatchId,
      });
      set((state) => ({
        dispatches: state.dispatches.map((dispatch) =>
          dispatch.id === dispatchId
            ? { ...dispatch, sync_status: status }
            : dispatch,
        ),
        loading: false,
      }));
      return status;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
      throw error;
    }
  },

  syncDispatchedSkill: async (dispatchId: string) => {
    set({ loading: true, error: null });
    try {
      const updatedDispatch = await invoke<Dispatch>("sync_dispatched_skill", {
        dispatchId,
      });
      set((state) => ({
        dispatches: state.dispatches.map((dispatch) =>
          dispatch.id === dispatchId ? updatedDispatch : dispatch,
        ),
        loading: false,
      }));
      return updatedDispatch;
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
