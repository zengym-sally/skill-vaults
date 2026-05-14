import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Skills } from "../Skills";
import { useSkillStore } from "@/store/skillStore";
import { useDispatchStore } from "@/store/dispatchStore";
import { DispatchMethod } from "@/types/dispatch";
import { toast } from "sonner";

// Mock dependencies
vi.mock("@/store/skillStore");
vi.mock("@/store/dispatchStore");
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("../components/skills/DispatchDialog", () => ({
  DispatchDialog: vi.fn(() => <div data-testid="dispatch-dialog" />),
}));

// Mock window.confirm
const originalConfirm = window.confirm;
beforeEach(() => {
  window.confirm = vi.fn(() => false);
  vi.clearAllMocks();
});

// Test data
const mockSkills = [
  {
    id: "skill-1",
    name: "React Component Generator",
    description: "Generates React components with TypeScript and Tailwind CSS",
    status: "active",
    sourceType: "github",
    type: "frontend",
    qualityScore: 95,
    tags: ["react", "typescript", "tailwind"],
    dependencies: ["react", "typescript"],
    updatedAt: new Date("2024-01-15").toISOString(),
  },
  {
    id: "skill-2",
    name: "API Client Generator",
    description: "Generates TypeScript API clients from OpenAPI specifications",
    status: "active",
    sourceType: "local",
    type: "backend",
    qualityScore: 88,
    tags: ["api", "openapi", "typescript"],
    dependencies: ["axios"],
    updatedAt: new Date("2024-01-20").toISOString(),
  },
  {
    id: "skill-3",
    name: "Database Migration Tool",
    description: "Tool for managing database migrations and schema changes",
    status: "broken",
    sourceType: "private-git",
    type: "devops",
    qualityScore: 72,
    tags: ["database", "migration", "sql"],
    dependencies: ["knex"],
    updatedAt: new Date("2024-01-10").toISOString(),
  },
];

const mockTargetDirs = [
  {
    id: "dir-1",
    name: "Project A",
    path: "/home/user/projects/project-a",
  },
  {
    id: "dir-2",
    name: "Project B",
    path: "/home/user/projects/project-b",
  },
];

