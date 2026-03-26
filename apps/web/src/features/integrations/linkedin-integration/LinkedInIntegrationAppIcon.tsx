"use client";

import { useState } from "react";
import Image from "next/image";
import linkedinIcon from "../assets/linkedin.svg";

function resolveAssetSrc(asset: unknown): string {
  if (typeof asset === "string") return asset;
  if (asset && typeof asset === "object" && "src" in (asset as Record<string, unknown>)) {
    const src = (asset as { src?: unknown }).src;
    if (typeof src === "string") return src;
  }
  return "/favicon.ico";
}

export function LinkedInIntegrationAppIcon() {
  const [src, setSrc] = useState(resolveAssetSrc(linkedinIcon));

  return (
    <div className="h-10 w-10 rounded-md border bg-muted/30 p-1 shrink-0">
      <Image
        src={src}
        alt="LinkedIn Integration icon"
        width={32}
        height={32}
        unoptimized
        className="h-full w-full object-contain"
        onError={() => setSrc("/favicon.ico")}
      />
    </div>
  );
}
