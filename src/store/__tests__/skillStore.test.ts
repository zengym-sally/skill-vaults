import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSkillStore } from "../skillStore";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { Skill, UpdateSkill } from "../../types/skill";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// 测试数据
const mockSkills: Skill[] = [
  {
    id: "skill-1",
    name: "Test Skill 1",
    type: "utility",
    sourceType: "local",
    localPath: "/path/to/skill1",
    description: "Test skill 1 description",
    tags: ["test", "utility"],
    dependencies: [],
    llmAnalyzed: true,
    qualityScore: 0.8,
    status: "active",
    firstDiscoveredAt: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: "skill-2",
    name: "Test Skill 2",
    type: "workflow",
    sourceType: "git",
    repositoryId: "repo-1",
    localPath: "/path/to/skill2",
    description: "Test skill 2 description",
    tags: ["test", "workflow"],
    dependencies: ["skill-1"],
    llmAnalyzed: false,
    status: "active",
    firstDiscoveredAt: new Date("2024-01-02"),
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-02"),
  },
];

describe("skillStore", () => {
  beforeEach(() => {
    // 重置 store 状态
    useSkillStore.setState({
      skills: [],
      loading: false,
      error: null,
      searchQuery: "",
      filters: {},
    });

    // 清除所有 mock 调用
    vi.clearAllMocks();
  });

  describe("初始状态", () => {
    it("应该有正确的初始状态", () => {
      const state = useSkillStore.getState();
      expect(state.skills).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.searchQuery).toBe("");
      expect(state.filters).toEqual({});
    });
  });

  describe("fetchSkills", () => {
    it("应该正确获取技能列表并更新状态", async () => {
      // Mock invoke 返回数据
      (invoke as vi.Mock).mockResolvedValueOnce(mockSkills);

      const state = useSkillStore.getState();
      await state.fetchSkills();

      // 验证 invoke 调用
      expect(invoke).toHaveBeenCalledWith("list_skills", {
        options: {
          search: "",
        },
      });

      // 验证状态更新
      const newState = useSkillStore.getState();
      expect(newState.loading).toBe(false);
      expect(newState.error).toBeNull();
      expect(newState.skills).toEqual(mockSkills);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("应该使用自定义参数获取技能列表", async () => {
      (invoke as vi.Mock).mockResolvedValueOnce([mockSkills[0]]);

      const state = useSkillStore.getState();
      await state.fetchSkills({
        search: "skill 1",
        type: "utility",
        status: "active",
        sourceType: "local",
      });

      expect(invoke).toHaveBeenCalledWith("list_skills", {
        options: {
          search: "skill 1",
          type: "utility",
          status: "active",
          sourceType: "local",
        },
      });

      const newState = useSkillStore.getState();
      expect(newState.skills).toEqual([mockSkills[0]]);
    });

    it("当没有传入options时应该使用store中的搜索和过滤条件", async () => {
      // 先设置搜索和过滤条件
      useSkillStore.setState({
        searchQuery: "test query",
        filters: {
          type: "workflow",
          status: "archived",
        },
      });

      (invoke as vi.Mock).mockResolvedValueOnce([mockSkills[1]]);

      const state = useSkillStore.getState();
      await state.fetchSkills();

      expect(invoke).toHaveBeenCalledWith("list_skills", {
        options: {
          search: "test query",
          type: "workflow",
          status: "archived",
        },
      });
    });

    it("应该正确处理API错误并显示toast", async () => {
      const errorMessage = "Failed to fetch skills";
      (invoke as vi.Mock).mockRejectedValueOnce(new Error(errorMessage));

      const state = useSkillStore.getState();
      await state.fetchSkills();

      expect(invoke).toHaveBeenCalledWith("list_skills", expect.anything());

      const newState = useSkillStore.getState();
      expect(newState.loading).toBe(false);
      expect(newState.error).toBe(errorMessage);
      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });

    it("应该正确处理空返回结果", async () => {
      (invoke as vi.Mock).mockResolvedValueOnce([]);

      const state = useSkillStore.getState();
      await state.fetchSkills();

      const newState = useSkillStore.getState();
      expect(newState.skills).toEqual([]);
      expect(newState.loading).toBe(false);
      expect(newState.error).toBeNull();
    });

    it("应该正确处理loading状态", async () => {
      // 使用一个延迟的Promise来测试loading状态
      let resolvePromise: (value: Skill[]) => void;
      const promise = new Promise<Skill[]>((resolve) => {
        resolvePromise = resolve;
      });
      (invoke as vi.Mock).mockReturnValueOnce(promise);

      const state = useSkillStore.getState();
      const fetchPromise = state.fetchSkills();

      // 调用后立即检查loading状态
      expect(useSkillStore.getState().loading).toBe(true);

      // 解析Promise
      resolvePromise!(mockSkills);
      await fetchPromise;

      // 完成后loading应该为false
      expect(useSkillStore.getState().loading).toBe(false);
    });
  });

  describe("updateSkill", () => {
    it("应该正确更新技能并重新获取列表", async () => {
      // Mock 初始数据
      (invoke as vi.Mock)
        .mockResolvedValueOnce(undefined) // update_skill_command 调用
        .mockResolvedValueOnce(mockSkills); // 后续的 fetchSkills 调用

      // 先设置初始数据
      useSkillStore.setState({ skills: mockSkills });

      const updateData: UpdateSkill = {
        name: "Updated Skill Name",
        status: "archived",
      };

      const state = useSkillStore.getState();
      await state.updateSkill("skill-1", updateData);

      // 验证update调用
      expect(invoke).toHaveBeenNthCalledWith(1, "update_skill_command", {
        id: "skill-1",
        update: updateData,
      });

      // 验证后续调用了fetchSkills
      expect(invoke).toHaveBeenNthCalledWith(
        2,
        "list_skills",
        expect.anything(),
      );

      expect(toast.error).not.toHaveBeenCalled();
    });

    it("应该正确处理更新失败的情况", async () => {
      const errorMessage = "Failed to update skill";
      (invoke as vi.Mock).mockRejectedValueOnce(new Error(errorMessage));

      const state = useSkillStore.getState();

      await expect(
        state.updateSkill("skill-1", { name: "Test" }),
      ).rejects.toThrow(errorMessage);

      const newState = useSkillStore.getState();
      expect(newState.loading).toBe(false);
      expect(newState.error).toBe(errorMessage);
      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });
  });

  describe("deleteSkill", () => {
    it("应该正确删除技能并更新列表", async () => {
      (invoke as vi.Mock).mockResolvedValueOnce(undefined);

      // 先设置初始数据
      useSkillStore.setState({ skills: mockSkills });

      const state = useSkillStore.getState();
      await state.deleteSkill("skill-1");

      // 验证delete调用
      expect(invoke).toHaveBeenCalledWith("delete_skill_command", {
        id: "skill-1",
      });

      // 验证状态更新 - skill-1应该被删除
      const newState = useSkillStore.getState();
      expect(newState.skills).toHaveLength(1);
      expect(newState.skills[0].id).toBe("skill-2");
      expect(newState.loading).toBe(false);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("应该正确处理删除失败的情况", async () => {
      const errorMessage = "Failed to delete skill";
      (invoke as vi.Mock).mockRejectedValueOnce(new Error(errorMessage));

      // 先设置初始数据
      useSkillStore.setState({ skills: mockSkills });

      const state = useSkillStore.getState();

      await expect(state.deleteSkill("skill-1")).rejects.toThrow(errorMessage);

      // 验证技能列表没有变化
      const newState = useSkillStore.getState();
      expect(newState.skills).toEqual(mockSkills);
      expect(newState.loading).toBe(false);
      expect(newState.error).toBe(errorMessage);
      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });
  });

  describe("discoverSkills", () => {
    it("应该正确触发技能发现并重新获取列表", async () => {
      (invoke as vi.Mock)
        .mockResolvedValueOnce(undefined) // discover_skills 调用
        .mockResolvedValueOnce(mockSkills); // 后续的 fetchSkills 调用

      const state = useSkillStore.getState();
      await state.discoverSkills({
        repositoryId: "repo-1",
        force: true,
      });

      // 验证discover调用
      expect(invoke).toHaveBeenNthCalledWith(1, "discover_skills", {
        options: {
          repositoryId: "repo-1",
          force: true,
        },
      });

      // 验证后续调用了fetchSkills
      expect(invoke).toHaveBeenNthCalledWith(
        2,
        "list_skills",
        expect.anything(),
      );
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("当没有传入options时应该正确调用", async () => {
      (invoke as vi.Mock)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(mockSkills);

      const state = useSkillStore.getState();
      await state.discoverSkills();

      expect(invoke).toHaveBeenNthCalledWith(1, "discover_skills", {
        options: undefined,
      });
    });

    it("应该正确处理发现失败的情况", async () => {
      const errorMessage = "Failed to discover skills";
      (invoke as vi.Mock).mockRejectedValueOnce(new Error(errorMessage));

      const state = useSkillStore.getState();

      await expect(state.discoverSkills()).rejects.toThrow(errorMessage);

      const newState = useSkillStore.getState();
      expect(newState.loading).toBe(false);
      expect(newState.error).toBe(errorMessage);
      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });
  });

  describe("同步方法", () => {
    it("setSearchQuery应该正确更新搜索查询", () => {
      const state = useSkillStore.getState();
      state.setSearchQuery("new search query");

      const newState = useSkillStore.getState();
      expect(newState.searchQuery).toBe("new search query");
    });

    it("setFilters应该正确更新过滤条件", () => {
      const state = useSkillStore.getState();
      state.setFilters({
        type: "utility",
        status: "active",
      });

      let newState = useSkillStore.getState();
      expect(newState.filters).toEqual({
        type: "utility",
        status: "active",
      });

      // 测试部分更新
      state.setFilters({
        sourceType: "git",
      });

      newState = useSkillStore.getState();
      expect(newState.filters).toEqual({
        type: "utility",
        status: "active",
        sourceType: "git",
      });
    });

    it("clearError应该正确清除错误信息", () => {
      // 先设置一个错误
      useSkillStore.setState({ error: "Some error message" });

      const state = useSkillStore.getState();
      state.clearError();

      const newState = useSkillStore.getState();
      expect(newState.error).toBeNull();
    });
  });

  describe("边缘场景", () => {
    it("重复调用时应该正确处理loading状态", async () => {
      // 两个调用都使用同一个 resolved mock
      (invoke as vi.Mock).mockResolvedValue(mockSkills);

      const state = useSkillStore.getState();

      // 发起第一个调用
      const promise1 = state.fetchSkills();
      expect(useSkillStore.getState().loading).toBe(true);

      // 等待完成
      await promise1;

      // 完成后 loading 为 false
      expect(useSkillStore.getState().loading).toBe(false);

      // 发起第二个调用
      const promise2 = state.fetchSkills();
      expect(useSkillStore.getState().loading).toBe(true);

      await promise2;
      expect(useSkillStore.getState().loading).toBe(false);
    });

    it("应该正确处理非Error类型的错误", async () => {
      const errorMessage = "String error message";
      (invoke as vi.Mock).mockRejectedValueOnce(errorMessage);

      const state = useSkillStore.getState();
      await state.fetchSkills();

      const newState = useSkillStore.getState();
      expect(newState.error).toBe(errorMessage);
      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });
  });
});
