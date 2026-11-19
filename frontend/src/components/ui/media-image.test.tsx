// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MediaImage } from "./media-image";

describe("MediaImage", () => {
  it("serves Cloudinary images straight from its CDN, one size per screen width", () => {
    render(<MediaImage src="https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/p/abc" alt="Tee" width={300} height={300} />);
    const img = screen.getByRole("img", { name: "Tee" });

    expect(img.getAttribute("src")).toBe("https://res.cloudinary.com/demo/image/upload/c_limit,w_640/f_auto,q_auto/v1/p/abc");
    expect(img.getAttribute("srcset")).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_limit,w_384/f_auto,q_auto/v1/p/abc 1x, " +
        "https://res.cloudinary.com/demo/image/upload/c_limit,w_640/f_auto,q_auto/v1/p/abc 2x",
    );
  });

  it("sends local uploads through the same-origin path and the Next.js optimizer", () => {
    render(<MediaImage src="http://api.example/storage/products/a.jpg" alt="Local" width={300} height={300} />);

    expect(screen.getByRole("img", { name: "Local" }).getAttribute("src")).toMatch(/^\/_next\/image\?url=%2Fstorage%2Fproducts%2Fa\.jpg/);
  });
});
