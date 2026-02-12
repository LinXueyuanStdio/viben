/**
 * Name replacement utilities for converting Trellis content to Viben
 *
 * This module provides functions to transform Trellis templates to Viben
 * by replacing all naming conventions.
 */

export type Brand = "trellis" | "viben";

/**
 * Replacement rules for name transformation
 */
export interface ReplacementRule {
  /** Pattern to match */
  from: string | RegExp;
  /** Replacement string */
  to: string;
}

/**
 * Get replacement rules for transforming from one brand to another
 */
export function getReplacementRules(
  fromBrand: Brand,
  toBrand: Brand
): ReplacementRule[] {
  if (fromBrand === toBrand) {
    return [];
  }

  if (fromBrand === "trellis" && toBrand === "viben") {
    return [
      // Directory names (order matters - longer first)
      { from: ".trellis", to: ".viben" },
      { from: "/trellis:", to: "/viben:" },
      { from: "trellis:", to: "viben:" },
      // Case variations
      { from: "TRELLIS", to: "VIBEN" },
      { from: "Trellis", to: "Viben" },
      { from: "trellis", to: "viben" },
    ];
  }

  if (fromBrand === "viben" && toBrand === "trellis") {
    return [
      // Directory names (order matters - longer first)
      { from: ".viben", to: ".trellis" },
      { from: "/viben:", to: "/trellis:" },
      { from: "viben:", to: "trellis:" },
      // Case variations
      { from: "VIBEN", to: "TRELLIS" },
      { from: "Viben", to: "Trellis" },
      { from: "viben", to: "trellis" },
    ];
  }

  return [];
}

/**
 * Apply all replacement rules to content
 */
export function applyReplacements(content: string, rules: ReplacementRule[]): string {
  let result = content;
  for (const rule of rules) {
    if (typeof rule.from === "string") {
      result = result.split(rule.from).join(rule.to);
    } else {
      result = result.replace(rule.from, rule.to);
    }
  }
  return result;
}

/**
 * Create a name replacer function for transforming content
 */
export function nameReplacer(fromBrand: Brand, toBrand: Brand) {
  const rules = getReplacementRules(fromBrand, toBrand);
  return (content: string) => applyReplacements(content, rules);
}

/**
 * Transform file path from one brand to another
 */
export function transformPath(path: string, fromBrand: Brand, toBrand: Brand): string {
  const rules = getReplacementRules(fromBrand, toBrand);
  return applyReplacements(path, rules);
}
