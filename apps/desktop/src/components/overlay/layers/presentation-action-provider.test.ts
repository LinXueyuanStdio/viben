import { describe, expect, it } from "vitest";
import { ALL_STEP_COMMANDS } from "@viben/presentation";
import { createPresentationActions } from "./presentation-action-provider";

describe("PresentationActionProvider", () => {
  it("registers every PresentationCommand as a presentation action", () => {
    const actions = createPresentationActions();

    for (const def of ALL_STEP_COMMANDS) {
      expect(actions[def.name]?.description).toBe(def.description);
      expect(actions[def.name]?.input_schema).toEqual({ type: "object", properties: {} });
      expect(actions[def.name]?.execute).toEqual(expect.any(Function));
    }

    expect(actions.stop?.execute).toEqual(expect.any(Function));
  });
});