describe("Skills Page", () => {
  const mockFetchSkills = vi.fn();
  const mockDiscoverSkills = vi.fn();
  const mockDeleteSkill = vi.fn();
  const mockSetSearchQuery = vi.fn();
  const mockClearError = vi.fn();
  const mockFetchTargetDirs = vi.fn();
  const mockBulkDispatch = vi.fn();

  beforeEach(() => {
    // Mock skill store
    (useSkillStore as unknown as vi.Mock).mockReturnValue({
      skills: [],
      loading: false,
      error: null,
      searchQuery: "",
      fetchSkills: mockFetchSkills,
      discoverSkills: mockDiscoverSkills,
      deleteSkill: mockDeleteSkill,
      setSearchQuery: mockSetSearchQuery,
      clearError: mockClearError,
    });

    // Mock dispatch store
    (useDispatchStore as unknown as vi.Mock).mockReturnValue({
      targetDirs: [],
      fetchTargetDirs: mockFetchTargetDirs,
      bulkDispatch: mockBulkDispatch,
    });

    // Mock resolve for async functions
    mockFetchSkills.mockResolvedValue(undefined);
    mockDiscoverSkills.mockResolvedValue(undefined);
    mockDeleteSkill.mockResolvedValue(undefined);
    mockFetchTargetDirs.mockResolvedValue(undefined);
    mockBulkDispatch.mockResolvedValue({
      successful: [],
      errors: [],
    });
  });

  describe("Initial Rendering", () => {
    it("renders page title and empty state correctly when no skills exist", async () => {
      render(<Skills />);

      expect(
        screen.getByRole("heading", { name: /skills/i, level: 1 }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/manage your skill library/i),
      ).toBeInTheDocument();

      // Check empty state
      await waitFor(() => {
        expect(screen.getByText(/no skills found/i)).toBeInTheDocument();
        expect(
          screen.getByText(/you haven't added any skills yet/i),
        ).toBeInTheDocument();
        expect(
          screen.getAllByRole("button", { name: /discover skills/i }).length,
        ).toBeGreaterThanOrEqual(1);
      });

      // Check fetchSkills is called on mount
      expect(mockFetchSkills).toHaveBeenCalledTimes(1);
    });

    it("renders loading state correctly", () => {
      (useSkillStore as unknown as vi.Mock).mockReturnValue({
        skills: [],
        loading: true,
        error: null,
        searchQuery: "",
        fetchSkills: mockFetchSkills,
        discoverSkills: mockDiscoverSkills,
        deleteSkill: mockDeleteSkill,
        setSearchQuery: mockSetSearchQuery,
        clearError: mockClearError,
      });

      render(<Skills />);

      expect(screen.queryByText(/no skills found/i)).not.toBeInTheDocument();
      const discoverButtons = screen.getAllByRole("button", {
        name: /discover skills/i,
      });
      expect(discoverButtons[0]).toBeDisabled();
    });

    it("displays error toast when error occurs", async () => {
      const testError = "Failed to load skills";
      (useSkillStore as unknown as vi.Mock).mockReturnValue({
        skills: [],
        loading: false,
        error: testError,
        searchQuery: "",
        fetchSkills: mockFetchSkills,
        discoverSkills: mockDiscoverSkills,
        deleteSkill: mockDeleteSkill,
        setSearchQuery: mockSetSearchQuery,
        clearError: mockClearError,
      });

      render(<Skills />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(testError);
        expect(mockClearError).toHaveBeenCalledTimes(1);
      });
    });

    it("renders skills list correctly when data is available", async () => {
      (useSkillStore as unknown as vi.Mock).mockReturnValue({
        skills: mockSkills,
        loading: false,
        error: null,
        searchQuery: "",
        fetchSkills: mockFetchSkills,
        discoverSkills: mockDiscoverSkills,
        deleteSkill: mockDeleteSkill,
        setSearchQuery: mockSetSearchQuery,
        clearError: mockClearError,
      });

      render(<Skills />);

      // Check all skills are rendered
      expect(screen.getByText("React Component Generator")).toBeInTheDocument();
      expect(screen.getByText("API Client Generator")).toBeInTheDocument();
      expect(screen.getByText("Database Migration Tool")).toBeInTheDocument();

      // Check skill metadata
      expect(screen.getByText("95/100")).toBeInTheDocument();
      expect(screen.getByText("react")).toBeInTheDocument();
      expect(screen.getAllByText("typescript")).toHaveLength(2);
      expect(screen.getByText("github")).toBeInTheDocument();
      expect(screen.getByText("local")).toBeInTheDocument();

      // Check action buttons
      const dispatchButtons = screen.getAllByRole("button", {
        name: /dispatch/i,
      });
      expect(dispatchButtons).toHaveLength(3);
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      expect(deleteButtons).toHaveLength(3);
    });
  });

  describe("Search Functionality", () => {
    it("calls search function when user types in search input", async () => {
      (useSkillStore as unknown as vi.Mock).mockReturnValue({
        skills: mockSkills,
        loading: false,
        error: null,
        searchQuery: "",
        fetchSkills: mockFetchSkills,
        discoverSkills: mockDiscoverSkills,
        deleteSkill: mockDeleteSkill,
        setSearchQuery: mockSetSearchQuery,
        clearError: mockClearError,
      });

      render(<Skills />);

      const searchInput = screen.getByPlaceholderText(/search skills by name/i);
      fireEvent.change(searchInput, { target: { value: "react" } });

      await waitFor(() => {
        expect(mockSetSearchQuery).toHaveBeenCalledWith("react");
        expect(mockFetchSkills).toHaveBeenCalledWith({ search: "react" });
      });
    });

    it("shows empty search results when no skills match query", async () => {
      (useSkillStore as unknown as vi.Mock).mockReturnValue({
        skills: [],
        loading: false,
        error: null,
        searchQuery: "nonexistent skill",
        fetchSkills: mockFetchSkills,
        discoverSkills: mockDiscoverSkills,
        deleteSkill: mockDeleteSkill,
        setSearchQuery: mockSetSearchQuery,
        clearError: mockClearError,
      });

      render(<Skills />);

      expect(
        screen.getByText(/no skills match your search criteria/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /discover skills/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Skill Selection", () => {
    beforeEach(() => {
      (useSkillStore as unknown as vi.Mock).mockReturnValue({
        skills: mockSkills,
        loading: false,
        error: null,
        searchQuery: "",
        fetchSkills: mockFetchSkills,
        discoverSkills: mockDiscoverSkills,
        deleteSkill: mockDeleteSkill,
        setSearchQuery: mockSetSearchQuery,
        clearError: mockClearError,
      });
    });

    it("allows selecting individual skills and shows bulk actions", async () => {
      render(<Skills />);

      // Find select button for first skill
      const selectButtons = screen.getAllByRole("button", { name: "" }); // The checkbox buttons
      fireEvent.click(selectButtons[0]);

      // Check selection count is shown
      await waitFor(() => {
        expect(screen.getByText(/1 skills selected/i)).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /bulk dispatch \(1\)/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /clear selection/i }),
        ).toBeInTheDocument();
      });

      // Select second skill
      fireEvent.click(selectButtons[1]);
      await waitFor(() => {
        expect(screen.getByText(/2 skills selected/i)).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /bulk dispatch \(2\)/i }),
        ).toBeInTheDocument();
      });

      // Unselect first skill
      fireEvent.click(selectButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/1 skills selected/i)).toBeInTheDocument();
      });

      // Clear selection
      fireEvent.click(screen.getByRole("button", { name: /clear selection/i }));
      await waitFor(() => {
        expect(
          screen.getByText(/manage your skill library/i),
        ).toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: /bulk dispatch/i }),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Bulk Dispatch Functionality", () => {
    beforeEach(() => {
      (useSkillStore as unknown as vi.Mock).mockReturnValue({
        skills: mockSkills,
        loading: false,
        error: null,
        searchQuery: "",
        fetchSkills: mockFetchSkills,
        discoverSkills: mockDiscoverSkills,
        deleteSkill: mockDeleteSkill,
        setSearchQuery: mockSetSearchQuery,
        clearError: mockClearError,
      });

      (useDispatchStore as unknown as vi.Mock).mockReturnValue({
        targetDirs: mockTargetDirs,
        fetchTargetDirs: mockFetchTargetDirs,
        bulkDispatch: mockBulkDispatch,
      });

      mockBulkDispatch.mockResolvedValue({
        successful: ["skill-1", "skill-2"],
        errors: [],
      });
    });

    it("opens bulk dispatch dialog and allows dispatching selected skills", async () => {
      render(<Skills />);

      // Select two skills
      const selectButtons = screen.getAllByRole("button", { name: "" });
      fireEvent.click(selectButtons[0]);
      fireEvent.click(selectButtons[1]);

      // Open bulk dispatch dialog
      fireEvent.click(
        screen.getByRole("button", { name: /bulk dispatch \(2\)/i }),
      );

      await waitFor(() => {
        expect(mockFetchTargetDirs).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/bulk dispatch skills/i)).toBeInTheDocument();
        expect(
          screen.getByText(/dispatch 2 selected skills to a target directory/i),
        ).toBeInTheDocument();
      });

      // Check target directory select exists and has options
      const targetSelect = screen.getByLabelText(/target directory/i);
      expect(targetSelect).toBeInTheDocument();

      // Check dispatch method options exist
      expect(
        screen.getByLabelText(/symlink \(recommended\)/i),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/copy/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/hardlink/i)).toBeInTheDocument();

      // Select copy method
      fireEvent.click(screen.getByLabelText(/copy/i));

      // Click dispatch button
      fireEvent.click(
        screen.getByRole("button", { name: /dispatch 2 skills/i }),
      );

      await waitFor(() => {
        expect(mockBulkDispatch).toHaveBeenCalledWith(
          ["skill-1", "skill-2"],
          "dir-1", // First directory should be selected by default
          DispatchMethod.Copy,
        );
        expect(toast.success).toHaveBeenCalledWith(
          "Successfully dispatched 2 skills",
        );
        expect(
          screen.queryByText(/bulk dispatch skills/i),
        ).not.toBeInTheDocument(); // Dialog closed
        expect(
          screen.getByText(/manage your skill library/i),
        ).toBeInTheDocument(); // Selection cleared
      });
    });

    it("shows loading state during bulk dispatch", async () => {
      // Make bulk dispatch take time to resolve
      let resolveDispatch: (value: unknown) => void;
      mockBulkDispatch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDispatch = resolve;
          }),
      );

      render(<Skills />);

      // Select skill and open dialog
      const selectButtons = screen.getAllByRole("button", { name: "" });
      fireEvent.click(selectButtons[0]);
      fireEvent.click(
        screen.getByRole("button", { name: /bulk dispatch \(1\)/i }),
      );

      await waitFor(() => {
        expect(screen.getByText(/bulk dispatch skills/i)).toBeInTheDocument();
      });

      // Click dispatch
      fireEvent.click(
        screen.getByRole("button", { name: /dispatch 1 skills/i }),
      );

      await waitFor(() => {
        expect(
          screen.getByText(/dispatching 1 skills.../i),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /dispatching 1 skills.../i }),
        ).toBeDisabled();
      });

      // Resolve the promise
      resolveDispatch!({ successful: ["skill-1"], errors: [] });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Successfully dispatched 1 skills",
        );
      });
    });

    it("shows warning when some dispatches fail", async () => {
      mockBulkDispatch.mockResolvedValue({
        successful: ["skill-1"],
        errors: ["skill-2"],
      });

      render(<Skills />);

      // Select two skills and open dialog
      const selectButtons = screen.getAllByRole("button", { name: "" });
      fireEvent.click(selectButtons[0]);
      fireEvent.click(selectButtons[1]);
      fireEvent.click(
        screen.getByRole("button", { name: /bulk dispatch \(2\)/i }),
      );

      await waitFor(() => {
        expect(screen.getByText(/bulk dispatch skills/i)).toBeInTheDocument();
      });

      // Click dispatch
      fireEvent.click(
        screen.getByRole("button", { name: /dispatch 2 skills/i }),
      );

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Successfully dispatched 1 skills",
        );
        expect(toast.warning).toHaveBeenCalledWith(
          "1 skills failed to dispatch",
        );
      });
    });

    it("shows error when bulk dispatch fails completely", async () => {
      const testError = new Error("Network error");
      mockBulkDispatch.mockRejectedValue(testError);

      render(<Skills />);

      // Select skill and open dialog
      const selectButtons = screen.getAllByRole("button", { name: "" });
      fireEvent.click(selectButtons[0]);
      fireEvent.click(
        screen.getByRole("button", { name: /bulk dispatch \(1\)/i }),
      );

      await waitFor(() => {
        expect(screen.getByText(/bulk dispatch skills/i)).toBeInTheDocument();
      });

      // Click dispatch
      fireEvent.click(
        screen.getByRole("button", { name: /dispatch 1 skills/i }),
      );

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          `Failed to bulk dispatch: ${testError.message}`,
        );
      });
    });
  });

  describe("Individual Skill Actions", () => {
    beforeEach(() => {
      (useSkillStore as unknown as vi.Mock).mockReturnValue({
        skills: mockSkills,
        loading: false,
        error: null,
        searchQuery: "",
        fetchSkills: mockFetchSkills,
        discoverSkills: mockDiscoverSkills,
        deleteSkill: mockDeleteSkill,
        setSearchQuery: mockSetSearchQuery,
        clearError: mockClearError,
      });
    });

    it("opens dispatch dialog when dispatch button is clicked", async () => {
      render(<Skills />);

      const dispatchButtons = screen.getAllByRole("button", {
        name: /dispatch/i,
      });
      fireEvent.click(dispatchButtons[0]);

      // Verify the dialog opens by checking for Radix dialog portal
      await waitFor(() => {
        expect(
          screen.getByRole("dialog", { hidden: true }) ||
            document.querySelector("[data-radix-popper-content-wrapper]"),
        ).toBeTruthy();
      });
    });

    it("calls delete skill when confirmed", async () => {
      (window.confirm as vi.Mock).mockReturnValue(true);

      render(<Skills />);

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalledWith(
          'Are you sure you want to delete skill "React Component Generator"?',
        );
        expect(mockDeleteSkill).toHaveBeenCalledWith("skill-1");
        expect(toast.success).toHaveBeenCalledWith(
          "Skill deleted successfully",
        );
      });
    });

    it("does not delete skill when confirmation is cancelled", async () => {
      (window.confirm as vi.Mock).mockReturnValue(false);

      render(<Skills />);

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalled();
        expect(mockDeleteSkill).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
      });
    });

    it("shows error when delete fails", async () => {
      (window.confirm as vi.Mock).mockReturnValue(true);
      const testError = new Error("Failed to delete skill");
      mockDeleteSkill.mockRejectedValue(testError);

      render(<Skills />);

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          `Failed to delete skill: ${testError.message}`,
        );
      });
    });
  });

  describe("Discover Skills Functionality", () => {
    it("calls discover skills when button is clicked", async () => {
      render(<Skills />);

      const discoverButton = screen.getAllByRole("button", {
        name: /discover skills/i,
      })[0];
      fireEvent.click(discoverButton);

      await waitFor(() => {
        expect(mockDiscoverSkills).toHaveBeenCalledWith({ force: true });
        expect(toast.success).toHaveBeenCalledWith(
          "Skills discovered successfully",
        );
      });
    });

    it("shows error when discover fails", async () => {
      const testError = new Error("Failed to scan repositories");
      mockDiscoverSkills.mockRejectedValue(testError);

      render(<Skills />);

      const discoverButton = screen.getAllByRole("button", {
        name: /discover skills/i,
      })[0];
      fireEvent.click(discoverButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          `Failed to discover skills: ${testError.message}`,
        );
      });
    });
  });
});
