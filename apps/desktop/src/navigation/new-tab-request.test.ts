import { describe, expect, it } from "vitest";
import {
  hasNewTabRequest,
  withNewTabRequest,
  withoutNewTabRequest,
} from "./new-tab-request";

describe("new tab request URLs", () => {
  it("adds the new-tab marker while preserving query params and hash", () => {
    expect(withNewTabRequest("/workspace/global?source=preview#top")).toBe(
      "/workspace/global?source=preview&viben_new_tab=1#top"
    );
  });

  it("detects and removes the new-tab marker", () => {
    const search = "?source=preview&viben_new_tab=1";

    expect(hasNewTabRequest(search)).toBe(true);
    expect(withoutNewTabRequest(`/workspace/global${search}`)).toBe(
      "/workspace/global?source=preview"
    );
  });
});
