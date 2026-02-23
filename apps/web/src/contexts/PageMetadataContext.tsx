"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface PageMetadata {
  title: string;
  subtitle?: string;
}

interface PageMetadataContextValue {
  metadata: PageMetadata;
  setPageMetadata: (metadata: PageMetadata) => void;
}

const PageMetadataContext = createContext<PageMetadataContextValue | null>(null);

export function PageMetadataProvider({ children }: { children: ReactNode }) {
  const [metadata, setMetadata] = useState<PageMetadata>({ title: "" });

  const setPageMetadata = useCallback((newMetadata: PageMetadata) => {
    setMetadata(newMetadata);
  }, []);

  return (
    <PageMetadataContext.Provider value={{ metadata, setPageMetadata }}>
      {children}
    </PageMetadataContext.Provider>
  );
}

export function usePageMetadata() {
  const context = useContext(PageMetadataContext);
  if (!context) {
    throw new Error("usePageMetadata must be used within a PageMetadataProvider");
  }
  return context;
}
