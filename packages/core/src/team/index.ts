/**
 * Team module - Viben Agent Organization
 *
 * This module implements functionality equivalent to `trellis init`,
 * generating `.viben/` and `.claude/` directories with all necessary
 * configuration files, scripts, and templates.
 */

export { initTeam, InitOptions, ProjectType, InitResult } from "./init";
export { nameReplacer, applyReplacements } from "./replacer";
