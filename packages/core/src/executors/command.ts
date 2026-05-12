/**
 * Command builder for executor processes
 */

/**
 * Parsed command parts ready for execution
 */
export interface CommandParts {
  /** The program to execute */
  program: string;
  /** Arguments to pass to the program */
  args: string[];
  /** Environment variables to set */
  env: Record<string, string>;
}

/**
 * Error building a command
 */
export class CommandBuildError extends Error {
  constructor(
    message: string,
    public code: string = "COMMAND_BUILD_ERROR"
  ) {
    super(message);
    this.name = "CommandBuildError";
  }

  static emptyCommand(): CommandBuildError {
    return new CommandBuildError("Command is empty", "EMPTY_COMMAND");
  }

  static parseError(reason: string): CommandBuildError {
    return new CommandBuildError(
      `Failed to parse command: ${reason}`,
      "PARSE_ERROR"
    );
  }
}

/**
 * Builder for constructing executor commands
 */
export class CommandBuilder {
  private baseCommand: string;
  private params: string[] = [];
  private envVars: Record<string, string> = {};

  constructor(baseCommand: string) {
    this.baseCommand = baseCommand;
  }

  /**
   * Create a new command builder with a base command
   */
  static new(baseCommand: string): CommandBuilder {
    return new CommandBuilder(baseCommand);
  }

  /**
   * Add parameters
   */
  addParams(...params: string[]): CommandBuilder {
    this.params.push(...params);
    return this;
  }

  /**
   * Extend with additional parameters
   */
  extendParams(params: string[]): CommandBuilder {
    this.params.push(...params);
    return this;
  }

  /**
   * Set an environment variable
   */
  env(key: string, value: string): CommandBuilder {
    this.envVars[key] = value;
    return this;
  }

  /**
   * Build command for initial spawn
   */
  buildInitial(): CommandParts {
    return this.build();
  }

  /**
   * Build command for follow-up (continuing a session)
   */
  buildFollowUp(extraArgs: string[]): CommandParts {
    const parts = this.build();
    parts.args.push(...extraArgs);
    return parts;
  }

  /**
   * Build the command parts
   */
  private build(): CommandParts {
    // Parse the base command (may contain "npx -y @package" style)
    const cmdParts = this.baseCommand.split(/\s+/).filter(Boolean);

    if (cmdParts.length === 0) {
      throw CommandBuildError.emptyCommand();
    }

    const program = cmdParts[0];
    const args = [...cmdParts.slice(1), ...this.params];

    return {
      program,
      args,
      env: { ...this.envVars },
    };
  }
}

/**
 * Create command parts directly
 */
export function createCommandParts(program: string): CommandParts {
  return {
    program,
    args: [],
    env: {},
  };
}
