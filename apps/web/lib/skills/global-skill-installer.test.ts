import { beforeEach, describe, expect, test, vi } from "vitest";
import { installGlobalSkills } from "./global-skill-installer";

vi.mock("server-only", () => ({}));

interface ExecCall {
  command: string;
  cwd: string;
  timeoutMs: number;
}

const execCalls: ExecCall[] = [];

const sandbox = {
  workingDirectory: "/workspace",
  exec: vi.fn(async (command: string, cwd: string, timeoutMs: number) => {
    execCalls.push({ command, cwd, timeoutMs });

    if (command === 'printf %s "$HOME"') {
      return {
        success: true,
        exitCode: 0,
        stdout: "/root",
        stderr: "",
        truncated: false,
      };
    }

    return {
      success: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
      truncated: false,
    };
  }),
};

describe("installGlobalSkills", () => {
  beforeEach(() => {
    execCalls.length = 0;
    sandbox.exec.mockClear();
  });

  test("installs each requested global skill", async () => {
    await installGlobalSkills({
      sandbox: sandbox as never,
      globalSkillRefs: [
        { source: "vercel/ai", skillName: "ai-sdk" },
        { source: "vercel/workflow", skillName: "workflow" },
      ],
    });

    expect(execCalls).toEqual([
      {
        command: 'printf %s "$HOME"',
        cwd: "/workspace",
        timeoutMs: 5_000,
      },
      {
        command:
          "HOME='/root' npx skills add 'vercel/ai' --skill 'ai-sdk' --agent amp -g -y --copy",
        cwd: "/workspace",
        timeoutMs: 120_000,
      },
      {
        command:
          "HOME='/root' npx skills add 'vercel/workflow' --skill 'workflow' --agent amp -g -y --copy",
        cwd: "/workspace",
        timeoutMs: 120_000,
      },
    ]);
  });

  test("does nothing when the skill list is empty", async () => {
    await installGlobalSkills({
      sandbox: sandbox as never,
      globalSkillRefs: [],
    });

    expect(execCalls).toEqual([]);
  });
});
