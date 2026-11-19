import { describe, expect, it } from "vitest";
import { cloudinaryLoader, isCloudinary } from "./media";

const SRC = "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v17/nocfinity/products/abc";

describe("isCloudinary", () => {
  it("recognises Cloudinary delivery URLs only", () => {
    expect(isCloudinary(SRC)).toBe(true);
    expect(isCloudinary("/storage/products/seed/tee.jpg")).toBe(false);
    expect(isCloudinary("https://evil.example/image/upload/x")).toBe(false);
    expect(isCloudinary("https://res.cloudinary.com/demo/video/upload/x")).toBe(false);
  });
});

describe("cloudinaryLoader", () => {
  it("asks the CDN for the requested width, never upscaling, and keeps format and quality automatic", () => {
    expect(cloudinaryLoader({ src: SRC, width: 640 })).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_limit,w_640/f_auto,q_auto/v17/nocfinity/products/abc",
    );
  });
});
