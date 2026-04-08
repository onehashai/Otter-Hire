"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/common/ThemeProvider";
import { Toaster } from "@onehash/ui/toaster";
import { SonnerToaster } from "@onehash/ui/sonner";
import { TooltipProvider } from "@onehash/ui/tooltip";
import {
  getAuthSession,
  refreshSession as refreshAuthSession,
  type AuthSessionResponse,
} from "@/api/index";

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

function isInvitePath(pathname: string): boolean {
  return pathname.startsWith("/invite/");
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionVersion, setSessionVersion] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inflightRef = useRef<Promise<AuthSessionResponse | null> | null>(null);

  const clearSession = useCallback(() => {
    inflightRef.current = null;
    setUser(null);
    localStorage.removeItem("session_updated");
  }, []);

  const refreshSession = useCallback(
    async (force?: boolean): Promise<AuthSessionResponse | null> => {
      if (!force && inflightRef.current) return inflightRef.current;
      if (force) inflightRef.current = null;
      const promise = (async () => {
        try {
          // Try to refresh token first if session seems expired
          let me = await getAuthSession();

          // If 401, try refresh token
          if (!me) {
            me = await refreshAuthSession();
          }

          setUser(me);
          return me;
        } catch (error) {
          // Clear session on any auth error
          setUser(null);
          clearSession();

          // If on protected route, redirect to login
          if (!AUTH_ROUTES.includes(pathname) && !LIFECYCLE_ROUTES.includes(pathname)) {
            const isInvite = isInvitePath(pathname);
            if (!isInvite) {
              const returnUrl = encodeURIComponent(`${pathname}${window.location.search}`);
              router.replace(`/login?redirect=${returnUrl}&session_expired=true`);
            }
          }

          return null;
        } finally {
          setLoading(false);
          setSessionVersion((v) => v + 1);
          inflightRef.current = null;
        }
      })();
      inflightRef.current = promise;
      return promise;
    },
    [pathname, router, clearSession],
  );

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
    const onInvitePage = isInvitePath(pathname);
    const onInviteSignup = pathname === "/signup" && Boolean(searchParams.get("invite"));
    const isInviteLifecycleUser = user?.status === "pending" || user?.status === "declined";

    if (!user) {
      if (!isAuthRoute && !isLifecycleRoute && !onInvitePage) {
        const currentSearch = searchParams.toString();
        const returnUrl = encodeURIComponent(
          `${pathname}${currentSearch ? `?${currentSearch}` : ""}`,
        );
        router.replace(`/login?redirect=${returnUrl}&session_expired=true`);
      }
      return;
    }

    if (!user.is_verified) {
      // Invitation lifecycle users should never be forced through /verify.
      if (!isInviteLifecycleUser && pathname !== "/verify" && !onInvitePage && !onInviteSignup) {
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
      // TODO(mvp-nav): Restore dashboard landing route after MVP launch.
      // router.replace("/dashboard");
      router.replace("/");
    }
  }, [user, loading, pathname, router, searchParams, sessionVersion]);

  const authValue = useMemo(
    () => ({ user, loading, refreshSession, clearSession }),
    [user, loading, refreshSession, clearSession],
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
