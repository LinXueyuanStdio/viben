/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageImportDialog } from "../page-import-dialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

describe("PageImportDialog", () => {
  it("submits a URL import", () => {
    const onImportUrl = vi.fn();

    render(
      <PageImportDialog
        open
        onOpenChange={vi.fn()}
        onImportUrl={onImportUrl}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("https://example.com/article"), {
      target: { value: "https://example.com/post" },
    });
    fireEvent.click(screen.getByRole("button", { name: "开始导入" }));

    expect(onImportUrl).toHaveBeenCalledWith("https://example.com/post");
  });

  it("selects markdown and html files", () => {
    const onImportFile = vi.fn();

    render(
      <PageImportDialog
        open
        onOpenChange={vi.fn()}
        onImportFile={onImportFile}
      />
    );

    const markdownInput = document.querySelector("input[accept='.md,.markdown,text/markdown,text/plain']") as HTMLInputElement;
    const htmlInput = document.querySelector("input[accept='.html,.htm,text/html']") as HTMLInputElement;

    const markdownFile = new File(["# Title"], "page.md", { type: "text/markdown" });
    const htmlFile = new File(["<html></html>"], "index.html", { type: "text/html" });

    fireEvent.change(markdownInput, { target: { files: [markdownFile] } });
    fireEvent.change(htmlInput, { target: { files: [htmlFile] } });

    expect(onImportFile).toHaveBeenCalledWith("markdown_file", markdownFile);
    expect(onImportFile).toHaveBeenCalledWith("html_file", htmlFile);
  });
});
