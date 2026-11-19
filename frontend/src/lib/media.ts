import type { ImageLoaderProps } from "next/image";

const UPLOAD = "/image/upload/";

/** Images stored on Cloudinary are resized by its CDN instead of the Next.js image optimizer. */
export function isCloudinary(src: string): boolean {
  return src.startsWith("https://res.cloudinary.com/") && src.includes(UPLOAD);
}

/** Adds a width-limited resize in front of the API's own format and quality settings. */
export function cloudinaryLoader({ src, width }: ImageLoaderProps): string {
  return src.replace(UPLOAD, `${UPLOAD}c_limit,w_${width}/`);
}
