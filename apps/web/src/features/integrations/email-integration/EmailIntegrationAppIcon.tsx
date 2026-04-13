"use client";

import { useState } from "react";
import Image from "next/image";
import emailIcon from "../assets/email.svg";

function resolveAssetSrc(asset: unknown): string {
  if (typeof asset === "string") return asset;
  if (asset && typeof asset === "object" && "src" in (asset as Record<string, unknown>)) {
    const src = (asset as { src?: unknown }).src;
    if (typeof src === "string") return src;
  }
  return "/favicon.ico";
}

export function EmailIntegrationAppIcon() {
  const [src, setSrc] = useState(resolveAssetSrc(emailIcon));

  return (
    <div className="h-10 w-10 rounded-md border bg-muted/30 p-1 shrink-0">
      <Image
        src={src}
        alt="Email Integration icon"
        width={32}
        height={32}
        unoptimized
        className="h-full w-full object-contain dark:invert"
        onError={() => setSrc("/favicon.ico")}
      />
    </div>
  );
}
