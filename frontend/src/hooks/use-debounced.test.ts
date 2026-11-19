// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounced } from "./use-debounced";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDebounced", () => {
  it("updates only after the value has stopped changing for the delay", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounced(value, 250), { initialProps: { value: "s" } });

    rerender({ value: "sh" });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: "shi" });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("s");

    act(() => vi.advanceTimersByTime(50));
    expect(result.current).toBe("shi");
  });
});
