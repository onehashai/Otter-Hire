"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { getInstalledIntegrationApps, getIntegrationApps, type IntegrationAppDescriptor, type IntegrationInstalledApp } from "@/api";
import { EmailIntegrationAppIcon } from "@/features/integrations/app-store/email-integration/EmailIntegrationAppIcon";
import { EmailIntegrationManager } from "@/features/integrations/app-store/email-integration/EmailIntegrationManager";
import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@onehash/ui/tabs";
import { Badge } from "@onehash/ui/badge";
import { Button } from "@onehash/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
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
  const [installedApps, setInstalledApps] = useState<IntegrationInstalledApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const [appsResp, installedResp] = await Promise.all([
        getIntegrationApps(),
        getInstalledIntegrationApps(),
      ]);
      setApps(appsResp.items || []);
      setInstalledApps(installedResp.items || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load integrations";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  useEffect(() => {
    if (searchParams.get("app") === "email-integration") {
      setDialogOpen(true);
    }
  }, [searchParams]);

  return (
    <>
      <h2 className="text-base md:text-lg font-semibold mb-1">Integrations</h2>
      <p className="text-xs text-muted-foreground mb-4 md:mb-6">
        App Store for organization integrations and automation.
      </p>

      <Tabs defaultValue="app-store" className="w-full">
        <TabsList className="h-9 w-full justify-start bg-transparent border-b rounded-none p-0 gap-0 overflow-x-auto no-scrollbar">
          <TabsTrigger
            value="app-store"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 text-sm"
          >
            App Store
          </TabsTrigger>
          <TabsTrigger
            value="installed"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 text-sm"
          >
            Installed Apps
          </TabsTrigger>
        </TabsList>

        <TabsContent value="app-store" className="mt-6">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading integrations...</div>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {apps.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    No apps available.
                  </CardContent>
                </Card>
              ) : null}
              {apps.map((app) => (
                <Card key={app.app_id} className="border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <IntegrationAppIcon slug={app.slug} name={app.name} />
                        <CardTitle className="text-sm">{app.name}</CardTitle>
                      </div>
                      <Badge variant={app.installed ? "default" : "outline"}>
                        {app.installed ? "Installed" : "Available"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground min-h-10">{app.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase text-muted-foreground">{app.category}</span>
                      {app.slug === "email-integration" ? (
                        <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>
                          {app.installed ? "Manage" : "Configure"}
                        </Button>
                      ) : (
                        <Button size="sm" className="text-xs h-8" disabled>
                          Coming Soon
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="installed" className="mt-6">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading installed apps...</div>
          ) : installedApps.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No installed apps yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {installedApps.map((app) => (
                <Card key={app.app_id} className="border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <IntegrationAppIcon slug={app.slug} name={app.name} />
                        <CardTitle className="text-sm">{app.name}</CardTitle>
                      </div>
                      <Badge>{app.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">Slug: {app.slug}</p>
                    <p className="text-xs text-muted-foreground">
                      Configured: {app.configured ? "Yes" : "No"}
                    </p>
                    {app.slug === "email-integration" ? (
                      <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>
                        Manage
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Integration</DialogTitle>
            <DialogDescription>
              Configure careers inbox forwarding and verification for inbound resume parsing.
            </DialogDescription>
          </DialogHeader>

          <EmailIntegrationManager onChanged={loadCatalog} />

          <DialogFooter>
            <Button type="button" className="text-xs h-8" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
