import type { Metadata } from "next";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** 默认 OG 图片绝对 URL */
export const DEFAULT_OG_IMAGE = `${APP_URL}/opengraph-image`;

type OpenGraph = NonNullable<Metadata["openGraph"]>;
type Twitter = NonNullable<Metadata["twitter"]>;

/**
 * 创建完整的 openGraph 对象，自动注入默认 siteName、locale、images。
 * 页面自定义字段通过 overrides 传入，会覆盖默认值。
 */
export function makeOG(overrides: OpenGraph = {}): OpenGraph {
  return {
    siteName: "Viben",
    locale: "zh_CN",
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
    ...overrides,
  };
}

/**
 * 创建完整的 twitter 对象，自动注入默认 card 和 images。
 * 页面自定义字段通过 overrides 传入，会覆盖默认值。
 */
export function makeTwitter(overrides: Twitter = {}): Twitter {
  return {
    card: "summary_large_image",
    images: [DEFAULT_OG_IMAGE],
    ...overrides,
  };
}
