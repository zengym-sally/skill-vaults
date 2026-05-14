import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Repository, CreateRepositoryRequest } from "../types/repository";

interface RepositoryState {
  repositories: Repository[];
  loading: boolean;
  error: string | null;
  getRepositories: () => Promise<void>;
  getRepository: (id: string) => Promise<Repository | null>;
  addRepository: (data: CreateRepositoryRequest) => Promise<Repository>;
  deleteRepository: (id: string) => Promise<void>;
  syncRepository: (id: string) => Promise<Repository>;
  syncAllRepositories: () => Promise<Repository[]>;
  clearError: () => void;
}

export const useRepositoryStore = create<RepositoryState>((set) => ({
  repositories: [],
  loading: false,
  error: null,

  getRepositories: async () => {
    set({ loading: true, error: null });
    try {
      const repositories = await invoke<Repository[]>("list_repositories");
      set({ repositories, loading: false });
    } catch (error) {
      const message = (error as Error).message;
      set({ error: message, loading: false });
      toast.error(message);
      throw error;
    }
  },

  getRepository: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const repository = await invoke<Repository | null>("get_repository", {
        id,
      });
      set({ loading: false });
      return repository;
    } catch (error) {
      const message = (error as Error).message;
      set({ error: message, loading: false });
      toast.error(message);
      throw error;
    }
  },

  addRepository: async (data: CreateRepositoryRequest) => {
    set({ loading: true, error: null });
    try {
      const repository = await invoke<Repository>("add_repository", {
        ...data,
      });
      set((state) => ({
        repositories: [...state.repositories, repository],
        loading: false,
      }));
      return repository;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  deleteRepository: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await invoke("delete_repository", { id });
      set((state) => ({
        repositories: state.repositories.filter((repo) => repo.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  syncRepository: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const updatedRepo = await invoke<Repository>("sync_repository", { id });
      set((state) => ({
        repositories: state.repositories.map((repo) =>
          repo.id === id ? updatedRepo : repo,
        ),
        loading: false,
      }));
      return updatedRepo;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  syncAllRepositories: async () => {
    set({ loading: true, error: null });
    try {
      const updatedRepos = await invoke<Repository[]>("sync_all_repositories");
      set({ repositories: updatedRepos, loading: false });
      return updatedRepos;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
