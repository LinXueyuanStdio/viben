import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillSourceBadge, SkillSourceTabs } from "./skill-source-tabs";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

describe("SkillSourceTabs", () => {
  it("selects official tab and reports community selection", () => {
    const onSourceChange = vi.fn();

    render(
      <SkillSourceTabs source="official" onSourceChange={onSourceChange} />
    );

    expect(
      screen
        .getByRole("tab", { name: /official/i })
        .getAttribute("aria-selected")
    ).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: /community/i }));

    expect(onSourceChange).toHaveBeenCalledWith("community");
  });
});

describe("SkillSourceBadge", () => {
  it("renders source labels", () => {
    const { rerender } = render(<SkillSourceBadge source="official" />);

    expect(screen.getByText("Official")).toBeTruthy();

    rerender(<SkillSourceBadge source="community" />);

    expect(screen.getByText("Community")).toBeTruthy();
  });
});
