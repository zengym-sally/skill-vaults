import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useDispatchStore } from "../dispatchStore";
import {
  TargetDir,
  Dispatch,
  SyncStatus,
  DispatchMethod,
  BulkDispatchResult,
  DispatchTemplate,
} from "../../types/dispatch";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("dispatchStore", () => {
  // Reset store and mocks before each test
  beforeEach(() => {
    useDispatchStore.setState({
      targetDirs: [],
      dispatches: [],
      templates: [],
      loading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const state = useDispatchStore.getState();
      expect(state.targetDirs).toEqual([]);
      expect(state.dispatches).toEqual([]);
      expect(state.templates).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("target directory management", () => {
    const mockTargetDirs: TargetDir[] = [
      {
        id: "1",
        name: "Project 1",
        path: "/projects/project1",
        description: "My main project",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "2",
        name: "Project 2",
        path: "/projects/project2",
        description: "Secondary project",
        created_at: "2024-01-02T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      },
    ];

    it("fetchTargetDirs should load target directories successfully", async () => {
      (invoke as vi.Mock).mockResolvedValue(mockTargetDirs);

      const stateBefore = useDispatchStore.getState();
      expect(stateBefore.loading).toBe(false);

      const promise = useDispatchStore.getState().fetchTargetDirs();
      expect(useDispatchStore.getState().loading).toBe(true);

      await promise;

      expect(invoke).toHaveBeenCalledWith("list_target_dirs");
      const state = useDispatchStore.getState();
      expect(state.targetDirs).toEqual(mockTargetDirs);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("fetchTargetDirs should handle errors correctly", async () => {
      const errorMessage = "Failed to load target directories";
      (invoke as vi.Mock).mockRejectedValue(new Error(errorMessage));

      await expect(
        useDispatchStore.getState().fetchTargetDirs(),
      ).rejects.toThrow(errorMessage);

      const state = useDispatchStore.getState();
      expect(state.targetDirs).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });

    it("addTargetDir should add a new target directory successfully", async () => {
      const newDirInput = {
        name: "New Project",
        path: "/projects/new",
        description: "Newly added project",
      };
      const newDir: TargetDir = {
        id: "3",
        ...newDirInput,
        created_at: "2024-01-03T00:00:00Z",
        updated_at: "2024-01-03T00:00:00Z",
      };

      (invoke as vi.Mock)
        .mockResolvedValueOnce(newDir) // add_target_dir
        .mockResolvedValueOnce([...mockTargetDirs, newDir]); // fetchTargetDirs

      const result = await useDispatchStore
        .getState()
        .addTargetDir(newDirInput);

      expect(invoke).toHaveBeenNthCalledWith(1, "add_target_dir", newDirInput);
      expect(invoke).toHaveBeenNthCalledWith(2, "list_target_dirs");
      expect(result).toEqual(newDir);
      const state = useDispatchStore.getState();
      expect(state.targetDirs).toEqual([...mockTargetDirs, newDir]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("addTargetDir should handle directory already exists error", async () => {
      const errorMessage = "Directory already exists at this path";
      (invoke as vi.Mock).mockRejectedValue(new Error(errorMessage));

      await expect(
        useDispatchStore.getState().addTargetDir({
          name: "Existing",
          path: "/existing/path",
        }),
      ).rejects.toThrow(errorMessage);

      const state = useDispatchStore.getState();
      expect(state.error).toBe(errorMessage);
      expect(state.loading).toBe(false);
    });

    it("deleteTargetDir should delete a target directory successfully", async () => {
      useDispatchStore.setState({ targetDirs: mockTargetDirs });
      (invoke as vi.Mock).mockResolvedValue(undefined);

      await useDispatchStore.getState().deleteTargetDir("1");

      expect(invoke).toHaveBeenCalledWith("delete_target_dir", { id: "1" });
      const state = useDispatchStore.getState();
      expect(state.targetDirs).toEqual([mockTargetDirs[1]]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("deleteTargetDir should handle non-existent directory error", async () => {
      const errorMessage = "Target directory not found";
      (invoke as vi.Mock).mockRejectedValue(new Error(errorMessage));

      await expect(
        useDispatchStore.getState().deleteTargetDir("999"),
      ).rejects.toThrow(errorMessage);

      const state = useDispatchStore.getState();
      expect(state.error).toBe(errorMessage);
      expect(state.loading).toBe(false);
    });
  });

  describe("dispatch management", () => {
    const mockDispatches: Dispatch[] = [
      {
        id: "d1",
        target_dir: "1",
        skill_id: "skill-1",
        method: DispatchMethod.Symlink,
        source_path: "/skills/skill1",
        dest_path: "/projects/project1/skills/skill1",
        dispatched_at: "2024-01-01T00:00:00Z",
        sync_status: SyncStatus.Synced,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "d2",
        target_dir: "1",
        skill_id: "skill-2",
        method: DispatchMethod.Copy,
        source_path: "/skills/skill2",
        dest_path: "/projects/project1/skills/skill2",
        dispatched_at: "2024-01-02T00:00:00Z",
        sync_status: SyncStatus.Outdated,
        created_at: "2024-01-02T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      },
    ];

    it("fetchDispatches should load dispatch history successfully", async () => {
      (invoke as vi.Mock).mockResolvedValue(mockDispatches);

      await useDispatchStore.getState().fetchDispatches();

      expect(invoke).toHaveBeenCalledWith("list_dispatches");
      const state = useDispatchStore.getState();
      expect(state.dispatches).toEqual(mockDispatches);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("checkDispatchSync should update sync status correctly", async () => {
      useDispatchStore.setState({ dispatches: mockDispatches });
      const newStatus = SyncStatus.Conflict;
      (invoke as vi.Mock).mockResolvedValue(newStatus);

      const result = await useDispatchStore.getState().checkDispatchSync("d2");

      expect(invoke).toHaveBeenCalledWith("check_dispatch_sync", {
        dispatchId: "d2",
      });
      expect(result).toBe(newStatus);
      const state = useDispatchStore.getState();
      expect(state.dispatches[1].sync_status).toBe(newStatus);
      expect(state.loading).toBe(false);
    });

    it("checkDispatchSync should handle sync check error", async () => {
      useDispatchStore.setState({ dispatches: mockDispatches });
      const errorMessage = "Failed to check sync status";
      (invoke as vi.Mock).mockRejectedValue(new Error(errorMessage));

      await expect(
        useDispatchStore.getState().checkDispatchSync("d1"),
      ).rejects.toThrow(errorMessage);

      const state = useDispatchStore.getState();
      expect(state.error).toBe(errorMessage);
      expect(state.dispatches[0].sync_status).toBe(SyncStatus.Synced); // Unchanged
    });

    it("syncDispatchedSkill should sync outdated skill successfully", async () => {
      useDispatchStore.setState({ dispatches: mockDispatches });
      const updatedDispatch: Dispatch = {
        ...mockDispatches[1],
        sync_status: SyncStatus.Synced,
        last_synced_at: "2024-01-03T00:00:00Z",
        updated_at: "2024-01-03T00:00:00Z",
      };
      (invoke as vi.Mock).mockResolvedValue(updatedDispatch);

      const result = await useDispatchStore
        .getState()
        .syncDispatchedSkill("d2");

      expect(invoke).toHaveBeenCalledWith("sync_dispatched_skill", {
        dispatchId: "d2",
      });
      expect(result).toEqual(updatedDispatch);
      const state = useDispatchStore.getState();
      expect(state.dispatches[1]).toEqual(updatedDispatch);
    });

    it("syncDispatchedSkill should handle sync conflict error", async () => {
      useDispatchStore.setState({ dispatches: mockDispatches });
      const errorMessage =
        "Sync conflict detected: file has been modified locally";
      (invoke as vi.Mock).mockRejectedValue(new Error(errorMessage));

      await expect(
        useDispatchStore.getState().syncDispatchedSkill("d2"),
      ).rejects.toThrow(errorMessage);

      const state = useDispatchStore.getState();
      expect(state.error).toBe(errorMessage);
      expect(state.dispatches[1].sync_status).toBe(SyncStatus.Outdated); // Unchanged
    });

    it("bulkDispatch should dispatch multiple skills successfully", async () => {
      const skillIds = ["skill-1", "skill-2", "skill-3"];
      const targetDirId = "1";
      const method = DispatchMethod.Symlink;
      const mockResult: BulkDispatchResult = {
        successful: [
          {
            id: "d3",
            target_dir: targetDirId,
            skill_id: "skill-3",
            method,
            source_path: "/skills/skill3",
            dest_path: "/projects/project1/skills/skill3",
            dispatched_at: "2024-01-03T00:00:00Z",
            sync_status: SyncStatus.Synced,
            created_at: "2024-01-03T00:00:00Z",
            updated_at: "2024-01-03T00:00:00Z",
          },
        ],
        errors: [
          ["skill-1", "Skill already dispatched to this directory"],
          ["skill-2", "Permission denied when writing to target directory"],
        ],
      };

      (invoke as vi.Mock)
        .mockResolvedValueOnce(mockResult) // bulk_dispatch
        .mockResolvedValueOnce([...mockDispatches, ...mockResult.successful]); // fetchDispatches

      const result = await useDispatchStore
        .getState()
        .bulkDispatch(skillIds, targetDirId, method);

      expect(invoke).toHaveBeenNthCalledWith(1, "bulk_dispatch", {
        skillIds,
        targetDirId,
        dispatchMethod: method,
      });
      expect(invoke).toHaveBeenNthCalledWith(2, "list_dispatches");
      expect(result).toEqual(mockResult);
      const state = useDispatchStore.getState();
      expect(state.dispatches).toHaveLength(3);
    });

    it("bulkDispatch should handle target directory not found error", async () => {
      const errorMessage = "Target directory not found";
      (invoke as vi.Mock).mockRejectedValue(new Error(errorMessage));

      await expect(
        useDispatchStore
          .getState()
          .bulkDispatch(["skill-1"], "999", DispatchMethod.Copy),
      ).rejects.toThrow(errorMessage);

      const state = useDispatchStore.getState();
      expect(state.error).toBe(errorMessage);
      expect(state.loading).toBe(false);
    });
  });

  describe("template management", () => {
    const mockTemplates: DispatchTemplate[] = [
      {
        id: "t1",
        name: "Frontend Stack",
        description: "Common frontend skills for React projects",
        skill_ids: JSON.stringify(["skill-1", "skill-2", "skill-3"]),
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "t2",
        name: "Backend Stack",
        description: "Backend skills for Node.js projects",
        skill_ids: JSON.stringify(["skill-4", "skill-5"]),
        created_at: "2024-01-02T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      },
    ];

    it("fetchTemplates should load templates successfully", async () => {
      (invoke as vi.Mock).mockResolvedValue(mockTemplates);

      await useDispatchStore.getState().fetchTemplates();

      expect(invoke).toHaveBeenCalledWith("list_dispatch_templates");
      const state = useDispatchStore.getState();
      expect(state.templates).toEqual(mockTemplates);
      expect(state.loading).toBe(false);
    });

    it("createTemplate should create a new template successfully", async () => {
      const input = {
        name: "Full Stack",
        description: "Full stack skill collection",
        skill_ids: ["skill-1", "skill-4"],
      };
      const newTemplate: DispatchTemplate = {
        id: "t3",
        ...input,
        skill_ids: JSON.stringify(input.skill_ids),
        created_at: "2024-01-03T00:00:00Z",
        updated_at: "2024-01-03T00:00:00Z",
      };

      (invoke as vi.Mock)
        .mockResolvedValueOnce(newTemplate) // create_dispatch_template
        .mockResolvedValueOnce([...mockTemplates, newTemplate]); // fetchTemplates

      const result = await useDispatchStore.getState().createTemplate(input);

      expect(invoke).toHaveBeenNthCalledWith(
        1,
        "create_dispatch_template",
        input,
      );
      expect(invoke).toHaveBeenNthCalledWith(2, "list_dispatch_templates");
      expect(result).toEqual(newTemplate);
      const state = useDispatchStore.getState();
      expect(state.templates).toEqual([...mockTemplates, newTemplate]);
    });

    it("updateTemplate should update an existing template successfully", async () => {
      useDispatchStore.setState({ templates: mockTemplates });
      const updateInput = {
        name: "Updated Frontend Stack",
        skill_ids: ["skill-1", "skill-2", "skill-6"],
      };
      const updatedTemplate: DispatchTemplate = {
        ...mockTemplates[0],
        ...updateInput,
        skill_ids: JSON.stringify(updateInput.skill_ids),
        updated_at: "2024-01-03T00:00:00Z",
      };

      (invoke as vi.Mock)
        .mockResolvedValueOnce(updatedTemplate) // update_dispatch_template
        .mockResolvedValueOnce([updatedTemplate, mockTemplates[1]]); // fetchTemplates

      const result = await useDispatchStore
        .getState()
        .updateTemplate("t1", updateInput);

      expect(invoke).toHaveBeenNthCalledWith(1, "update_dispatch_template", {
        id: "t1",
        ...updateInput,
      });
      expect(invoke).toHaveBeenNthCalledWith(2, "list_dispatch_templates");
      expect(result).toEqual(updatedTemplate);
      const state = useDispatchStore.getState();
      expect(state.templates[0]).toEqual(updatedTemplate);
    });

    it("updateTemplate should return null for non-existent template", async () => {
      (invoke as vi.Mock).mockResolvedValue(null);

      const result = await useDispatchStore.getState().updateTemplate("999", {
        name: "Non-existent",
      });

      expect(result).toBeNull();
    });

    it("deleteTemplate should delete a template successfully", async () => {
      useDispatchStore.setState({ templates: mockTemplates });
      (invoke as vi.Mock).mockResolvedValue(true);

      const result = await useDispatchStore.getState().deleteTemplate("t1");

      expect(invoke).toHaveBeenCalledWith("delete_dispatch_template", {
        id: "t1",
      });
      expect(result).toBe(true);
      const state = useDispatchStore.getState();
      expect(state.templates).toEqual([mockTemplates[1]]);
    });

    it("deleteTemplate should return false for non-existent template", async () => {
      (invoke as vi.Mock).mockResolvedValue(false);

      const result = await useDispatchStore.getState().deleteTemplate("999");

      expect(result).toBe(false);
    });

    it("dispatchTemplate should dispatch all skills in template successfully", async () => {
      const mockResult: BulkDispatchResult = {
        successful: [
          {
            id: "d3",
            target_dir: "1",
            skill_id: "skill-1",
            method: DispatchMethod.Copy,
            source_path: "/skills/skill1",
            dest_path: "/projects/project1/skills/skill1",
            dispatched_at: "2024-01-03T00:00:00Z",
            sync_status: SyncStatus.Synced,
            created_at: "2024-01-03T00:00:00Z",
            updated_at: "2024-01-03T00:00:00Z",
          },
          {
            id: "d4",
            target_dir: "1",
            skill_id: "skill-2",
            method: DispatchMethod.Copy,
            source_path: "/skills/skill2",
            dest_path: "/projects/project1/skills/skill2",
            dispatched_at: "2024-01-03T00:00:00Z",
            sync_status: SyncStatus.Synced,
            created_at: "2024-01-03T00:00:00Z",
            updated_at: "2024-01-03T00:00:00Z",
          },
        ],
        errors: [],
      };

      (invoke as vi.Mock)
        .mockResolvedValueOnce(mockResult) // dispatch_template
        .mockResolvedValueOnce(mockResult.successful); // fetchDispatches

      const result = await useDispatchStore
        .getState()
        .dispatchTemplate("t1", "1", DispatchMethod.Copy);

      expect(invoke).toHaveBeenNthCalledWith(1, "dispatch_template", {
        templateId: "t1",
        targetDir: "1",
        method: DispatchMethod.Copy,
      });
      expect(invoke).toHaveBeenNthCalledWith(2, "list_dispatches");
      expect(result).toEqual(mockResult);
      const state = useDispatchStore.getState();
      expect(state.dispatches).toEqual(mockResult.successful);
    });
  });

  describe("utility actions", () => {
    it("clearError should clear error state", () => {
      useDispatchStore.setState({ error: "Some error occurred" });

      useDispatchStore.getState().clearError();

      const state = useDispatchStore.getState();
      expect(state.error).toBeNull();
    });

    it("should correctly handle loading state during async operations", async () => {
      (invoke as vi.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 10)),
      );

      const promise = useDispatchStore.getState().fetchTargetDirs();
      expect(useDispatchStore.getState().loading).toBe(true);

      await promise;
      expect(useDispatchStore.getState().loading).toBe(false);
    });
  });
});
