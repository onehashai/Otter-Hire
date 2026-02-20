"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster, SonnerToaster, TooltipProvider } from "@onehash/ui";
import { getAuthSession, type AuthSessionResponse } from "@/api/index";

import "@/i18n";

const queryClient = new QueryClient();

type AuthSessionContextValue = {
  user: AuthSessionResponse | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
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

function isInvitePath(pathname: string): boolean {
  return pathname.startsWith("/invite/");
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshSession = async () => {
    try {
      const me = await getAuthSession();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshSession();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "session_updated" && e.newValue) {
        void refreshSession();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    if (loading) return;

    const isAuthRoute = AUTH_ROUTES.includes(pathname);
    const isLifecycleRoute = LIFECYCLE_ROUTES.includes(pathname);
    const onInvitePage = isInvitePath(pathname);

    if (!user) {
      if (!isAuthRoute && !isLifecycleRoute && !onInvitePage) {
        router.replace("/login");
      }
      return;
    }

    if (!user.is_verified) {
      if (pathname !== "/verify" && !onInvitePage) {
        router.replace("/verify");
      }
      return;
    }

    if (!user.is_onboarded) {
      if (pathname !== "/onboarding" && !onInvitePage) {
        router.replace("/onboarding");
      }
      return;
    }

    if (isAuthRoute || isLifecycleRoute) {
      router.replace("/");
    }
  }, [user, loading, pathname, router]);

  const authValue = useMemo(
    () => ({ user, loading, refreshSession }),
    [user, loading]
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
