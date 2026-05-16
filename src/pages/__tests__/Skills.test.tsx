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
  DispatchDialog: () => null,
}));

const originalConfirm = window.confirm;
beforeEach(() => {
  window.confirm = vi.fn(() => false);
  vi.clearAllMocks();
});

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
    dispatchCount: 2,
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
    dispatchCount: 0,
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
    dispatchCount: 1,
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
  const mockSetSearchQuery = vi.fn();
  const mockClearError = vi.fn();
  const mockFetchTargetDirs = vi.fn();
  const mockBulkDispatch = vi.fn();

  beforeEach(() => {
    (useSkillStore as unknown as vi.Mock).mockReturnValue({
      skills: [],
      loading: false,
      error: null,
      searchQuery: "",
      fetchSkills: mockFetchSkills,
      discoverSkills: mockDiscoverSkills,
      setSearchQuery: mockSetSearchQuery,
      clearError: mockClearError,
    });

    (useDispatchStore as unknown as vi.Mock).mockReturnValue({
      targetDirs: [],
      fetchTargetDirs: mockFetchTargetDirs,
      bulkDispatch: mockBulkDispatch,
    });

    mockFetchSkills.mockResolvedValue(undefined);
    mockDiscoverSkills.mockResolvedValue(undefined);
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

      await waitFor(() => {
        expect(screen.getByText(/no skills found/i)).toBeInTheDocument();
      });

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
        setSearchQuery: mockSetSearchQuery,
        clearError: mockClearError,
      });

      render(<Skills />);

      expect(screen.queryByText(/no skills found/i)).not.toBeInTheDocument();
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
        setSearchQuery: mockSetSearchQuery,
        clearError: mockClearError,
      });

      render(<Skills />);

      expect(screen.getByText("React Component Generator")).toBeInTheDocument();
      expect(screen.getByText("API Client Generator")).toBeInTheDocument();
      expect(screen.getByText("Database Migration Tool")).toBeInTheDocument();

      // Tags are rendered
      expect(screen.getByText("react")).toBeInTheDocument();
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
        setSearchQuery: mockSetSearchQuery,
        clearError: mockClearError,
      });

      render(<Skills />);

      expect(
        screen.getByText(/no skills match your search criteria/i),
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
        setSearchQuery: mockSetSearchQuery,
        clearError: mockClearError,
      });
    });

    it("allows selecting individual skills and shows bulk actions", async () => {
      render(<Skills />);

      // Checkbox buttons have "cursor-pointer" class
      const checkboxes = screen
        .getAllByRole("button")
        .filter(
          (btn) =>
            btn.className.includes("focus:outline-none") &&
            btn.className.includes("cursor-pointer"),
        );

      expect(checkboxes.length).toBe(3);

      // Click first skill checkbox to select
      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(screen.getByText(/1 skills selected/i)).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /bulk dispatch/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /clear selection/i }),
        ).toBeInTheDocument();
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

      // Select two skills via checkbox buttons
      const checkboxes = screen
        .getAllByRole("button")
        .filter(
          (btn) =>
            btn.className.includes("focus:outline-none") &&
            btn.className.includes("cursor-pointer"),
        );
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      // Open bulk dispatch dialog
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /bulk dispatch \(2\)/i }),
        ).toBeInTheDocument();
      });
      fireEvent.click(
        screen.getByRole("button", { name: /bulk dispatch \(2\)/i }),
      );

      await waitFor(() => {
        expect(screen.getByText(/bulk dispatch skills/i)).toBeInTheDocument();
        expect(
          screen.getByText(/dispatch 2 selected skills/i),
        ).toBeInTheDocument();
      });

      // Check dispatch method options exist
      expect(
        screen.getByLabelText(/symlink \(recommended\)/i),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/copy/i)).toBeInTheDocument();

      // Select copy method
      fireEvent.click(screen.getByLabelText(/copy/i));

      // Click dispatch button
      fireEvent.click(
        screen.getByRole("button", { name: /dispatch 2 skills/i }),
      );

      await waitFor(() => {
        expect(mockBulkDispatch).toHaveBeenCalledWith(
          ["skill-1", "skill-2"],
          "dir-1",
          DispatchMethod.Copy,
        );
        expect(toast.success).toHaveBeenCalledWith(
          "Successfully dispatched 2 skills. Manage them in the Dispatches page.",
        );
      });
    });

    it("shows warning when some dispatches fail", async () => {
      mockBulkDispatch.mockResolvedValue({
        successful: ["skill-1"],
        errors: [["skill-2", "not found"]],
      });

      render(<Skills />);

      const checkboxes = screen
        .getAllByRole("button")
        .filter(
          (btn) =>
            btn.className.includes("focus:outline-none") &&
            btn.className.includes("cursor-pointer"),
        );
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /bulk dispatch \(2\)/i }),
        ).toBeInTheDocument();
      });
      fireEvent.click(
        screen.getByRole("button", { name: /bulk dispatch \(2\)/i }),
      );

      await waitFor(() => {
        expect(screen.getByText(/bulk dispatch skills/i)).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole("button", { name: /dispatch 2 skills/i }),
      );

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Successfully dispatched 1 skills. Manage them in the Dispatches page.",
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

      const checkboxes = screen
        .getAllByRole("button")
        .filter(
          (btn) =>
            btn.className.includes("focus:outline-none") &&
            btn.className.includes("cursor-pointer"),
        );
      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /bulk dispatch \(1\)/i }),
        ).toBeInTheDocument();
      });
      fireEvent.click(
        screen.getByRole("button", { name: /bulk dispatch \(1\)/i }),
      );

      await waitFor(() => {
        expect(screen.getByText(/bulk dispatch skills/i)).toBeInTheDocument();
      });

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
        setSearchQuery: mockSetSearchQuery,
        clearError: mockClearError,
      });
    });

    it("renders skill cards with action buttons", async () => {
      render(<Skills />);

      // Verify skills are rendered
      expect(screen.getByText("React Component Generator")).toBeInTheDocument();

      // Each card has action buttons
      const cards = document.querySelectorAll('[data-slot="card"]');
      expect(cards.length).toBe(3);

      // First card should have multiple buttons (checkbox, tag remove, edit, send)
      const allButtons = cards[0].querySelectorAll("button");
      expect(allButtons.length).toBeGreaterThan(1);
    });
  });

  describe("Discover Skills Functionality", () => {
    it("calls discover skills when button is clicked", async () => {
      render(<Skills />);

      const discoverButtons = screen.getAllByRole("button", {
        name: /discover skills/i,
      });
      fireEvent.click(discoverButtons[0]);

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

      const discoverButtons = screen.getAllByRole("button", {
        name: /discover skills/i,
      });
      fireEvent.click(discoverButtons[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          `Failed to discover skills: ${testError.message}`,
        );
      });
    });
  });
});
