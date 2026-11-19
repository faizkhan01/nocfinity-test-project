// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZoomImage } from "./zoom-image";

const SRC = "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/p/tee";

function renderZoom() {
  const { container } = render(<ZoomImage src={SRC} alt="Tee" />);
  return container.firstElementChild as HTMLElement;
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 100, top: 50, width: 400, height: 500 } as DOMRect);
});

describe("ZoomImage", () => {
  it("magnifies the spot under the mouse once the sharper copy has loaded", async () => {
    const frame = renderZoom();

    fireEvent.pointerEnter(frame, { pointerType: "mouse", clientX: 200, clientY: 300 });
    const layer = screen.getByTestId("zoom-layer");
    expect(frame.style.getPropertyValue("--zoom-origin")).toBe("25.00% 50.00%");
    expect(layer).toHaveClass("opacity-0");

    fireEvent.load(layer.querySelector("img")!);
    await waitFor(() => expect(layer).toHaveClass("opacity-100"));
    expect(layer.style.transform).toBe("scale(2.2)");
    expect(frame).toHaveAttribute("data-zoomed");

    fireEvent.pointerMove(frame, { pointerType: "mouse", clientX: 500, clientY: 50 });
    expect(frame.style.getPropertyValue("--zoom-origin")).toBe("100.00% 0.00%");
  });

  it("asks the CDN for a larger image than the one on the page", () => {
    const frame = renderZoom();
    fireEvent.pointerEnter(frame, { pointerType: "mouse", clientX: 200, clientY: 300 });

    const sharp = screen.getByTestId("zoom-layer").querySelector("img")!;
    expect(sharp.getAttribute("sizes")).toBe("(min-width: 1024px) 977px, 220vw");
    expect(sharp.getAttribute("srcset")).toContain("c_limit,w_3840/");
  });

  it("zooms back out when the mouse leaves, keeping the loaded copy for next time", async () => {
    const frame = renderZoom();
    fireEvent.pointerEnter(frame, { pointerType: "mouse", clientX: 200, clientY: 300 });
    fireEvent.load(screen.getByTestId("zoom-layer").querySelector("img")!);
    await waitFor(() => expect(frame).toHaveAttribute("data-zoomed"));

    fireEvent.pointerLeave(frame, { pointerType: "mouse" });

    const layer = screen.getByTestId("zoom-layer");
    expect(layer.style.transform).toBe("scale(1)");
    expect(layer).toHaveClass("opacity-0");
    expect(frame).not.toHaveAttribute("data-zoomed");
  });

  it("leaves touch users with the plain photo", () => {
    const frame = renderZoom();

    fireEvent.pointerEnter(frame, { pointerType: "touch", clientX: 200, clientY: 300 });

    expect(screen.queryByTestId("zoom-layer")).not.toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Tee" })).toHaveLength(1);
  });
});
