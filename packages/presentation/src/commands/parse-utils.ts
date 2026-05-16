/** Parse a value as number, returning fallback if not parseable */
export function num(val: unknown, fallback: number): number {
  if (val === undefined || val === null) return fallback
  if (typeof val === "number") return val
  const n = Number(val)
  return Number.isNaN(n) ? fallback : n
}

/** Parse a value as boolean */
export function bool(val: unknown, fallback: boolean): boolean {
  if (val === undefined || val === null) return fallback
  if (typeof val === "boolean") return val
  if (val === "true" || val === "1") return true
  if (val === "false" || val === "0") return false
  return fallback
}

/** Parse a value as JSON object/array, returning fallback if not parseable */
export function json<T>(val: unknown, fallback: T): T {
  if (val === undefined || val === null) return fallback
  if (typeof val === "object") return val as T
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T
    } catch {
      return fallback
    }
  }
  return fallback
}

/** Get string value or fallback */
export function str(val: unknown, fallback: string): string {
  if (val === undefined || val === null) return fallback
  return String(val)
}

/** Get string value or undefined */
export function strOpt(val: unknown): string | undefined {
  if (val === undefined || val === null) return undefined
  return String(val)
}

/** Get number value or undefined */
export function numOpt(val: unknown): number | undefined {
  if (val === undefined || val === null) return undefined
  if (typeof val === "number") return val
  const n = Number(val)
  return Number.isNaN(n) ? undefined : n
}
