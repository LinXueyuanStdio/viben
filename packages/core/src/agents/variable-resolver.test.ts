/**
 * Variable Resolver Tests
 *
 * Tests for extracting and resolving template variables in agent prompts.
 * Three variable types:
 * - Predefined: {{workspace_name}}, {{current_date}}, etc.
 * - Environment: {{env.API_KEY}}
 * - Custom: {{custom.project_type}}
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  extractVariables,
  resolveVariables,
  PREDEFINED_VARIABLES,
  type VariableContext,
  type ExtractedVariables,
} from "./variable-resolver";

describe("Variable Resolver", () => {
  // ==========================================================================
  // extractVariables Tests
  // ==========================================================================

  describe("extractVariables", () => {
    it("should return empty arrays for text without variables", () => {
      const result = extractVariables("Hello, this is plain text.");

      expect(result.predefined).toEqual([]);
      expect(result.env).toEqual([]);
      expect(result.custom).toEqual([]);
    });

    it("should extract predefined variables", () => {
      const result = extractVariables(
        "Working in {{workspace_name}} on {{current_date}}"
      );

      expect(result.predefined).toContain("workspace_name");
      expect(result.predefined).toContain("current_date");
      expect(result.env).toEqual([]);
      expect(result.custom).toEqual([]);
    });

    it("should extract all predefined variable types", () => {
      const text = `
        Workspace: {{workspace_name}}
        Path: {{workspace_path}}
        Agent: {{agent_name}}
        Date: {{current_date}}
        Time: {{current_time}}
        DateTime: {{current_datetime}}
        Platform: {{os_platform}}
        Home: {{user_home}}
      `;
      const result = extractVariables(text);

      expect(result.predefined).toHaveLength(8);
      expect(result.predefined).toContain("workspace_name");
      expect(result.predefined).toContain("workspace_path");
      expect(result.predefined).toContain("agent_name");
      expect(result.predefined).toContain("current_date");
      expect(result.predefined).toContain("current_time");
      expect(result.predefined).toContain("current_datetime");
      expect(result.predefined).toContain("os_platform");
      expect(result.predefined).toContain("user_home");
    });

    it("should extract environment variables", () => {
      const result = extractVariables(
        "API Key: {{env.API_KEY}}, Secret: {{env.SECRET_TOKEN}}"
      );

      expect(result.env).toContain("API_KEY");
      expect(result.env).toContain("SECRET_TOKEN");
      expect(result.predefined).toEqual([]);
      expect(result.custom).toEqual([]);
    });

    it("should extract custom variables", () => {
      const result = extractVariables(
        "Project type: {{custom.project_type}}, Author: {{custom.author_name}}"
      );

      expect(result.custom).toContain("project_type");
      expect(result.custom).toContain("author_name");
      expect(result.predefined).toEqual([]);
      expect(result.env).toEqual([]);
    });

    it("should extract mixed variable types", () => {
      const text = `
        Working in {{workspace_name}} on {{current_date}}.
        Using API key: {{env.OPENAI_API_KEY}}.
        Project: {{custom.project_name}}.
      `;
      const result = extractVariables(text);

      expect(result.predefined).toContain("workspace_name");
      expect(result.predefined).toContain("current_date");
      expect(result.env).toContain("OPENAI_API_KEY");
      expect(result.custom).toContain("project_name");
    });

    it("should deduplicate repeated variables", () => {
      const result = extractVariables(
        "{{workspace_name}} - {{workspace_name}} - {{env.KEY}} - {{env.KEY}}"
      );

      expect(result.predefined).toHaveLength(1);
      expect(result.predefined).toContain("workspace_name");
      expect(result.env).toHaveLength(1);
      expect(result.env).toContain("KEY");
    });

    it("should handle variables with underscores", () => {
      const result = extractVariables(
        "{{env.MY_LONG_API_KEY}} and {{custom.my_custom_var}}"
      );

      expect(result.env).toContain("MY_LONG_API_KEY");
      expect(result.custom).toContain("my_custom_var");
    });

    it("should not extract invalid variable syntax", () => {
      const result = extractVariables(
        "{{}} and {{ invalid }} and {not_a_var}"
      );

      expect(result.predefined).toEqual([]);
      expect(result.env).toEqual([]);
      expect(result.custom).toEqual([]);
    });

    it("should classify unknown variables as custom", () => {
      const result = extractVariables("{{unknown_variable}}");

      // Unknown variables that don't match predefined and don't have prefix
      // should be classified as custom
      expect(result.custom).toContain("unknown_variable");
    });
  });

  // ==========================================================================
  // resolveVariables Tests
  // ==========================================================================

  describe("resolveVariables", () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return unchanged text when no variables present", () => {
      const result = resolveVariables("Plain text without variables.", {});

      expect(result.resolved).toBe("Plain text without variables.");
      expect(result.unresolvedCustom).toEqual([]);
    });

    it("should resolve workspace_name variable", () => {
      const context: VariableContext = {
        workspace: { name: "my-project", path: "/path/to/project" },
      };
      const result = resolveVariables("Project: {{workspace_name}}", context);

      expect(result.resolved).toBe("Project: my-project");
      expect(result.unresolvedCustom).toEqual([]);
    });

    it("should resolve workspace_path variable", () => {
      const context: VariableContext = {
        workspace: { name: "my-project", path: "/path/to/project" },
      };
      const result = resolveVariables("Path: {{workspace_path}}", context);

      expect(result.resolved).toBe("Path: /path/to/project");
      expect(result.unresolvedCustom).toEqual([]);
    });

    it("should resolve agent_name variable", () => {
      const context: VariableContext = {
        agent: { name: "code-assistant" },
      };
      const result = resolveVariables("Agent: {{agent_name}}", context);

      expect(result.resolved).toBe("Agent: code-assistant");
      expect(result.unresolvedCustom).toEqual([]);
    });

    it("should resolve current_date variable", () => {
      const result = resolveVariables("Date: {{current_date}}", {});

      // Should be in YYYY-MM-DD format
      expect(result.resolved).toMatch(/Date: \d{4}-\d{2}-\d{2}/);
      expect(result.unresolvedCustom).toEqual([]);
    });

    it("should resolve current_time variable", () => {
      const result = resolveVariables("Time: {{current_time}}", {});

      // Should be in HH:MM format
      expect(result.resolved).toMatch(/Time: \d{2}:\d{2}/);
      expect(result.unresolvedCustom).toEqual([]);
    });

    it("should resolve current_datetime variable", () => {
      const result = resolveVariables("DateTime: {{current_datetime}}", {});

      // Should be in ISO format or similar
      expect(result.resolved).toMatch(/DateTime: .+/);
      expect(result.unresolvedCustom).toEqual([]);
    });

    it("should resolve os_platform variable", () => {
      const result = resolveVariables("Platform: {{os_platform}}", {});

      expect(result.resolved).toMatch(/Platform: (darwin|linux|win32)/);
      expect(result.unresolvedCustom).toEqual([]);
    });

    it("should resolve user_home variable", () => {
      const result = resolveVariables("Home: {{user_home}}", {});

      expect(result.resolved).toMatch(/Home: \/.+/);
      expect(result.unresolvedCustom).toEqual([]);
    });

    it("should resolve environment variables", () => {
      process.env.TEST_API_KEY = "secret-key-123";
      const result = resolveVariables("Key: {{env.TEST_API_KEY}}", {});

      expect(result.resolved).toBe("Key: secret-key-123");
      expect(result.unresolvedCustom).toEqual([]);
    });

    it("should leave unset environment variables as placeholder", () => {
      delete process.env.NONEXISTENT_VAR;
      const result = resolveVariables("Key: {{env.NONEXISTENT_VAR}}", {});

      expect(result.resolved).toBe("Key: {{env.NONEXISTENT_VAR}}");
      expect(result.unresolvedCustom).toEqual([]);
    });

    it("should resolve custom variables from context", () => {
      const context: VariableContext = {
        customValues: {
          project_type: "typescript",
          author: "John Doe",
        },
      };
      const result = resolveVariables(
        "Type: {{custom.project_type}}, Author: {{custom.author}}",
        context
      );

      expect(result.resolved).toBe("Type: typescript, Author: John Doe");
      expect(result.unresolvedCustom).toEqual([]);
    });

    it("should track unresolved custom variables", () => {
      const context: VariableContext = {
        customValues: {
          known_var: "value",
        },
      };
      const result = resolveVariables(
        "{{custom.known_var}} and {{custom.unknown_var}}",
        context
      );

      expect(result.resolved).toBe("value and {{custom.unknown_var}}");
      expect(result.unresolvedCustom).toContain("unknown_var");
    });

    it("should resolve multiple variables in one text", () => {
      process.env.API_KEY = "test-key";
      const context: VariableContext = {
        workspace: { name: "viben", path: "/home/user/viben" },
        agent: { name: "coder" },
        customValues: {
          lang: "TypeScript",
        },
      };
      const text = `
        Working in {{workspace_name}} at {{workspace_path}}.
        Agent: {{agent_name}}.
        Using {{custom.lang}} with key {{env.API_KEY}}.
        Date: {{current_date}}.
      `;
      const result = resolveVariables(text, context);

      expect(result.resolved).toContain("Working in viben");
      expect(result.resolved).toContain("at /home/user/viben");
      expect(result.resolved).toContain("Agent: coder");
      expect(result.resolved).toContain("Using TypeScript");
      expect(result.resolved).toContain("with key test-key");
      expect(result.resolved).toMatch(/Date: \d{4}-\d{2}-\d{2}/);
      expect(result.unresolvedCustom).toEqual([]);
    });

    it("should handle missing workspace context gracefully", () => {
      const result = resolveVariables(
        "{{workspace_name}} at {{workspace_path}}",
        {}
      );

      // Should leave unresolved
      expect(result.resolved).toBe("{{workspace_name}} at {{workspace_path}}");
    });

    it("should handle missing agent context gracefully", () => {
      const result = resolveVariables("Agent: {{agent_name}}", {});

      // Should leave unresolved
      expect(result.resolved).toBe("Agent: {{agent_name}}");
    });

    it("should handle unknown variables without prefix", () => {
      const result = resolveVariables("{{unknown_variable}}", {});

      // Unknown variables without prefix should be treated as custom
      expect(result.resolved).toBe("{{unknown_variable}}");
      expect(result.unresolvedCustom).toContain("unknown_variable");
    });
  });

  // ==========================================================================
  // PREDEFINED_VARIABLES constant Tests
  // ==========================================================================

  describe("PREDEFINED_VARIABLES", () => {
    it("should contain all expected predefined variables", () => {
      expect(PREDEFINED_VARIABLES).toContain("workspace_name");
      expect(PREDEFINED_VARIABLES).toContain("workspace_path");
      expect(PREDEFINED_VARIABLES).toContain("agent_name");
      expect(PREDEFINED_VARIABLES).toContain("current_date");
      expect(PREDEFINED_VARIABLES).toContain("current_time");
      expect(PREDEFINED_VARIABLES).toContain("current_datetime");
      expect(PREDEFINED_VARIABLES).toContain("os_platform");
      expect(PREDEFINED_VARIABLES).toContain("user_home");
    });

    it("should have exactly 8 predefined variables", () => {
      expect(PREDEFINED_VARIABLES).toHaveLength(8);
    });
  });
});
