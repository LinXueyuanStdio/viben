import { describe, expect, expectTypeOf, test } from "vitest";
import type { ChatAppMode, ChatAppProps } from "./ChatApp";

type ExportedTypeNames = keyof typeof import("./ChatApp");

expectTypeOf<ChatAppProps["mode"]>().toEqualTypeOf<ChatAppMode>();
expectTypeOf<ChatAppProps["onModeChange"]>().toEqualTypeOf<(mode: ChatAppMode) => void>();
expectTypeOf<Extract<ExportedTypeNames, "OverlayMode">>().toEqualTypeOf<never>();

describe("ChatAppMode", () => {
  test("is the runtime mode vocabulary", () => {
    const modes: ChatAppMode[] = ["floating", "compact", "expanded", "full"];

    expect(modes).toEqual(["floating", "compact", "expanded", "full"]);
  });
});
