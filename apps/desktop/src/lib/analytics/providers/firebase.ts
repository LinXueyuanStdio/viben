/**
 * Firebase Analytics Provider
 *
 * 实现 AnalyticsProvider 接口，封装 Firebase Analytics SDK。
 * 业务代码不直接使用此类——通过工厂注册后，使用 useAnalytics() hook。
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAnalytics,
  logEvent as firebaseLogEvent,
  setUserId as firebaseSetUserId,
  setUserProperties as firebaseSetUserProperties,
  type Analytics,
} from "firebase/analytics";
import type { AnalyticsProvider } from "../provider";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
}

export class FirebaseAnalyticsProvider implements AnalyticsProvider {
  readonly name = "firebase";

  private app: FirebaseApp | null = null;
  private analytics: Analytics | null = null;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const firebaseConfig = config as unknown as FirebaseConfig;

    this.app = initializeApp(firebaseConfig);
    this.analytics = getAnalytics(this.app);

    if (import.meta.env.DEV) {
      console.log("[analytics] Firebase 初始化完成", {
        projectId: firebaseConfig.projectId,
        measurementId: firebaseConfig.measurementId,
      });
    }
  }

  logEvent(eventName: string, params?: Record<string, unknown>): void {
    if (!this.analytics) {
      if (import.meta.env.DEV) {
        console.warn("[analytics] Firebase 未初始化，跳过事件:", eventName);
      }
      return;
    }
    firebaseLogEvent(this.analytics, eventName, params ?? {});
  }

  setUserId(userId: string | null): void {
    if (!this.analytics) return;
    firebaseSetUserId(this.analytics, userId);
  }

  setUserProperties(properties: Record<string, unknown>): void {
    if (!this.analytics) return;
    firebaseSetUserProperties(this.analytics, properties as Record<string, string>);
  }

  setScreenName(screenName: string): void {
    // Firebase Analytics 自动采集 screen_view 事件，
    // 此处补充手动设置以确保与自定义 page_view 事件一致
    this.logEvent("screen_view", { firebase_screen: screenName });
  }

  async flush(): Promise<void> {
    // Firebase Analytics SDK 自动批量发送，无需手动 flush
  }
}
