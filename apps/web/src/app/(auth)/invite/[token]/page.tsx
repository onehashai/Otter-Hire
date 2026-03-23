"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@onehash/ui/button";
import { Icon } from "@onehash/ui/icon";
import {
  acceptExistingInvite,
  getInviteDetails,
  declineInvite,
  type InviteDetailsResponse,
} from "@/api/index";
import { PRODUCT_LOGO_LETTER, PRODUCT_NAME } from "@/lib/constants";
import { useAuthSession } from "@/app/providers";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === "string" ? params.token : "";
  const { user, loading: sessionLoading, refreshSession } = useAuthSession();
  const [details, setDetails] = useState<InviteDetailsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [routingAccept, setRoutingAccept] = useState(false);
  const [declining, setDeclining] = useState(false);

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

  const handleAccept = async () => {
    if (!token || !details) return;
    setRoutingAccept(true);
    if (user && user.email.toLowerCase() === details.email.toLowerCase()) {
      try {
        await acceptExistingInvite(token);
        await refreshSession(true);
        localStorage.setItem("session_updated", Date.now().toString());
        // TODO(mvp-nav): Restore dashboard redirect after MVP launch.
        // router.replace("/dashboard");
        router.replace("/");
        router.refresh();
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to accept invite.");
        setRoutingAccept(false);
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
  };

  const handleDecline = async () => {
    if (!token) return;
    setDeclining(true);
    setError(null);
    try {
      await declineInvite(token);
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decline invite.");
    } finally {
      setDeclining(false);
    }
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-[420px] text-center">
          <Icon name="Loader" className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-4">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (error && !details) {
    return (
      <div className="min-h-screen flex bg-background">
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-[420px]">
            <div className="lg:hidden flex items-center gap-2.5 mb-10 justify-center">
              <div className="h-9 w-9 rounded-lg bg-foreground flex items-center justify-center">
                <span className="text-background text-sm font-bold">{PRODUCT_LOGO_LETTER}</span>
              </div>
              <span className="text-lg font-semibold tracking-tight">{PRODUCT_NAME}</span>
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
        <div className="relative z-10 max-w-md px-12">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="h-9 w-9 rounded-lg bg-foreground flex items-center justify-center">
              <span className="text-background text-sm font-bold">{PRODUCT_LOGO_LETTER}</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">{PRODUCT_NAME}</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight leading-tight mb-3">
            You&apos;re invited
            <br />
            to join the team.
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Create an account or sign in to accept this invitation. You won&apos;t need to create an
            organization—you&apos;ll join the existing one.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-10 justify-center">
            <div className="h-9 w-9 rounded-lg bg-foreground flex items-center justify-center">
              <span className="text-background text-sm font-bold">{PRODUCT_LOGO_LETTER}</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">{PRODUCT_NAME}</span>
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
            <div className="space-y-3">
              <Button
                className="w-full h-10 text-sm font-medium"
                disabled={routingAccept || declining}
                onClick={handleAccept}
              >
                {routingAccept ? (
                  <Icon name="Loader" className="h-4 w-4 animate-spin" />
                ) : (
                  "Accept invite"
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full h-10 text-sm"
                disabled={routingAccept || declining}
                onClick={handleDecline}
              >
                {declining ? <Icon name="Loader" className="h-4 w-4 animate-spin" /> : "Decline"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
