/**
 * Firebase Service — Bug Reporting, Analytics, Push Notifications
 *
 * 客户端 sidecar 定位：使用 firebase Web SDK（非 admin），搭配 Firestore Lite。
 * 初始化使用 Web 配置，支持环境变量覆盖。
 *
 * Lazy-initialized: firebase 仅在首次调用时加载。
 * 未配置时优雅降级为 noop。
 */

import { logger } from "../telemetry/global-logger";
import { createProxyFetch } from "../http";
import type { FirebaseApp } from "firebase/app";
import type { Firestore, QueryConstraint } from "firebase/firestore/lite";

const log = logger.child({ module: "firebase" });

// 注入代理感知的 fetch，Firebase SDK 内部请求会走代理
const proxyFetch = createProxyFetch();
if (proxyFetch !== globalThis.fetch) {
  globalThis.fetch = proxyFetch;
  log.debug("Proxy-aware fetch injected for Firebase SDK");
}

// =============================================================================
// Types
// =============================================================================

/** Firebase Web 配置 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

/** Bug 上报 — 存储到 Firestore `bug_reports` 集合 */
export interface FirebaseBugReport {
  error_type: string;
  message: string;
  stack_trace?: string;
  component?: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
}

/** 埋点事件 — 存储到 Firestore `analytics_events` 集合 */
export interface FirebaseAnalyticsEvent {
  name: string;
  params?: Record<string, string | number | boolean>;
  user_id?: string;
}

// =============================================================================
// 默认配置（来自 viben-66118 Web 应用）
// =============================================================================

const DEFAULT_CONFIG: FirebaseConfig = {
  apiKey: "AIzaSyC6TDECJaxRbX77Wqqqw7aygDoqGwOHWBc",
  authDomain: "viben-66118.firebaseapp.com",
  projectId: "viben-66118",
  storageBucket: "viben-66118.firebasestorage.app",
  messagingSenderId: "1080654454499",
  appId: "1:1080654454499:web:5d4cc59188f1f1c6c96fd6",
  measurementId: "G-2Q89T9JQWD",
};

// =============================================================================
// Firebase Service
// =============================================================================

