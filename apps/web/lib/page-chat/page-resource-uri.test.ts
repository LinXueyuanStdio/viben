import { describe, expect, test } from "vitest";
import {
  buildPublishedPageContentResourceUri,
  parsePageResourceUri,
} from "./page-resource-uri";

describe("page resource URI", () => {
  test("builds API-shaped page content URI", () => {
    expect(buildPublishedPageContentResourceUri("page-1")).toBe(
      "viben://api/pages/page-1/content",
    );
  });

  test("parses published page content URI", () => {
    expect(parsePageResourceUri("viben://api/pages/page-1/content")).toEqual({
      type: "published_page_content",
      publishedPageId: "page-1",
    });
  });

  test("rejects malformed or unsupported URIs", () => {
    expect(parsePageResourceUri("viben://api/pages//content")).toBeNull();
    expect(parsePageResourceUri("viben://api/pages/page-1")).toBeNull();
    expect(parsePageResourceUri("viben://api/pages/page-1/content/extra")).toBeNull();
    expect(parsePageResourceUri("viben://api/pages/page-1/content?x=1")).toBeNull();
    expect(parsePageResourceUri("viben://page/v1/published/page-1/content")).toBeNull();
    expect(parsePageResourceUri("viben-page://published/page-1")).toBeNull();
  });

  test("rejects malformed percent-encoding without throwing", () => {
    expect(parsePageResourceUri("viben://api/pages/%zz/content")).toBeNull();
  });

  test("rejects unsafe page ids when building", () => {
    expect(() => buildPublishedPageContentResourceUri("")).toThrow(
      "publishedPageId is required",
    );
    expect(() => buildPublishedPageContentResourceUri("a/b")).toThrow(
      "publishedPageId must not contain slash",
    );
  });
});
