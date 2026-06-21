import { beforeEach, describe, expect, it } from "vitest";
import {
  getPagePublishKey,
  usePagePublishStore,
} from "./page-publish-store";

describe("page publish store", () => {
  beforeEach(() => {
    usePagePublishStore.getState().actions.reset();
  });

  it("tracks publishing state by workspace and page uid", () => {
    const demoKey = getPagePublishKey("/tmp/workspace", "demo");
    const otherKey = getPagePublishKey("/tmp/workspace", "other");

    usePagePublishStore.getState().actions.startPublish(demoKey);

    expect(usePagePublishStore.getState().entries[demoKey]).toMatchObject({
      status: "publishing",
      url: null,
      error: null,
    });
    expect(usePagePublishStore.getState().entries[otherKey]).toBeUndefined();
  });

  it("keeps the published URL while a later publish is refreshing", () => {
    const key = getPagePublishKey("/tmp/workspace", "demo");

    usePagePublishStore.getState().actions.finishPublish(
      key,
      "/page/user-1/demo"
    );
    usePagePublishStore.getState().actions.startPublish(key);

    expect(usePagePublishStore.getState().entries[key]).toMatchObject({
      status: "publishing",
      url: "/page/user-1/demo",
      error: null,
    });
  });

  it("keeps the last published URL after a refresh failure", () => {
    const key = getPagePublishKey("/tmp/workspace", "demo");

    usePagePublishStore.getState().actions.finishPublish(
      key,
      "/page/user-1/demo"
    );
    usePagePublishStore.getState().actions.failPublish(key, "Publish failed");

    expect(usePagePublishStore.getState().entries[key]).toMatchObject({
      status: "failed",
      url: "/page/user-1/demo",
      error: "Publish failed",
    });
  });
});
