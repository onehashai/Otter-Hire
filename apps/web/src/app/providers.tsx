"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster, SonnerToaster, TooltipProvider } from "@onehash/ui";
import { getAuthSession, type AuthSessionResponse } from "@/lib/api";

import "@/i18n";

const queryClient = new QueryClient();

type AuthSessionContextValue = {
  user: AuthSessionResponse | null;
  loading: boolean;
  refreshSession: (force?: boolean) => Promise<AuthSessionResponse | null>;
  clearSession: () => void;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function useAuthSession(): AuthSessionContextValue {
  const value = useContext(AuthSessionContext);
  if (!value) {
    throw new Error("useAuthSession must be used within Providers");
  }
  return value;
}

const AUTH_ROUTES = ["/login", "/signup"];
const LIFECYCLE_ROUTES = ["/verify", "/onboarding"];

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionVersion, setSessionVersion] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const inflightRef = useRef<Promise<AuthSessionResponse | null> | null>(null);

  const refreshSession = useCallback(async (force?: boolean): Promise<AuthSessionResponse | null> => {
    if (!force && inflightRef.current) return inflightRef.current;
    if (force) inflightRef.current = null;
    const promise = (async () => {
      try {
        const me = await getAuthSession();
        setUser(me);
        return me;
      } catch {
        setUser(null);
        return null;
      } finally {
        setLoading(false);
        setSessionVersion((v) => v + 1);
        inflightRef.current = null;
      }
    })();
    inflightRef.current = promise;
    return promise;
  }, []);

  const clearSession = useCallback(() => {
    inflightRef.current = null;
    setUser(null);
    localStorage.removeItem("session_updated");
  }, []);

  useEffect(() => {
    void refreshSession();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "session_updated" && e.newValue) {
        void refreshSession();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [refreshSession]);

  useEffect(() => {
    if (loading) return;

    const isAuthRoute = AUTH_ROUTES.includes(pathname);
    const isLifecycleRoute = LIFECYCLE_ROUTES.includes(pathname);

    if (!user) {
      if (!isAuthRoute && !isLifecycleRoute) {
        router.replace("/login");
      }
      return;
    }

    if (!user.is_verified) {
      if (pathname !== "/verify") {
        router.replace("/verify");
      }
      return;
    }

    if (!user.is_onboarded) {
      if (pathname !== "/onboarding") {
        router.replace("/onboarding");
      }
      return;
    }

    if (isAuthRoute || isLifecycleRoute) {
      router.replace("/");
    }
  }, [user, loading, pathname, router, sessionVersion]);

  const authValue = useMemo(
    () => ({ user, loading, refreshSession, clearSession }),
    [user, loading, refreshSession, clearSession]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionContext.Provider value={authValue}>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            {children}
            <Toaster />
            <SonnerToaster />
          </TooltipProvider>
        </ThemeProvider>
      </AuthSessionContext.Provider>
    </QueryClientProvider>
  );
}