export class FirebaseService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private _initialized = false;
  private _configured = true; // 始终可用 — 使用默认配置或环境变量
  private _initError: string | null = null;

  constructor() {
    log.debug("Firebase service ready (lazy init)");
  }

  /** 解析配置：环境变量优先，fallback 到默认 Web 配置 */
  private resolveConfig(): FirebaseConfig {
    if (process.env.FIREBASE_API_KEY) {
      return {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
        projectId: process.env.FIREBASE_PROJECT_ID || "",
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
        appId: process.env.FIREBASE_APP_ID || "",
        measurementId: process.env.FIREBASE_MEASUREMENT_ID,
      };
    }
    return DEFAULT_CONFIG;
  }

  /** 检查是否已初始化 */
  isInitialized(): boolean {
    return this._initialized;
  }

  /** 获取初始化错误信息 */
  getInitError(): string | null {
    return this._initError;
  }

  // ===========================================================================
  // Initialization（lazy — 首次调用时加载）
  // ===========================================================================

  private async ensureInitialized(): Promise<void> {
    if (this._initialized) return;

    try {
      const { initializeApp } = await import("firebase/app");
      const { getFirestore } = await import("firebase/firestore/lite");

      const config = this.resolveConfig();
      this.app = initializeApp(config);
      this.db = getFirestore(this.app);
      this._initialized = true;

      log.info({ projectId: config.projectId }, "Firebase initialized");
    } catch (err) {
      this._initError = err instanceof Error ? err.message : String(err);
      log.warn({ err }, "Failed to initialize Firebase — service will run in noop mode");
    }
  }

  // ===========================================================================
  // Bug 上报（Firestore）
  // ===========================================================================

  /**
   * 上报 bug / 错误到 Firestore `bug_reports` 集合。
   */
  async reportBug(report: FirebaseBugReport): Promise<void> {
    await this.ensureInitialized();
    if (!this._initialized || !this.db) return;

    try {
      const { collection, addDoc } = await import("firebase/firestore/lite");

      const doc = {
        error_type: report.error_type,
        message: report.message,
        stack_trace: report.stack_trace || null,
        component: report.component || null,
        user_id: report.user_id || null,
        metadata: report.metadata || null,
        timestamp: Date.now(),
      };

      await addDoc(collection(this.db, "bug_reports"), doc);
      log.info({ error_type: report.error_type, component: report.component }, "Bug report saved");
    } catch (err) {
      log.warn({ err, error_type: report.error_type }, "Failed to save bug report");
    }
  }

  /**
   * 查询最近的 bug 报告。
   */
  async queryBugReports(options: {
    limit?: number;
    since?: number;
    error_type?: string;
  } = {}): Promise<Array<FirebaseBugReport & { timestamp: number }>> {
    await this.ensureInitialized();
    if (!this._initialized || !this.db) return [];

    try {
      const { collection, query, where, orderBy, limit, getDocs } = await import("firebase/firestore/lite");

      const constraints: QueryConstraint[] = [
        orderBy("timestamp", "desc"),
      ];

      if (options.since) {
        constraints.push(where("timestamp", ">=", options.since));
      }
      if (options.error_type) {
        constraints.push(where("error_type", "==", options.error_type));
      }
      constraints.push(limit(options.limit || 50));

      const q = query(collection(this.db, "bug_reports"), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          error_type: data["error_type"],
          message: data["message"],
          stack_trace: data["stack_trace"] || undefined,
          component: data["component"] || undefined,
          user_id: data["user_id"] || undefined,
          metadata: data["metadata"] || undefined,
          timestamp: data["timestamp"],
        };
      });
    } catch (err) {
      log.warn({ err }, "Failed to query bug reports");
      return [];
    }
  }

  // ===========================================================================
  // 事件埋点（Firestore）
  // ===========================================================================

  /**
   * 记录用户行为 / 业务事件到 Firestore `analytics_events` 集合。
   */
  async trackEvent(event: FirebaseAnalyticsEvent): Promise<void> {
    await this.ensureInitialized();
    if (!this._initialized || !this.db) return;

    try {
      const { collection, addDoc } = await import("firebase/firestore/lite");

      const doc = {
        name: event.name,
        params: event.params || null,
        user_id: event.user_id || null,
        timestamp: Date.now(),
      };

      await addDoc(collection(this.db, "analytics_events"), doc);
      log.debug({ event_name: event.name }, "Analytics event tracked");
    } catch (err) {
      log.warn({ err, event_name: event.name }, "Failed to track analytics event");
    }
  }

  /**
   * 查询最近的埋点事件。
   */
  async queryEvents(options: {
    limit?: number;
    since?: number;
    event_name?: string;
  } = {}): Promise<Array<{ name: string; params: Record<string, unknown> | null; user_id: string | null; timestamp: number }>> {
    await this.ensureInitialized();
    if (!this._initialized || !this.db) return [];

    try {
      const { collection, query, where, orderBy, limit, getDocs } = await import("firebase/firestore/lite");

      const constraints: QueryConstraint[] = [
        orderBy("timestamp", "desc"),
      ];

      if (options.since) {
        constraints.push(where("timestamp", ">=", options.since));
      }
      if (options.event_name) {
        constraints.push(where("name", "==", options.event_name));
      }
      constraints.push(limit(options.limit || 50));

      const q = query(collection(this.db, "analytics_events"), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          name: data["name"],
          params: data["params"] || null,
          user_id: data["user_id"] || null,
          timestamp: data["timestamp"],
        };
      });
    } catch (err) {
      log.warn({ err }, "Failed to query analytics events");
      return [];
    }
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /** 关闭 Firebase 连接 */
  async shutdown(): Promise<void> {
    if (this.app) {
      try {
        // Client SDK 没有 app.delete()，用 _delete 或直接置空
        this.db = null;
        this.app = null;
        this._initialized = false;
        log.info("Firebase shut down");
      } catch (err) {
        log.warn({ err }, "Failed to shutdown Firebase");
      }
    }
  }
}

/** 单例 */
export const firebaseService = new FirebaseService();
