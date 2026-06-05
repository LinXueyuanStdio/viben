import { describe, it, expect } from "vitest";
import { parseResumeArgs } from "../resume.js";

describe("parseResumeArgs", () => {
  it("parses 'pr 19'", () => {
    const r = parseResumeArgs("pr 19");
    expect(r?.query).toEqual({ type: "pr", value: "19" });
  });

  it("parses 'pr https://github.com/org/repo/pull/19'", () => {
    const r = parseResumeArgs("pr https://github.com/org/repo/pull/19");
    expect(r?.query).toEqual({ type: "pr", value: "https://github.com/org/repo/pull/19" });
  });

  it("extracts PR number from GitHub PR URL", () => {
    const r = parseResumeArgs("https://github.com/org/repo/pull/42");
    expect(r?.query).toEqual({ type: "pr", value: "42" });
  });

  it("parses GitHub commit URL", () => {
    const r = parseResumeArgs("https://github.com/org/repo/commit/e0dd2fa47dd675fe8fb21b372ce316ef729aca30");
    expect(r?.query).toEqual({ type: "commit", value: "e0dd2fa47dd675fe8fb21b372ce316ef729aca30" });
  });

  it("parses GitHub branch URL", () => {
    const r = parseResumeArgs("https://github.com/org/repo/tree/feat/my-feature");
    expect(r?.query).toEqual({ type: "branch", value: "feat/my-feature" });
  });

  it("parses GitHub branch URL with query params", () => {
    const r = parseResumeArgs("https://github.com/org/repo/tree/main?tab=readme");
    expect(r?.query).toEqual({ type: "branch", value: "main" });
  });

  it("parses 'branch main'", () => {
    const r = parseResumeArgs("branch main");
    expect(r?.query).toEqual({ type: "branch", value: "main" });
  });

  it("parses 'commit e0dd2fa4'", () => {
    const r = parseResumeArgs("commit e0dd2fa4");
    expect(r?.query).toEqual({ type: "commit", value: "e0dd2fa4" });
  });

  it("auto-detects 12-hex checkpoint ID", () => {
    const r = parseResumeArgs("f634acf05138");
    expect(r?.query).toEqual({ type: "checkpoint", value: "f634acf05138" });
  });

  it("auto-detects UUID session ID", () => {
    const r = parseResumeArgs("1d9503b8-0134-419a-a3a7-019b312dd12c");
    expect(r?.query).toEqual({ type: "session", value: "1d9503b8-0134-419a-a3a7-019b312dd12c" });
  });


  it("defaults to latest 5 with no args", () => {
    const r = parseResumeArgs("");
    expect(r?.query).toEqual({ type: "latest", value: "5" });
  });

  it("returns null for 'pr' without number", () => {
    expect(parseResumeArgs("pr")).toBeNull();
  });

  it("returns null for 'branch' without name", () => {
    expect(parseResumeArgs("branch")).toBeNull();
  });

  it("returns null for 'commit' without hash", () => {
    expect(parseResumeArgs("commit")).toBeNull();
  });

  it("parses GitHub compare URL — extracts head branch", () => {
    const r = parseResumeArgs("https://github.com/org/repo/compare/main...feat/my-feature");
    expect(r?.query).toEqual({ type: "branch", value: "feat/my-feature" });
  });

  it("parses GitHub compare URL with two dots", () => {
    const r = parseResumeArgs("https://github.com/org/repo/compare/main..develop");
    expect(r?.query).toEqual({ type: "branch", value: "develop" });
  });

  it("parses bare GitHub repo URL as latest", () => {
    const r = parseResumeArgs("https://github.com/org/repo");
    expect(r?.query).toEqual({ type: "latest", value: "5" });
  });

  it("parses bare GitHub repo URL with trailing slash as latest", () => {
    const r = parseResumeArgs("https://github.com/org/repo/");
    expect(r?.query).toEqual({ type: "latest", value: "5" });
  });

  it("parses entire.io checkpoint URL", () => {
    const r = parseResumeArgs("https://entire.io/gh/lab3-ai/claw-quest/checkpoints/main/2e884e2c402a");
    expect(r?.query).toEqual({ type: "checkpoint", value: "2e884e2c402a" });
  });

  it("parses entire.io commit URL", () => {
    const r = parseResumeArgs("https://entire.io/gh/lab3-ai/claw-quest/commit/e0dd2fa47dd675fe8fb21b372ce316ef729aca30");
    expect(r?.query).toEqual({ type: "commit", value: "e0dd2fa47dd675fe8fb21b372ce316ef729aca30" });
  });

  it("treats unknown arg as latest", () => {
    const r = parseResumeArgs("something-unknown");
    expect(r?.query).toEqual({ type: "latest", value: "5" });
  });
});
