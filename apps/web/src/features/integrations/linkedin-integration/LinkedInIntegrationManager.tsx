"use client";

import { useEffect, useRef, useState } from "react";
import { Switch } from "@onehash/ui/switch";
import { InputField } from "@onehash/ui/input";
import { Button } from "@onehash/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onehash/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@onehash/ui/tooltip";
import { Loader2, Settings, Trash2 } from "lucide-react";
import { toast } from "@onehash/ui/sonner";
import {
  connectLinkedIn,
  disconnectLinkedIn,
  getLinkedInStatus,
  getLinkedInOrganizations,
  completeLinkedInSetup,
  subscribeLinkedInLeads,
  unsubscribeLinkedInLeads,
  type LinkedInStatus,
  type LinkedInOrganization,
} from "@/api/linkedin";

type LinkedInIntegrationManagerProps = {
  onChanged?: () => Promise<void> | void;
};

export function LinkedInIntegrationManager({ onChanged }: LinkedInIntegrationManagerProps) {
  const [status, setStatus] = useState<LinkedInStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [organizations, setOrganizations] = useState<LinkedInOrganization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [completingSetup, setCompletingSetup] = useState(false);
  const [includeLeads, setIncludeLeads] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const oauthCleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => oauthCleanup.current?.(), []);

  const fetchStatus = async () => {
    try {
      const data = await getLinkedInStatus();
      setStatus(data);
    } catch (error) {
      console.error("Failed to fetch LinkedIn status:", error);
      setStatus({
        connected: false,
        status: "not_connected",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchOrganizations = async (preferredOrgId?: string) => {
    setLoadingOrgs(true);
    try {
      const data = await getLinkedInOrganizations();
      setOrganizations(data.organizations || []);

      if (preferredOrgId && data.organizations.some((org) => org.id === preferredOrgId)) {
        setSelectedOrgId(preferredOrgId);
      } else if (data.organizations.length === 1) {
        setSelectedOrgId(data.organizations[0].id);
      } else {
        setSelectedOrgId("");
      }
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
      toast.error(error instanceof Error ? error.message : "Could not load Company Pages");
      setOrganizations([]);
      setSelectedOrgId("");
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleCancelSetup = () => {
    setSetupDialogOpen(false);
    setConnecting(false);
  };

  const openLogoutPopup = () => {
    const width = 600;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    // Open synchronously from user gesture to avoid popup blocking.
    return window.open(
      "",
      "LinkedIn Logout",
      `width=${width},height=${height},left=${left},top=${top}`,
    );
  };

  const finalizeLinkedInLogout = (logoutPopup: Window | null) => {
    if (!logoutPopup) {
      toast.warning("Popup was blocked. Please log out of LinkedIn manually before reconnecting.");
      return;
    }

    logoutPopup.location.href = "https://www.linkedin.com/m/logout";
    setTimeout(() => {
      logoutPopup.close();
    }, 1500);
  };

  const disconnectThenLogout = async (logoutPopup: Window | null) => {
    try {
      await disconnectLinkedIn();
      await fetchStatus();
      await onChanged?.();
      finalizeLinkedInLogout(logoutPopup);
    } catch (error) {
      console.error("Failed to disconnect:", error);
      if (logoutPopup && !logoutPopup.closed) {
        logoutPopup.close();
      }
      toast.error("Failed to disconnect LinkedIn");
      throw error;
    }
  };

  const handleSwitchAccountFromSetup = async () => {
    const logoutPopup = openLogoutPopup();
    try {
      await disconnectThenLogout(logoutPopup);
      setSetupDialogOpen(false);
      toast.success("Switched account. Reconnect with your preferred LinkedIn account.");
    } catch {
      // Error already handled in disconnectThenLogout
    }
  };

  const handleOpenSetup = async () => {
    setSetupDialogOpen(true);
    await fetchOrganizations(status?.organization?.id);
  };

  const handleConnect = async () => {
    const popup = window.open("about:blank", "LinkedIn OAuth", "width=600,height=700");
    if (!popup) {
      toast.error("Allow popups for this site, then connect again.");
      return;
    }
    setConnecting(true);
    try {
      const { authorization_url, callback_origin } = await connectLinkedIn(includeLeads);

      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== callback_origin || event.source !== popup) return;
        if (event.data?.type === "linkedin_error") {
          oauthCleanup.current?.();
          setConnecting(false);
          toast.error(event.data.error || "LinkedIn authorization failed");
          return;
        }
        if (event.data?.type === "linkedin_oauth_complete") {
          oauthCleanup.current?.();
          await fetchStatus();
          setSetupDialogOpen(true);
          await fetchOrganizations();
          setConnecting(false);
          window.removeEventListener("message", handleMessage);
        }
      };

      window.addEventListener("message", handleMessage);

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          oauthCleanup.current?.();
          setConnecting(false);
          void fetchStatus();
        }
      }, 500);
      oauthCleanup.current = () => {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        popup.close();
        oauthCleanup.current = null;
      };
      popup.location.href = authorization_url;
    } catch (error) {
      popup.close();
      const message = error instanceof Error ? error.message : "Failed to connect LinkedIn";
      toast.error(message);
      setConnecting(false);
    }
  };

  const handleCompleteSetup = async () => {
    if (!selectedOrgId) {
      toast.error("Please select a company page");
      return;
    }

    const selectedOrg = organizations.find((org) => org.id === selectedOrgId);
    if (!selectedOrg) {
      toast.error("Selected organization not found");
      return;
    }

    setCompletingSetup(true);
    try {
      await completeLinkedInSetup({
        organization_id: selectedOrg.id,
        organization_name: selectedOrg.name,
        organization_vanity_name: selectedOrg.vanity_name,
        organization_logo_url: selectedOrg.logo_url,
      });

      toast.success("LinkedIn connected successfully!");
      setSetupDialogOpen(false);
      await fetchStatus();
      await onChanged?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to complete setup";
      toast.error(message);
    } finally {
      setCompletingSetup(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    const logoutPopup = openLogoutPopup();
    try {
      await disconnectThenLogout(logoutPopup);
      toast.success("LinkedIn disconnected successfully");
      setDisconnectDialogOpen(false);
    } catch {
      // Error toast already handled in disconnectThenLogout
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading || !status) {
    return (
      <Button size="sm" disabled className="text-xs h-8 w-full">
        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  const isSetupComplete = status.connected && status.setup_complete;
  const isSetupIncomplete = status.connected && !status.setup_complete;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs break-words">
            {status.status === "expired"
              ? "Authorization Expired"
              : isSetupComplete
                ? "Connected"
                : isSetupIncomplete
                  ? "Setup Required (Select Company Page)"
                  : "Not Connected"}
          </span>
          <Switch
            aria-label="LinkedIn connection"
            checked={status.connected}
            disabled={connecting || disconnecting || status.oauth_configured === false}
            onCheckedChange={(checked) => {
              if (checked) void handleConnect();
              else setDisconnectDialogOpen(true);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {isSetupComplete ? (
            <div className="flex items-center justify-between gap-2 w-full">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={handleOpenSetup}
                    disabled={loadingOrgs || completingSetup}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Manage</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDisconnectDialogOpen(true)}
                    disabled={disconnecting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Disconnect</TooltipContent>
              </Tooltip>
            </div>
          ) : isSetupIncomplete ? (
            <>
              <div className="flex items-center gap-2 text-xs text-amber-600 font-medium">
                Company Page required
              </div>
              <Button size="sm" variant="outline" onClick={handleOpenSetup} className="text-xs h-8">
                Complete Setup
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={connecting || status.oauth_configured === false}
              className="text-xs h-8 w-full"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          )}
        </div>
        {isSetupComplete && !status.can_post && (
          <Button size="sm" variant="outline" onClick={handleConnect} disabled={connecting}>
            Reauthorize posting
          </Button>
        )}
        {status.lead_sync_enabled && (
          <div className="space-y-2 border-t pt-3">
            <label className="flex items-center justify-between gap-3 text-xs">
              Include Lead Sync permission
              <Switch
                checked={includeLeads}
                onCheckedChange={setIncludeLeads}
                aria-label="Include Lead Sync permission"
              />
            </label>
            {status.connected && !status.can_sync_leads && includeLeads && (
              <Button size="sm" variant="outline" onClick={handleConnect} disabled={connecting}>
                Authorize Lead Sync
              </Button>
            )}
            {status.can_sync_leads && (
              <>
                <p className="text-xs">
                  Lead Sync:{" "}
                  {status.lead_subscription?.status === "active" ? "Connected" : "Not Connected"}
                </p>
                {status.lead_sync_last_error && (
                  <p role="alert" className="text-xs text-destructive break-words">
                    {status.lead_sync_last_error}
                  </p>
                )}
                {status.lead_subscription && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={subscribing}
                    onClick={async () => {
                      setSubscribing(true);
                      try {
                        await unsubscribeLinkedInLeads();
                        await fetchStatus();
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Could not disconnect Lead Sync",
                        );
                      } finally {
                        setSubscribing(false);
                      }
                    }}
                  >
                    Disconnect Lead Forms
                  </Button>
                )}
                {!status.lead_subscription && (
                  <>
                    <InputField
                      aria-label="LinkedIn ad account ID"
                      placeholder="Campaign Manager ad account ID"
                      inputMode="numeric"
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={subscribing || !/^\d+$/.test(accountId)}
                      onClick={async () => {
                        setSubscribing(true);
                        try {
                          await subscribeLinkedInLeads(accountId);
                          await fetchStatus();
                          toast.success("Lead Sync connected");
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Could not connect Lead Sync",
                          );
                        } finally {
                          setSubscribing(false);
                        }
                      }}
                    >
                      {subscribing ? "Connecting..." : "Connect Lead Forms"}
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Setup Dialog */}
      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete LinkedIn Setup</DialogTitle>
            <DialogDescription>
              Select the company page where you want to post jobs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {loadingOrgs ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading company pages...
              </div>
            ) : organizations.length === 0 ? (
              <div className="space-y-3 text-sm">
                <p className="text-destructive font-medium">No company pages found</p>
                <p className="text-muted-foreground">
                  You must be an administrator of a LinkedIn Company Page to post jobs.
                </p>
                <div className="bg-muted/50 border border-border rounded-md p-3 space-y-2">
                  <p className="text-xs font-medium">To connect a different LinkedIn account:</p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Click "Switch Account" below</li>
                    <li>Wait for logout to complete (popup will close automatically)</li>
                    <li>Click "Connect" button to authorize with a new account</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Company Page</label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select a company page" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {organizations.length === 1 && (
                  <p className="text-xs text-muted-foreground">
                    Only one company page found. It has been pre-selected.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {organizations.length === 0 ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="text-xs h-8"
                  onClick={handleCancelSetup}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  className="text-xs h-8"
                  onClick={handleSwitchAccountFromSetup}
                >
                  Switch Account
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="text-xs h-8"
                  onClick={handleCancelSetup}
                  disabled={completingSetup}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="text-xs h-8"
                  onClick={handleCompleteSetup}
                  disabled={!selectedOrgId || completingSetup}
                >
                  {completingSetup ? "Connecting..." : "Connect"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Dialog */}
      <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Disconnect LinkedIn</DialogTitle>
            <DialogDescription>
              This will remove the LinkedIn integration. You can reconnect anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="text-xs h-8"
              onClick={() => setDisconnectDialogOpen(false)}
              disabled={disconnecting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="text-xs h-8"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
