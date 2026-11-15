import { afterEach, describe, expect, it, vi } from "vitest";
import { isMermaidApi, resolveMermaid, type MermaidApi } from "./mermaid-resolver.js";

const api = () => ({
  render: vi.fn<MermaidApi["render"]>(async () => ({ svg: "<svg/>" })),
  initialize: vi.fn<(config: Record<string, unknown>) => void>(),
});

afterEach(() => vi.unstubAllGlobals());

describe("resolveMermaid", () => {
  it("prefers the injected instance over window.mermaid and the bundled copy", async () => {
    const injected = api();
    const loadBundled = vi.fn();
    const r = await resolveMermaid({ injected, win: { mermaid: api() }, loadBundled });
    expect(r).toEqual({ mermaid: injected, source: "injected" });
    expect(loadBundled).not.toHaveBeenCalled();
  });

  it("accepts a module namespace, a promise and a thunk as the injected value", async () => {
    const instance = api();
    for (const injected of [{ default: instance }, Promise.resolve({ default: instance }), () => import_(instance)]) {
      const r = await resolveMermaid({ injected, loadBundled: vi.fn() });
      expect(r).toEqual({ mermaid: instance, source: "injected" });
    }
  });

  it("falls through when the injected value is not Mermaid", async () => {
    const global = api();
    const r = await resolveMermaid({ injected: { nothing: true }, win: { mermaid: global }, loadBundled: vi.fn() });
    expect(r.source).toBe("window");
  });

  it("uses a valid window.mermaid when nothing is injected", async () => {
    const global = api();
    const loadBundled = vi.fn();
    const r = await resolveMermaid({ win: { mermaid: global }, loadBundled });
    expect(r).toEqual({ mermaid: global, source: "window" });
    expect(loadBundled).not.toHaveBeenCalled();
  });

  it("rejects a DOM element sitting at window.mermaid and loads the bundled copy", async () => {
    class FakeElement {
      render = () => Promise.resolve({ svg: "" });
    }
    vi.stubGlobal("Element", FakeElement);
    const bundled = api();
    const r = await resolveMermaid({ win: { mermaid: new FakeElement() }, loadBundled: async () => bundled });
    expect(r).toEqual({ mermaid: bundled, source: "bundled" });
  });

  it("rejects a window.mermaid without render", async () => {
    const bundled = api();
    const r = await resolveMermaid({ win: { mermaid: { initialize() {} } }, loadBundled: async () => bundled });
    expect(r.source).toBe("bundled");
  });

  it("initializes only the bundled copy, and only once", async () => {
    const bundled = api();
    await resolveMermaid({ loadBundled: async () => bundled });
    await resolveMermaid({ loadBundled: async () => bundled });
    expect(bundled.initialize).toHaveBeenCalledTimes(1);
    expect(bundled.initialize).toHaveBeenCalledWith({ startOnLoad: false });
  });

  it("never calls initialize on an injected or window instance", async () => {
    const injected = api();
    const global = api();
    await resolveMermaid({ injected, loadBundled: vi.fn() });
    await resolveMermaid({ win: { mermaid: global }, loadBundled: vi.fn() });
    expect(injected.initialize).not.toHaveBeenCalled();
    expect(global.initialize).not.toHaveBeenCalled();
  });
});

describe("isMermaidApi", () => {
  it("requires a render function", () => {
    expect(isMermaidApi(api())).toBe(true);
    for (const v of [null, undefined, 1, "x", {}, { render: 1 }]) expect(isMermaidApi(v)).toBe(false);
  });
});

const import_ = (instance: unknown) => Promise.resolve({ default: instance });
