// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pagination, pageWindow } from "./pagination";

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses the middle around the current page", () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, "…", 9, 10]);
    expect(pageWindow(5, 10)).toEqual([1, 2, "…", 4, 5, 6, "…", 9, 10]);
    expect(pageWindow(10, 10)).toEqual([1, 2, "…", 9, 10]);
    expect(pageWindow(3, 10)).toEqual([1, 2, 3, 4, "…", 9, 10]);
  });
});

describe("Pagination", () => {
  const href = (page: number) => `/shop?page=${page}`;

  it("renders nothing for a single page", () => {
    const { container } = render(<Pagination current={1} last={1} href={href} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links neighbouring pages and disables Previous on the first page", () => {
    render(<Pagination current={1} last={3} href={href} />);

    expect(screen.queryByRole("link", { name: /Previous/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Next/ })).toHaveAttribute("href", "/shop?page=2");
    expect(screen.getByRole("link", { name: "3" })).toHaveAttribute("href", "/shop?page=3");
  });
});
