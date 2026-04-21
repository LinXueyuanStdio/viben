import { useEffect, useRef } from "react";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { useOverlayContext } from "../overlay-provider";
import { useVoiceStore } from "@/stores/voice-store";
import { PixiZIndex } from "@/types/overlay";

const SUBTITLE_CONFIG = {
  paddingX: 24,
  paddingY: 12,
  borderRadius: 12,
  backgroundColor: 0x000000,
  backgroundAlpha: 0.6,
  fontSize: 18,
  fontFamily: "system-ui, -apple-system, sans-serif",
  textColor: 0xffffff,
  maxWidth: 600,
  topMargin: 60,
  cursorBlinkInterval: 500,
};

export function VoiceSubtitleLayer(): null {
  const { app, isReady } = useOverlayContext();
  const connectionState = useVoiceStore((s) => s.connectionState);
  const userTranscript = useVoiceStore((s) => s.userTranscript);

  const containerRef = useRef<Container | null>(null);
  const bgRef = useRef<Graphics | null>(null);
  const textRef = useRef<Text | null>(null);
  const cursorRef = useRef<Graphics | null>(null);
  const cursorVisibleRef = useRef(true);
  const blinkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 初始化容器
  useEffect(() => {
    if (!app || !isReady) return;

    const container = new Container();
    container.zIndex = PixiZIndex.Custom; // 在波浪之上
    container.visible = false;
    app.stage.addChild(container);
    containerRef.current = container;

    // 背景
    const bg = new Graphics();
    container.addChild(bg);
    bgRef.current = bg;

    // 文字
    const textStyle = new TextStyle({
      fontFamily: SUBTITLE_CONFIG.fontFamily,
      fontSize: SUBTITLE_CONFIG.fontSize,
      fill: SUBTITLE_CONFIG.textColor,
      wordWrap: true,
      wordWrapWidth: SUBTITLE_CONFIG.maxWidth - SUBTITLE_CONFIG.paddingX * 2,
    });
    const text = new Text({ text: "", style: textStyle });
    container.addChild(text);
    textRef.current = text;

    // 光标
    const cursor = new Graphics();
    cursor.rect(0, 0, 2, SUBTITLE_CONFIG.fontSize);
    cursor.fill({ color: SUBTITLE_CONFIG.textColor });
    container.addChild(cursor);
    cursorRef.current = cursor;

    return () => {
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
      }
      container.destroy({ children: true });
      containerRef.current = null;
      bgRef.current = null;
      textRef.current = null;
      cursorRef.current = null;
    };
  }, [app, isReady]);

  // 更新字幕内容
  useEffect(() => {
    const container = containerRef.current;
    const bg = bgRef.current;
    const text = textRef.current;
    const cursor = cursorRef.current;

    if (!container || !bg || !text || !cursor) return;

    const isActive =
      connectionState === "listening" ||
      connectionState === "processing" ||
      connectionState === "speaking";

    if (!isActive || !userTranscript) {
      container.visible = false;
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
        blinkIntervalRef.current = null;
      }
      return;
    }

    container.visible = true;
    text.text = userTranscript;

    // 计算尺寸
    const textWidth = Math.min(
      text.width,
      SUBTITLE_CONFIG.maxWidth - SUBTITLE_CONFIG.paddingX * 2
    );
    const textHeight = text.height;
    const boxWidth = textWidth + SUBTITLE_CONFIG.paddingX * 2;
    const boxHeight = textHeight + SUBTITLE_CONFIG.paddingY * 2;

    // 绘制背景
    bg.clear();
    bg.roundRect(0, 0, boxWidth, boxHeight, SUBTITLE_CONFIG.borderRadius);
    bg.fill({
      color: SUBTITLE_CONFIG.backgroundColor,
      alpha: SUBTITLE_CONFIG.backgroundAlpha,
    });

    // 定位文字
    text.x = SUBTITLE_CONFIG.paddingX;
    text.y = SUBTITLE_CONFIG.paddingY;

    // 定位光标
    cursor.x = text.x + text.width + 4;
    cursor.y = text.y;

    // 居中容器
    const screenWidth = window.innerWidth;
    container.x = (screenWidth - boxWidth) / 2;
    container.y = SUBTITLE_CONFIG.topMargin;

    // 启动光标闪烁
    if (!blinkIntervalRef.current) {
      blinkIntervalRef.current = setInterval(() => {
        cursorVisibleRef.current = !cursorVisibleRef.current;
        if (cursorRef.current) {
          cursorRef.current.visible = cursorVisibleRef.current;
        }
      }, SUBTITLE_CONFIG.cursorBlinkInterval);
    }
  }, [connectionState, userTranscript]);

  return null;
}
