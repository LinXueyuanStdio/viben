import type { ReactElement, ReactNode } from "react";
import { toast as sonnerToast, type ExternalToast } from "sonner";

// ============================================================================
// Types
// ============================================================================

export type ToastType = "success" | "error" | "warning" | "info" | "loading" | "default";

export interface ToastAction {
  /** Button label */
  label: string;
  /** Click handler */
  onClick: () => void;
}

export interface ToastOptions extends Omit<ExternalToast, "action"> {
  /** Optional description text */
  description?: string;
  /** Auto-dismiss duration in ms (default: 4000, 0 for no auto-dismiss) */
  duration?: number;
  /** Action button configuration */
  action?: ToastAction;
  /** Cancel button configuration */
  cancel?: ToastAction;
  /** Custom icon */
  icon?: ReactNode;
  /** Called when toast is dismissed */
  onDismiss?: (toast: { id: string | number }) => void;
  /** Called when toast auto-closes */
  onAutoClose?: (toast: { id: string | number }) => void;
}

export interface PromiseToastMessages<T = unknown> {
  /** Message shown while promise is pending */
  loading: string;
  /** Message shown on success (can be function receiving resolved data) */
  success: string | ((data: T) => string);
  /** Message shown on error (can be function receiving error) */
  error: string | ((error: unknown) => string);
}

export interface PromiseToastOptions<T = unknown> extends Omit<ToastOptions, "duration"> {
  /** Custom messages for each state */
  messages?: PromiseToastMessages<T>;
}

// ============================================================================
// Toast Functions
// ============================================================================

/**
 * Show a default toast notification
 */
function showToast(message: string, options?: ToastOptions): string | number {
  return sonnerToast(message, transformOptions(options));
}

/**
 * Show a success toast notification
 */
function success(message: string, options?: ToastOptions): string | number {
  return sonnerToast.success(message, transformOptions(options));
}

/**
 * Show an error toast notification
 */
function error(message: string, options?: ToastOptions): string | number {
  return sonnerToast.error(message, transformOptions(options));
}

/**
 * Show a warning toast notification
 */
function warning(message: string, options?: ToastOptions): string | number {
  return sonnerToast.warning(message, transformOptions(options));
}

/**
 * Show an info toast notification
 */
function info(message: string, options?: ToastOptions): string | number {
  return sonnerToast.info(message, transformOptions(options));
}

/**
 * Show a loading toast notification
 * Returns toast ID for updating later
 */
function loading(message: string, options?: ToastOptions): string | number {
  return sonnerToast.loading(message, transformOptions(options));
}

/**
 * Show a promise-based toast that updates based on promise state
 *
 * @example
 * toast.promise(fetchData(), {
 *   loading: "Fetching data...",
 *   success: "Data loaded successfully",
 *   error: "Failed to load data",
 * });
 *
 * // With dynamic messages:
 * toast.promise(saveFile(filename), {
 *   loading: "Saving...",
 *   success: (data) => `Saved ${data.name}`,
 *   error: (err) => `Error: ${err.message}`,
 * });
 */
function promise<T>(
  promiseOrFunc: Promise<T> | (() => Promise<T>),
  messages: PromiseToastMessages<T>,
  options?: Omit<ToastOptions, "duration">
): string | number {
  const result = sonnerToast.promise(promiseOrFunc, {
    ...messages,
    ...transformOptions(options),
  });
  // sonnerToast.promise returns a wrapped type, extract the toast ID
  return result as unknown as string | number;
}

/**
 * Update an existing toast by ID
 */
function update(
  id: string | number,
  message: string,
  options?: ToastOptions
): void {
  sonnerToast(message, {
    ...transformOptions(options),
    id,
  });
}

/**
 * Dismiss a specific toast by ID, or all toasts if no ID provided
 */
function dismiss(id?: string | number): void {
  if (id !== undefined) {
    sonnerToast.dismiss(id);
  } else {
    sonnerToast.dismiss();
  }
}

/**
 * Show a custom toast with React node content
 */
function custom(
  jsx: ReactElement | (() => ReactElement),
  options?: Omit<ToastOptions, "description">
): string | number {
  const renderFunc = typeof jsx === "function" ? jsx : () => jsx;
  return sonnerToast.custom(renderFunc, transformOptions(options));
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform our options to sonner's expected format
 */
function transformOptions(options?: ToastOptions): ExternalToast | undefined {
  if (!options) return undefined;

  const { action, cancel, ...rest } = options;

  const transformed: ExternalToast = { ...rest };

  // Transform action button
  if (action) {
    transformed.action = {
      label: action.label,
      onClick: action.onClick,
    };
  }

  // Transform cancel button
  if (cancel) {
    transformed.cancel = {
      label: cancel.label,
      onClick: cancel.onClick,
    };
  }

  return transformed;
}

// ============================================================================
// Toast Object Export
// ============================================================================

/**
 * Toast notification utilities
 *
 * @example
 * import { toast } from "@/hooks/use-toast";
 *
 * // Basic usage
 * toast.success("Operation completed");
 * toast.error("Something went wrong");
 * toast.warning("Please check your input");
 * toast.info("Here's some information");
 * toast.loading("Processing...");
 *
 * // With description
 * toast.success("File saved", {
 *   description: "Your changes have been saved to disk",
 * });
 *
 * // With action button
 * toast.info("New update available", {
 *   action: {
 *     label: "Install",
 *     onClick: () => installUpdate(),
 *   },
 * });
 *
 * // Promise-based
 * toast.promise(saveData(), {
 *   loading: "Saving...",
 *   success: "Saved successfully",
 *   error: "Failed to save",
 * });
 *
 * // Update existing toast
 * const id = toast.loading("Processing...");
 * // ... later
 * toast.update(id, "Complete!", { type: "success" });
 *
 * // Dismiss
 * toast.dismiss(id); // Specific toast
 * toast.dismiss();   // All toasts
 */
export const toast = {
  /** Show a default toast */
  default: showToast,
  /** Show a success toast */
  success,
  /** Show an error toast */
  error,
  /** Show a warning toast */
  warning,
  /** Show an info toast */
  info,
  /** Show a loading toast */
  loading,
  /** Show a promise-based toast */
  promise,
  /** Update an existing toast */
  update,
  /** Dismiss toast(s) */
  dismiss,
  /** Show a custom toast with React content */
  custom,
};

// ============================================================================
// Hook Export (for consistency with other hooks)
// ============================================================================

/**
 * Hook that returns toast utilities
 *
 * This hook is provided for consistency with other hooks in the codebase.
 * For most use cases, you can import `toast` directly instead.
 *
 * @example
 * import { useToast } from "@/hooks";
 *
 * function MyComponent() {
 *   const toast = useToast();
 *
 *   const handleClick = () => {
 *     toast.success("Action completed");
 *   };
 *
 *   return <button onClick={handleClick}>Click me</button>;
 * }
 */
export function useToast() {
  return toast;
}

export default toast;
