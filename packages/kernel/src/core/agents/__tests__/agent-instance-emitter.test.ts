import { describe, it, expect } from "vitest";
import { AgentInstance } from "../agent-instance.js";
import { TypedEmitter } from "../../utils/typed-emitter.js";

describe("AgentInstance extends TypedEmitter", () => {
  it("has on/off/emit from TypedEmitter prototype", () => {
    expect(AgentInstance.prototype).toBeInstanceOf(TypedEmitter);
    expect(typeof AgentInstance.prototype.on).toBe("function");
    expect(typeof AgentInstance.prototype.off).toBe("function");
    expect(typeof AgentInstance.prototype.emit).toBe("function");
  });
});
