import { render, screen } from "@testing-library/react";

describe("Smoke Test", () => {
  it("should render correctly", () => {
    render(<div>Hello World</div>);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("should have access to test environment variables", () => {
    expect(import.meta.env.LLM_API_URL).toBe(
      "https://api.longcat.chat/openai/chat/completions",
    );
    expect(import.meta.env.LLM_API_KEY).toBe(
      "ak_2h10uP76N81N84J9Y78Nx7UA5oG65",
    );
    expect(import.meta.env.LLM_MODEL).toBe("LongCat-Flash-Chat");
  });
});
