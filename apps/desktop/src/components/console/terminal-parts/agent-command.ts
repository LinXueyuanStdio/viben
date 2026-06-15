import { defineCommand } from "just-bash";
import { getGatewayClient } from "@/lib/gateway";
import { formatMarkdown } from "./markdown";
import { stripAnsi, formatForTerminal } from "./ansi-security";

const MAX_TOOL_OUTPUT_LINES = 20;

type TerminalWriter = {
  write: (data: string) => void;
};

type UIMessage = {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: "text"; text: string }>;
};

export function createAgentCommand(term: TerminalWriter) {
  const agentMessages: UIMessage[] = [];
  let messageIdCounter = 0;
  let sdkSessionId: string | undefined;

  const agentCmd = defineCommand("agent", async (args) => {
    const prompt = args.join(" ");
    if (!prompt || prompt === "--help" || prompt === "-h") {
      return {
        stdout: [
          "agent - chat with AI assistant via gateway",
          "",
          "Usage: agent <message>",
          "",
          "Commands:",
          "  agent <message>     Send a message to the AI",
          "  agent reset         Clear conversation history",
          "  agent --help        Show this help",
          "",
          "Examples:",
          "  agent hello",
          "  agent what files are in this project?",
          "  agent explain the architecture",
          "",
          "This is a multi-turn chat. The AI remembers context",
          "from previous messages in this session.",
          "",
        ].join("\n"),
        stderr: "",
        exitCode: 0,
      };
    }

    if (prompt.toLowerCase() === "reset") {
      agentMessages.length = 0;
      sdkSessionId = undefined;
      return {
        stdout: "Agent conversation reset.\n",
        stderr: "",
        exitCode: 0,
      };
    }

    agentMessages.push({
      id: `msg-${++messageIdCounter}`,
      role: "user",
      parts: [{ type: "text", text: prompt }],
    });

    try {
      const client = getGatewayClient();
      const requestBody = {
        prompt,
        resume_session: sdkSessionId || undefined,
      };

      const response = await client.request<Response>("/api/agent/run", {
        method: "POST",
        headers: { Accept: "text/event-stream" },
        body: requestBody,
        responseType: "response",
      });

      const reader = (response as unknown as Response).body?.getReader();
      if (!reader) {
        agentMessages.pop();
        return { stdout: "", stderr: "Error: No response body\n", exitCode: 1 };
      }

      let lineBuffer = "";
      let fullText = "";
      const toolCallsMap = new Map<string, { toolName: string; args: unknown; result?: string }>();
      const decoder = new TextDecoder();
      let buffer = "";

      let thinkingTimeout: ReturnType<typeof setTimeout> | null = null;
      let showingThinking = false;

      const showThinking = () => {
        if (!showingThinking) {
          showingThinking = true;
          term.write("\x1b[2mThinking...\x1b[0m");
        }
      };

      const clearThinking = (restart = true) => {
        if (showingThinking) {
          term.write("\r\x1b[K");
          showingThinking = false;
        }
        if (thinkingTimeout) {
          clearTimeout(thinkingTimeout);
          thinkingTimeout = null;
        }
        if (restart) {
          thinkingTimeout = setTimeout(showThinking, 500);
        }
      };

      const resetThinkingTimer = () => {
        if (thinkingTimeout) {
          clearTimeout(thinkingTimeout);
        }
        if (!showingThinking) {
          thinkingTimeout = setTimeout(showThinking, 500);
        }
      };

      resetThinkingTimer();

      const formatToolResult = (tc: { toolName: string; args: unknown; result?: string }) => {
        if (!tc.result) return;
        let displayResult = tc.result;
        try {
          const parsed = JSON.parse(tc.result);
          if (tc.toolName === "bash" || tc.toolName === "Bash") {
            if (parsed.stderr && parsed.stderr.trim()) {
              displayResult = `stderr: ${parsed.stderr}`;
            } else if (parsed.stdout !== undefined) {
              displayResult = parsed.stdout;
            }
          } else if (tc.toolName === "readFile" || tc.toolName === "Read") {
            if (parsed.content !== undefined) {
              displayResult = parsed.content;
            }
          }
        } catch {
          // Keep original
        }

        if (displayResult && displayResult.trim()) {
          const resultLines = displayResult
            .split("\n")
            .map((l: string) => stripAnsi(l))
            .filter((l: string) => l.trim());
          const linesToShow = resultLines.slice(0, MAX_TOOL_OUTPUT_LINES);
          let output = linesToShow.map((line) => `\x1b[2m${line}\x1b[0m`).join("\n");
          if (resultLines.length > MAX_TOOL_OUTPUT_LINES) {
            output += `\n\x1b[2m... (${resultLines.length - MAX_TOOL_OUTPUT_LINES} more lines)\x1b[0m`;
          }
          term.write(formatForTerminal(output) + "\r\n");
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith("data:")) continue;

          const jsonStr = trimmedLine.slice(5).trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const data = JSON.parse(jsonStr);

            if (data.type === "sdk_session" && data.sdk_session_id) {
              sdkSessionId = data.sdk_session_id;
            } else if (data.type === "text" && data.content) {
              const safeDelta = stripAnsi(String(data.content));
              fullText += safeDelta;
              lineBuffer += safeDelta;

              const lastNewline = lineBuffer.lastIndexOf("\n");
              if (lastNewline !== -1) {
                clearThinking();
                const completeLines = lineBuffer.slice(0, lastNewline + 1);
                lineBuffer = lineBuffer.slice(lastNewline + 1);
                term.write(formatForTerminal(formatMarkdown(completeLines)));
              } else {
                resetThinkingTimer();
              }
            } else if (data.type === "tool_use" && data.id) {
              clearThinking();
              if (fullText && !fullText.endsWith("\n")) {
                term.write("\r\n");
                fullText += "\n";
              }
              const safeToolName = stripAnsi(String(data.name));
              const args = data.input as Record<string, unknown>;

              if ((data.name === "bash" || data.name === "Bash") && args.command) {
                const cmd = stripAnsi(String(args.command)).replace(/\t/g, "  ");
                const cmdLines = cmd.split("\n");
                term.write(`\x1b[36m$ ${cmdLines[0]}\x1b[0m\r\n`);
                for (let i = 1; i < cmdLines.length; i++) {
                  term.write(`\x1b[36m${cmdLines[i]}\x1b[0m\r\n`);
                }
              } else if ((data.name === "readFile" || data.name === "Read") && args.path) {
                term.write(`\x1b[36m[${safeToolName}] ${stripAnsi(String(args.path))}\x1b[0m\r\n`);
              } else if ((data.name === "writeFile" || data.name === "Write") && args.path) {
                term.write(`\x1b[36m[${safeToolName}] ${stripAnsi(String(args.path))}\x1b[0m\r\n`);
              } else {
                term.write(`\x1b[36m[${safeToolName}]\x1b[0m\r\n`);
              }

              toolCallsMap.set(data.id, { toolName: data.name, args: data.input });
            } else if (data.type === "tool_result" && data.tool_use_id) {
              const existing = toolCallsMap.get(data.tool_use_id);
              const result = data.output;
              const resultStr = typeof result === "string" ? result : JSON.stringify(result, null, 2);

              const tc = {
                toolName: existing?.toolName || "tool",
                args: existing?.args || Object.create(null),
                result: resultStr,
              };
              formatToolResult(tc);

              if (existing) {
                existing.result = resultStr;
              } else {
                toolCallsMap.set(data.tool_use_id, tc);
              }
            } else if (data.type === "error") {
              const errorMsg = data.message || "Unknown error";
              term.write(`\x1b[31mError: ${formatForTerminal(stripAnsi(String(errorMsg)))}\x1b[0m\r\n`);
            } else if (data.type === "done" || data.type === "result") {
              // Stream complete
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }

      clearThinking(false);

      if (lineBuffer) {
        term.write(formatForTerminal(formatMarkdown(lineBuffer)));
        term.write("\r\n");
      }

      if (fullText) {
        agentMessages.push({
          id: `msg-${++messageIdCounter}`,
          role: "assistant",
          parts: [{ type: "text", text: fullText }],
        });
      }

      return { stdout: "", stderr: "", exitCode: 0 };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      agentMessages.pop();
      return { stdout: "", stderr: `Error: ${message}\n`, exitCode: 1 };
    }
  });

  return agentCmd;
}
