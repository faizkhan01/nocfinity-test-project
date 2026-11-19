// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Price } from "./price";

describe("Price", () => {
  it("shows the old price and the discount when on sale", () => {
    render(<Price final={21000} original={30000} percent={30} />);

    expect(screen.getByText("$210")).toBeInTheDocument();
    expect(screen.getByText("$300")).toHaveClass("line-through");
    expect(screen.getByText("-30%")).toBeInTheDocument();
  });

  it("shows only the price when the old one is not higher", () => {
    render(<Price final={12000} original={12000} percent={0} />);

    expect(screen.getByText("$120")).toBeInTheDocument();
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/\$/)).toHaveLength(1);
  });
});
