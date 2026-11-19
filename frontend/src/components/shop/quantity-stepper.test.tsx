// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuantityStepper } from "./quantity-stepper";

describe("QuantityStepper", () => {
  it("steps the value up and down", async () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={3} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    await userEvent.click(screen.getByRole("button", { name: "Decrease quantity" }));

    expect(onChange.mock.calls).toEqual([[4], [2]]);
  });

  it("cannot go below the minimum or above the maximum", () => {
    const { rerender } = render(<QuantityStepper value={1} onChange={() => {}} max={5} />);
    expect(screen.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();

    rerender(<QuantityStepper value={5} onChange={() => {}} max={5} />);
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decrease quantity" })).toBeEnabled();
  });

  it("locks both buttons while disabled", () => {
    render(<QuantityStepper value={2} onChange={() => {}} disabled />);
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
  });
});
