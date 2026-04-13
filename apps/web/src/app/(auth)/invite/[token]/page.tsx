"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@onehash/ui/button";
import { Icon } from "@onehash/ui/icon";
import {
  acceptInvite,
  getInviteDetails,
  declineInvite,
  type InviteDetailsResponse,
} from "@/api/index";
import { LOGO_SVG_PATH, PLATFORM_NAME } from "@/lib/constants";
import { useAuthSession } from "@/app/providers";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === "string" ? params.token : "";
  const { user, loading: sessionLoading, refreshSession } = useAuthSession();
  const [details, setDetails] = useState<InviteDetailsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [name, setName] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid invite link.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    getInviteDetails(token)
      .then((data) => {
        if (!cancelled) {
          setDetails(data);
          setName(data.suggested_name ?? "");
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Invalid or expired invite.");
          setDetails(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (sessionLoading || loading || !details || !token) return;

    const inviteEmail = details.email.toLowerCase();
    const currentEmail = user?.email?.toLowerCase();
    const isMatchingLoggedInUser = Boolean(currentEmail && currentEmail === inviteEmail);

    // Final flow:
    // 1) New invited user opens email link -> go directly to signup first.
    // 2) Existing invited user opens email link while logged out -> go to login first.
    // 3) Show accept page only when user is logged in with invited email.
    if (!isMatchingLoggedInUser) {
      setRedirecting(true);
      if (details.account_exists) {
        const inviteRedirect = `/invite/${encodeURIComponent(token)}`;
        router.replace(
          `/login?redirect=${encodeURIComponent(inviteRedirect)}&invite_email=${encodeURIComponent(details.email)}`,
        );
      } else {
        router.replace(
          `/signup?invite=${encodeURIComponent(token)}&invite_email=${encodeURIComponent(details.email)}`,
        );
      }
    }
  }, [details, loading, router, sessionLoading, token, user]);

  const handleAccept = async () => {
    if (!token || !details) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setAccepting(true);
    const isMatchingLoggedInUser = Boolean(
      user && user.email.toLowerCase() === details.email.toLowerCase(),
    );
    if (isMatchingLoggedInUser) {
      try {
        await acceptInvite({ token, name: trimmedName });
        await refreshSession(true);
        localStorage.setItem("session_updated", Date.now().toString());
        router.replace("/");
        router.refresh();
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to accept invite.");
        setAccepting(false);
        return;
      }
    }
    const inviteRedirect = `/invite/${encodeURIComponent(token)}`;
    const inviteEmail = encodeURIComponent(details.email);
    if (details.account_exists) {
      router.push(
        `/login?redirect=${encodeURIComponent(inviteRedirect)}&invite_email=${inviteEmail}`,
      );
    } else {
      router.push(`/signup?invite=${encodeURIComponent(token)}&invite_email=${inviteEmail}`);
    }
    setAccepting(false);
  };

  const handleDecline = async () => {
    if (!token) return;
    setDeclining(true);
    setError(null);
    try {
      await declineInvite(token);
      const refreshedUser = await refreshSession(true);
      const isMatchingLoggedInUser = Boolean(
        refreshedUser &&
        details &&
        refreshedUser.email.toLowerCase() === details.email.toLowerCase(),
      );
      if (isMatchingLoggedInUser && refreshedUser && !refreshedUser.is_onboarded) {
        router.replace("/onboarding?invite_declined=1");
      } else if (isMatchingLoggedInUser) {
        router.replace("/");
      } else {
        router.replace("/login");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decline invite.");
    } finally {
      setDeclining(false);
    }
  };

  if (sessionLoading || loading || redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-[420px] text-center">
          <Icon name="Loader" className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-4">
            {redirecting ? "Redirecting..." : "Loading invite..."}
          </p>
        </div>
      </div>
    );
  }

  if (error && !details) {
    return (
      <div className="min-h-screen flex bg-background">
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-[420px]">
            <div className="lg:hidden flex items-center mb-10 justify-center">
              <Image
                src={LOGO_SVG_PATH}
                alt={PLATFORM_NAME}
                width={140}
                height={42}
                className="object-contain"
                priority
              />
            </div>
            <div className="rounded-xl border border-border bg-card p-8 shadow-sm text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-5">
                <Icon name="CircleAlert" className="h-5 w-5 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight mb-2">
                Invalid or expired invite
              </h2>
              <p className="text-sm text-muted-foreground mb-6">{error}</p>
              <Link href="/login">
                <Button variant="outline" className="w-full h-10 text-sm">
                  Go to sign in
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden bg-muted/30">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative z-10 w-full max-w-md px-12 text-left">
          <div className="flex flex-col items-start gap-3">
            <Image
              src={LOGO_SVG_PATH}
              alt={PLATFORM_NAME}
              width={480}
              height={262}
              className="-ml-2 h-24 w-auto max-w-[min(100%,400px)] object-contain object-left self-start"
              priority
            />
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
              Join the team
              <br />
              and start recruiting.
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Accept your invitation to access the AI-powered ATS built for modern hiring teams.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center mb-10 justify-center">
            <Image
              src={LOGO_SVG_PATH}
              alt={PLATFORM_NAME}
              width={140}
              height={42}
              className="object-contain"
              priority
            />
          </div>

          <div className="lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-8 lg:shadow-sm">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <Icon name="UserPlus" className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-center mb-2">
              Join {details?.org_name ?? "the team"}
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              You&apos;ve been invited to join as{" "}
              <span className="font-medium text-foreground">{details?.role ?? "a member"}</span>.
            </p>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive mb-4">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="text-sm font-medium block">Organization</label>
                <input
                  value={details?.org_name ?? ""}
                  disabled
                  className="h-10 w-full rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium block">Full name</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Jane Doe"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  autoComplete="name"
                />
              </div>
            </div>
            <div className="space-y-3 mt-6">
              <Button
                className="w-full h-10 text-sm font-medium"
                disabled={accepting || !name.trim()}
                onClick={handleAccept}
              >
                {accepting ? (
                  <Icon name="Loader" className="h-4 w-4 animate-spin" />
                ) : (
                  "Accept invite"
                )}
              </Button>
              <Button variant="outline" className="w-full h-10 text-sm" onClick={handleDecline}>
                {declining ? <Icon name="Loader" className="h-4 w-4 animate-spin" /> : "Decline"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
