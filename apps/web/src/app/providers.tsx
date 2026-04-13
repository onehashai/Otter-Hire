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
import { getAuthSession, refreshSessionDetailed, type AuthSessionResponse } from "@/api/index";
import { buildLoginHref } from "@/lib/login-redirect";

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
const EXPLICIT_LOGOUT_KEY = "explicit_logout";

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
  const authFailureRef = useRef<"none" | "anonymous" | "invalidated">("none");
  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const isLifecycleRoute = LIFECYCLE_ROUTES.includes(pathname);
  const onInvitePage = isInvitePath(pathname);

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
          let me = await getAuthSession();
          let sessionInvalidated = false;

          if (!me) {
            const refreshResult = await refreshSessionDetailed();
            if (refreshResult.ok === true) {
              me = refreshResult.user;
            } else {
              sessionInvalidated = refreshResult.sessionInvalidated;
            }
          }

          if (!me) {
            setUser(null);
            clearSession();
            authFailureRef.current = sessionInvalidated ? "invalidated" : "anonymous";
            if (
              !AUTH_ROUTES.includes(pathname) &&
              !LIFECYCLE_ROUTES.includes(pathname) &&
              !isInvitePath(pathname)
            ) {
              router.replace(buildLoginHref(pathname, window.location.search, sessionInvalidated));
            }
            return null;
          }

          authFailureRef.current = "none";
          setUser(me);
          return me;
        } catch (error) {
          setUser(null);
          clearSession();
          authFailureRef.current = "anonymous";
          if (
            !AUTH_ROUTES.includes(pathname) &&
            !LIFECYCLE_ROUTES.includes(pathname) &&
            !isInvitePath(pathname)
          ) {
            router.replace(buildLoginHref(pathname, window.location.search, false));
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

    const onInviteSignup = pathname === "/signup" && Boolean(searchParams.get("invite"));
    const isInviteLifecycleUser = user?.status === "pending" || user?.status === "declined";
    const explicitLogout = sessionStorage.getItem(EXPLICIT_LOGOUT_KEY) === "true";

    // Once user reaches an auth page, clear the explicit logout marker.
    if (explicitLogout && isAuthRoute) {
      sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY);
    }

    if (!user) {
      // Only redirect if loading is complete — refreshSession already attempted
      // getAuthSession + refreshSessionDetailed before setting user=null.
      if (!isAuthRoute && !isLifecycleRoute && !onInvitePage) {
        if (explicitLogout) {
          router.replace("/login");
          return;
        }
        const currentSearch = searchParams.toString();
        const pathSearch = currentSearch ? `?${currentSearch}` : "";
        const sessionExpired = authFailureRef.current === "invalidated";
        authFailureRef.current = "none";
        router.replace(buildLoginHref(pathname, pathSearch, sessionExpired));
      } else {
        authFailureRef.current = "none";
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
