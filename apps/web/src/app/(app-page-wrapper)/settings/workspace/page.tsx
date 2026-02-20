"use client";

import { useState, useEffect } from "react";
import { useAuthSession } from "@/app/providers";
import { updateOrganization } from "@/api";
import { Card, CardContent } from "@onehash/ui/card";
import { InputField } from "@onehash/ui/input";
import { Separator } from "@onehash/ui/separator";
import { Button } from "@onehash/ui/button";
import { toast } from "sonner";

export default function WorkspaceSettings() {
  const { user, refreshSession } = useAuthSession();
  
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [originalWebsite, setOriginalWebsite] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      const orgName = user.org_name || "";
      const orgWebsite = user.org_website || "";
      setName(orgName);
      setWebsite(orgWebsite);
      setOriginalName(orgName);
      setOriginalWebsite(orgWebsite);
    }
  }, [user]);

  const isDirty = name !== originalName || website !== originalWebsite;
  const canSave = isDirty && name.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    
    setSaving(true);
    try {
      await updateOrganization({
        name: name.trim(),
        website: website.trim() || null,
      });
      
      await refreshSession(true);
      
      setOriginalName(name.trim());
      setOriginalWebsite(website.trim());
      
      toast.success("Workspace settings saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save settings";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h2 className="text-base md:text-lg font-semibold mb-1">Workspace</h2>
      <p className="text-xs text-muted-foreground mb-4 md:mb-6">Manage your workspace settings</p>

      <div className="space-y-6">
        <Card>
          <CardContent className="p-4 md:p-5 space-y-4">
            <InputField
              label="Workspace Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter workspace name"
              className="text-sm h-10 md:h-9"
            />
            <InputField
              label="Website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="Enter company's website"
              className="text-sm h-10 md:h-9"
            />
            <Separator />
            <Button
              size="sm"
              className="text-xs h-9 md:h-8"
              onClick={handleSave}
              disabled={!canSave}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
