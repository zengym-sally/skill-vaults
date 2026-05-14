import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { Skill, UpdateSkill } from "../types/skill";

interface SkillStore {
  skills: Skill[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  filters: {
    type?: string;
    status?: string;
    sourceType?: string;
  };

  // Actions
  fetchSkills: (options?: {
    search?: string;
    type?: string;
    status?: string;
    sourceType?: string;
  }) => Promise<void>;
  updateSkill: (id: string, update: UpdateSkill) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
  discoverSkills: (options?: {
    repositoryId?: string;
    force?: boolean;
  }) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setFilters: (
    filters: Partial<{
      type?: string;
      status?: string;
      sourceType?: string;
    }>,
  ) => void;
  clearError: () => void;
}

export const useSkillStore = create<SkillStore>((set, get) => ({
  skills: [],
  loading: false,
  error: null,
  searchQuery: "",
  filters: {},

  fetchSkills: async (options) => {
    set({ loading: true, error: null });
    try {
      const skills = await invoke<Skill[]>("list_skills", {
        options: options || {
          search: get().searchQuery,
          ...get().filters,
        },
      });
      set({ skills, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
    }
  },

  updateSkill: async (id: string, update: UpdateSkill) => {
    set({ loading: true, error: null });
    try {
      await invoke("update_skill_command", { id, update });
      await get().fetchSkills();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
      throw error;
    }
  },

  deleteSkill: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await invoke("delete_skill_command", { id });
      set((state) => ({
        skills: state.skills.filter((skill) => skill.id !== id),
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

  discoverSkills: async (options) => {
    set({ loading: true, error: null });
    try {
      await invoke("discover_skills", { options });
      await get().fetchSkills();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
      throw error;
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  clearError: () => {
    set({ error: null });
  },
}));
