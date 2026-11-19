"use client";

import { useRef, useState } from "react";
import { MediaImage } from "@/components/ui/media-image";
import { cn } from "@/lib/format";

const ZOOM = 2.2;

/**
 * The main product photo, magnified under the mouse. A sharper copy is fetched on the first hover only,
 * and touch or keyboard users simply see the photo.
 */
export function ZoomImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [active, setActive] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  // Updating a CSS variable instead of React state keeps mouse moves off the render path.
  const follow = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - box.top) / box.height) * 100));
    frameRef.current?.style.setProperty("--zoom-origin", `${x.toFixed(2)}% ${y.toFixed(2)}%`);
  };

  const enter = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    follow(event);
    setArmed(true);
    setActive(true);
  };

  const zoomed = active && loadedSrc === src;

  return (
    <div
      ref={frameRef}
      data-zoomed={zoomed || undefined}
      onPointerEnter={enter}
      onPointerMove={(event) => event.pointerType === "mouse" && follow(event)}
      onPointerLeave={() => setActive(false)}
      className={cn("relative overflow-hidden [@media(hover:hover)]:cursor-zoom-in", className)}
    >
      <MediaImage src={src} alt={alt} fill priority sizes="(min-width: 1024px) 444px, 100vw" className="object-cover" />
      {armed && (
        <div
          aria-hidden
          data-testid="zoom-layer"
          style={{ transform: `scale(${zoomed ? ZOOM : 1})` }}
          className={cn(
            "pointer-events-none absolute inset-0 origin-[var(--zoom-origin,50%_50%)] transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
            zoomed ? "opacity-100" : "opacity-0",
          )}
        >
          <MediaImage
            key={src}
            src={src}
            alt=""
            fill
            sizes={`(min-width: 1024px) ${Math.round(444 * ZOOM)}px, ${Math.round(100 * ZOOM)}vw`}
            className="object-cover"
            onLoad={() => setLoadedSrc(src)}
          />
        </div>
      )}
    </div>
  );
}
