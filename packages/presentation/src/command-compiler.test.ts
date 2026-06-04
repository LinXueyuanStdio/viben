import { describe, expect, it } from "vitest"
import {
  compilePresentationCommands,
  getPresentationToolNames,
  isClientSidePresentationTool,
  normalizePresentationToolName,
} from "./command-compiler"
import { ALL_STEP_COMMANDS } from "./commands"

describe("command compiler", () => {
  it("exposes every PresentationCommand as a presentation_<commandtype> tool", () => {
    const toolNames = getPresentationToolNames()

    for (const def of ALL_STEP_COMMANDS) {
      const expectedToolName = `presentation_${def.name}`
      const toolName = normalizePresentationToolName(def.name)

      expect(toolName).toBe(expectedToolName)
      expect(toolName).not.toBeNull()
      if (!toolName) throw new Error(`Unknown presentation command: ${def.name}`)

      expect(toolNames).toContain(expectedToolName)
      expect(isClientSidePresentationTool(toolName)).toBe(true)
      expect(normalizePresentationToolName(toolName)).toBe(toolName)
      expect(normalizePresentationToolName(`mcp__presentation__${toolName}`)).toBe(toolName)

      const commands = compilePresentationCommands(toolName, {})
      expect(commands).toHaveLength(1)
      expect(commands[0]?.type).toBe(def.name)
    }
  })
})
