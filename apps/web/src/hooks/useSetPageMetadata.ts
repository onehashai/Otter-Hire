"use client";

import { useEffect } from "react";
import { usePageMetadata } from "@/contexts/PageMetadataContext";
interface PageMetadataOptions {
  title: string;
  subtitle?: string;
}

export function useSetPageMetadata({ title, subtitle }: PageMetadataOptions) {
  const { setPageMetadata } = usePageMetadata();

  useEffect(() => {
    setPageMetadata({ title, subtitle });
  }, [title, subtitle, setPageMetadata]);
}
