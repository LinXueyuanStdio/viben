/**
 * Detection utilities for apply_patch tool calls.
 *
 * Some agents (e.g., OpenCode) use an "apply_patch" tool with kind "other"
 * to modify files via unified diff patches. These need special handling:
 * - Security: permission gating must treat them as write operations
 * - File preview: extractFileInfo must parse the patch output format
 *   instead of the standard read/edit/write content format
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Check if rawInput contains a patchText/patch_text field (indicates apply_patch semantics). */
export function hasApplyPatchPatchText(rawInput: unknown): boolean {
  const input = asRecord(rawInput);
  return !!input && (typeof input.patchText === "string" || typeof input.patch_text === "string");
}

/**
 * Determine if a tool call is an apply_patch operation.
 *
 * Matches either by explicit tool name ("apply_patch") or by the presence
 * of a patchText field in rawInput — both indicate file modification via
 * unified diff that requires write-level permission gating.
 */
export function isApplyPatchOtherTool(kind: string | undefined, name: string, rawInput: unknown): boolean {
  // Only "other" kind tools can be apply_patch — read/edit/write are handled normally
  if (kind !== "other") return false;
  if (name.toLowerCase() === "apply_patch") return true;
  return hasApplyPatchPatchText(rawInput);
}
