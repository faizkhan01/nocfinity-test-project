"use client";

import Image, { type ImageProps } from "next/image";
import { assetUrl } from "@/lib/format";
import { cloudinaryLoader, isCloudinary } from "@/lib/media";

type Props = Omit<ImageProps, "src" | "loader"> & { src: string };

/** An image whose URL comes from the API, wherever it is stored; a client module so server pages can use it too. */
export function MediaImage({ src, alt, ...props }: Props) {
  const url = assetUrl(src) ?? src;

  return <Image {...props} alt={alt} src={url} loader={isCloudinary(url) ? cloudinaryLoader : undefined} />;
}
