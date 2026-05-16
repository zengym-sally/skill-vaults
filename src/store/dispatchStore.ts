import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import {
  TargetDir,
  CreateTargetDir,
  Dispatch,
  SyncStatus,
  BulkDispatchResult,
  DispatchMethod,
  DispatchTemplate,
  CreateDispatchTemplateInput,
  UpdateDispatchTemplateInput,
} from "../types/dispatch";

export interface SyncTargetDirResult {
  synced: Dispatch[];
  failed: [string, string][];
}

interface DispatchStore {
  targetDirs: TargetDir[];
  dispatches: Dispatch[];
  templates: DispatchTemplate[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchTargetDirs: () => Promise<void>;
  fetchDispatches: () => Promise<void>;
  addTargetDir: (create: CreateTargetDir) => Promise<TargetDir>;
  deleteTargetDir: (id: string) => Promise<void>;
  checkDispatchSync: (dispatchId: string) => Promise<SyncStatus>;
  syncDispatchedSkill: (dispatchId: string) => Promise<Dispatch>;
  syncTargetDirDispatches: (
    targetDirId: string,
  ) => Promise<SyncTargetDirResult>;
  deleteDispatch: (dispatchId: string) => Promise<boolean>;
  bulkDispatch: (
    skillIds: string[],
    targetDirId: string,
    method: DispatchMethod,
  ) => Promise<BulkDispatchResult>;

  // Template actions
  fetchTemplates: () => Promise<void>;
  createTemplate: (
    input: CreateDispatchTemplateInput,
  ) => Promise<DispatchTemplate>;
  updateTemplate: (
    id: string,
    input: UpdateDispatchTemplateInput,
  ) => Promise<DispatchTemplate | null>;
  deleteTemplate: (id: string) => Promise<boolean>;
  dispatchTemplate: (
    templateId: string,
    targetDirId: string,
    method: DispatchMethod,
  ) => Promise<BulkDispatchResult>;

  clearError: () => void;
}

export const useDispatchStore = create<DispatchStore>((set, get) => ({
  targetDirs: [],
  dispatches: [],
  templates: [],
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

  syncTargetDirDispatches: async (targetDirId: string) => {
    set({ loading: true, error: null });
    try {
      const result = await invoke<SyncTargetDirResult>(
        "sync_target_dir_dispatches",
        { targetDirId },
      );
      await get().fetchDispatches();
      set({ loading: false });
      return result;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
      throw error;
    }
  },

  bulkDispatch: async (
    skillIds: string[],
    targetDirId: string,
    method: DispatchMethod,
  ) => {
    set({ loading: true, error: null });
    try {
      const result = await invoke<BulkDispatchResult>("bulk_dispatch", {
        skillIds,
        targetDirId,
        dispatchMethod: method,
      });
      // Refresh dispatches list to include new ones
      await get().fetchDispatches();
      set({ loading: false });
      return result;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
      throw error;
    }
  },

  // Template actions
  fetchTemplates: async () => {
    set({ loading: true, error: null });
    try {
      const templates = await invoke<DispatchTemplate[]>(
        "list_dispatch_templates",
      );
      set({ templates, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
      throw error;
    }
  },

  createTemplate: async (input: CreateDispatchTemplateInput) => {
    set({ loading: true, error: null });
    try {
      const template = await invoke<DispatchTemplate>(
        "create_dispatch_template",
        input,
      );
      await get().fetchTemplates();
      return template;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
      throw error;
    }
  },

  updateTemplate: async (id: string, input: UpdateDispatchTemplateInput) => {
    set({ loading: true, error: null });
    try {
      const template = await invoke<DispatchTemplate | null>(
        "update_dispatch_template",
        { id, ...input },
      );
      await get().fetchTemplates();
      return template;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
      throw error;
    }
  },

  deleteTemplate: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const success = await invoke<boolean>("delete_dispatch_template", { id });
      set((state) => ({
        templates: state.templates.filter((t) => t.id !== id),
        loading: false,
      }));
      return success;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
      throw error;
    }
  },

  dispatchTemplate: async (
    templateId: string,
    targetDirId: string,
    method: DispatchMethod,
  ) => {
    set({ loading: true, error: null });
    try {
      const result = await invoke<BulkDispatchResult>("dispatch_template_cmd", {
        templateId,
        targetDir: targetDirId,
        method,
      });
      // Refresh dispatches list to include new ones
      await get().fetchDispatches();
      set({ loading: false });
      return result;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
      throw error;
    }
  },

  deleteDispatch: async (dispatchId: string) => {
    set({ loading: true, error: null });
    try {
      const success = await invoke<boolean>("delete_dispatch", {
        dispatchId,
      });
      set((state) => ({
        dispatches: state.dispatches.filter((d) => d.id !== dispatchId),
        loading: false,
      }));
      return success;
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
