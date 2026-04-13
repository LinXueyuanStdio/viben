/**
 * Cancellation support for onboarding operations
 *
 * Provides cancellable controller pattern for long-running operations
 */

// ============================================================================
// Types
// ============================================================================

/**
 * 取消域 - 用于标识可取消的操作范围
 */
export type CancellationDomain =
  | "node-check"
  | "node-install"
  | "cli-check"
  | "cli-install"
  | "gateway-start"
  | "connection-check";

/**
 * 取消原因
 */
export type CancellationReason =
  | "user-requested"
  | "timeout"
  | "superseded"
  | "component-unmount";

/**
 * 取消状态
 */
export interface CancellationState {
  cancelled: boolean;
  reason?: CancellationReason;
  timestamp?: number;
}

// ============================================================================
// CancellableController
// ============================================================================

/**
 * 可取消控制器
 *
 * 提供类似 AbortController 的接口，但支持更丰富的取消语义
 */
export class CancellableController {
  private _state: CancellationState = { cancelled: false };
  private _listeners: Set<(reason: CancellationReason) => void> = new Set();
  private _abortController: AbortController;

  constructor() {
    this._abortController = new AbortController();
  }

  /**
   * 获取 AbortSignal (用于 fetch 等 API)
   */
  get signal(): AbortSignal {
    return this._abortController.signal;
  }

  /**
   * 是否已取消
   */
  get cancelled(): boolean {
    return this._state.cancelled;
  }

  /**
   * 取消原因
   */
  get reason(): CancellationReason | undefined {
    return this._state.reason;
  }

  /**
   * 取消操作
   */
  cancel(reason: CancellationReason = "user-requested"): void {
    if (this._state.cancelled) return;

    this._state = {
      cancelled: true,
      reason,
      timestamp: Date.now(),
    };

    this._abortController.abort();

    for (const listener of this._listeners) {
      try {
        listener(reason);
      } catch (e) {
        console.error("[CancellableController] Listener error:", e);
      }
    }
  }

  /**
   * 添加取消监听器
   */
  onCancel(listener: (reason: CancellationReason) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * 检查是否已取消，如果已取消则抛出错误
   */
  throwIfCancelled(): void {
    if (this._state.cancelled) {
      throw new CancellationError(this._state.reason || "user-requested");
    }
  }

  /**
   * 创建一个在取消时拒绝的 Promise
   */
  createCancellationPromise<T = never>(): Promise<T> {
    return new Promise((_, reject) => {
      if (this._state.cancelled) {
        reject(new CancellationError(this._state.reason || "user-requested"));
        return;
      }

      this.onCancel((reason) => {
        reject(new CancellationError(reason));
      });
    });
  }

  /**
   * 包装一个 Promise，使其可以被取消
   */
  async race<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([promise, this.createCancellationPromise<T>()]);
  }
}

// ============================================================================
// CancellationError
// ============================================================================

/**
 * 取消错误
 */
export class CancellationError extends Error {
  readonly reason: CancellationReason;
  readonly isCancellation = true;

  constructor(reason: CancellationReason) {
    super(`Operation cancelled: ${reason}`);
    this.name = "CancellationError";
    this.reason = reason;
  }
}

/**
 * 判断是否为取消错误
 */
export function isCancellationError(error: unknown): error is CancellationError {
  return (
    error instanceof CancellationError ||
    (error instanceof Error && (error as CancellationError).isCancellation === true)
  );
}

// ============================================================================
// Domain Registry
// ============================================================================

/**
 * 取消域注册表
 *
 * 管理多个域的取消控制器
 */
export class CancellationRegistry {
  private _controllers = new Map<CancellationDomain, CancellableController>();

  /**
   * 获取或创建域控制器
   */
  getOrCreate(domain: CancellationDomain): CancellableController {
    let controller = this._controllers.get(domain);

    if (!controller || controller.cancelled) {
      controller = new CancellableController();
      this._controllers.set(domain, controller);
    }

    return controller;
  }

  /**
   * 取消指定域
   */
  cancel(domain: CancellationDomain, reason: CancellationReason = "user-requested"): void {
    const controller = this._controllers.get(domain);
    controller?.cancel(reason);
  }

  /**
   * 取消所有域
   */
  cancelAll(reason: CancellationReason = "component-unmount"): void {
    for (const controller of this._controllers.values()) {
      controller.cancel(reason);
    }
  }

  /**
   * 重置指定域
   */
  reset(domain: CancellationDomain): CancellableController {
    const controller = new CancellableController();
    this._controllers.set(domain, controller);
    return controller;
  }

  /**
   * 清理所有控制器
   */
  dispose(): void {
    this.cancelAll("component-unmount");
    this._controllers.clear();
  }
}

// ============================================================================
// React Hook Support
// ============================================================================

/**
 * 创建用于 React useEffect 的取消支持
 */
export function createEffectCancellation(): {
  controller: CancellableController;
  cleanup: () => void;
} {
  const controller = new CancellableController();

  return {
    controller,
    cleanup: () => controller.cancel("component-unmount"),
  };
}
