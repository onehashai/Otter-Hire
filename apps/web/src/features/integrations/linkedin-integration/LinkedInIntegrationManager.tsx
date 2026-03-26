"use client";

import { useEffect, useState } from "react";
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
import { Loader2 } from "lucide-react";
import { toast } from "@onehash/ui/sonner";
import {
  connectLinkedIn,
  disconnectLinkedIn,
  getLinkedInStatus,
  getLinkedInOrganizations,
  completeLinkedInSetup,
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

  const fetchOrganizations = async () => {
    setLoadingOrgs(true);
    try {
      const data = await getLinkedInOrganizations();
      setOrganizations(data.organizations || []);

      if (data.organizations.length === 1) {
        setSelectedOrgId(data.organizations[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
      setOrganizations([]);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleCancelSetup = () => {
    setSetupDialogOpen(false);
    setConnecting(false);
  };

  const handleSwitchAccount = async () => {
    try {
      await disconnectLinkedIn();
      await fetchStatus();
      await onChanged?.();
      setSetupDialogOpen(false);

      const width = 600;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const logoutPopup = window.open(
        "https://www.linkedin.com/m/logout",
        "LinkedIn Logout",
        `width=${width},height=${height},left=${left},top=${top}`,
      );

      setTimeout(() => {
        logoutPopup?.close();
      }, 1000);
    } catch (error) {
      console.error("Failed to disconnect:", error);
      toast.error("Failed to switch account");
    }
  };

  const handleOpenSetup = async () => {
    setSetupDialogOpen(true);
    await fetchOrganizations();
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { authorization_url } = await connectLinkedIn();

      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        authorization_url,
        "LinkedIn OAuth",
        `width=${width},height=${height},left=${left},top=${top}`,
      );

      const handleMessage = async (event: MessageEvent) => {
        if (event.data?.type === "linkedin_oauth_complete") {
          popup?.close();
          await fetchStatus();
          setSetupDialogOpen(true);
          await fetchOrganizations();
          setConnecting(false);
          window.removeEventListener("message", handleMessage);
        }
      };

      window.addEventListener("message", handleMessage);

      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          setConnecting(false);
          window.removeEventListener("message", handleMessage);
        }
      }, 500);
    } catch (error) {
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
    try {
      await disconnectLinkedIn();
      toast.success("LinkedIn disconnected successfully");
      setDisconnectDialogOpen(false);
      await fetchStatus();
      await onChanged?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to disconnect LinkedIn";
      toast.error(message);
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
  const isSetupIncomplete = status.setup_incomplete;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        {isSetupComplete ? (
          <>
            <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
              ✓ Connected
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDisconnectDialogOpen(true)}
              disabled={disconnecting}
              className="text-xs h-8"
            >
              Disconnect
            </Button>
          </>
        ) : isSetupIncomplete ? (
          <>
            <div className="flex items-center gap-2 text-xs text-amber-600 font-medium">
              ⚠ Setup Incomplete
            </div>
            <Button size="sm" variant="outline" onClick={handleOpenSetup} className="text-xs h-8">
              Complete Setup
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={connecting}
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
                <Button type="button" className="text-xs h-8" onClick={handleSwitchAccount}>
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
