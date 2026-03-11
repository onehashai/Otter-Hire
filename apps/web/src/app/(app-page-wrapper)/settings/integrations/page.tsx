"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  disconnectEmailIntegration,
  getIntegrationApps,
  type IntegrationAppDescriptor,
} from "@/api";
import { EmailIntegrationAppIcon } from "@/features/integrations/email-integration/EmailIntegrationAppIcon";
import { EmailIntegrationManager } from "@/features/integrations/email-integration/EmailIntegrationManager";
import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import { Button } from "@onehash/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@onehash/ui/tooltip";
import { CheckCircle2, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";

function IntegrationAppIcon({ slug, name }: { slug: string; name: string }) {
  const [src, setSrc] = useState("/favicon.ico");

  if (slug === "email-integration") {
    return <EmailIntegrationAppIcon />;
  }

  return (
    <div className="h-10 w-10 rounded-md border bg-muted/30 p-1 shrink-0">
      <Image
        src={src}
        alt={`${name} icon`}
        width={32}
        height={32}
        unoptimized
        className="h-full w-full object-contain"
        onError={() => {
          if (src !== "/favicon.ico") setSrc("/favicon.ico");
        }}
      />
    </div>
  );
}

export default function IntegrationsSettingsPage() {
  const searchParams = useSearchParams();

  const [apps, setApps] = useState<IntegrationAppDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const appsResp = await getIntegrationApps();
      setApps(appsResp.items || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load integrations";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectEmailIntegration();
      toast.success("Email integration disconnected.");
      setDisconnectDialogOpen(false);
      await loadCatalog();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disconnect integration";
      toast.error(message);
    } finally {
      setDisconnecting(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  useEffect(() => {
    if (searchParams.get("app") === "email-integration") {
      setManageDialogOpen(true);
    }
  }, [searchParams]);

  return (
    <TooltipProvider>
      <h2 className="text-base md:text-lg font-semibold mb-1">Integrations</h2>
      <p className="text-xs text-muted-foreground mb-4 md:mb-6">
        Connect external tools to streamline your hiring workflow.
      </p>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading integrations...</div>
      ) : apps.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No integrations available.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Card key={app.app_id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <IntegrationAppIcon slug={app.slug} name={app.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <CardTitle className="text-sm truncate">{app.name}</CardTitle>
                      {app.installed && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5 block">
                      {app.category}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 gap-4 pt-0">
                <p className="text-xs text-muted-foreground flex-1">{app.description}</p>
                {app.slug === "email-integration" ? (
                  <div className="flex items-center justify-between gap-2">
                    {app.installed ? (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              onClick={() => setManageDialogOpen(true)}
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
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Disconnect</TooltipContent>
                        </Tooltip>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="default"
                        className="text-xs h-8 w-full"
                        onClick={() => setManageDialogOpen(true)}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="text-xs h-8 w-full" disabled>
                    Coming Soon
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Manage dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Integration</DialogTitle>
            <DialogDescription>
              Configure careers inbox forwarding and verification for inbound resume parsing.
            </DialogDescription>
          </DialogHeader>

          <EmailIntegrationManager onChanged={loadCatalog} />

          <DialogFooter>
            <Button
              type="button"
              className="text-xs h-8"
              onClick={() => setManageDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect confirmation dialog */}
      <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Disconnect Email Integration</DialogTitle>
            <DialogDescription>
              This will remove the email integration and stop inbound email parsing. This action
              cannot be undone.
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
    </TooltipProvider>
  );
}
