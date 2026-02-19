"use client";

import { Card, CardContent, Button, InputField, Separator } from "@onehash/ui";

export default function WorkspaceSettings() {
  return (
    <>
      <h2 className="text-base md:text-lg font-semibold mb-1">Workspace</h2>
      <p className="text-xs text-muted-foreground mb-4 md:mb-6">Manage your workspace settings</p>

      <div className="space-y-6">
        <Card>
          <CardContent className="p-4 md:p-5 space-y-4">
            <InputField label="Workspace Name" defaultValue="Acme Inc" className="text-sm h-10 md:h-9" />
            <InputField label="Website" defaultValue="https://acme.com" className="text-sm h-10 md:h-9" />
            <Separator />
            <Button size="sm" className="text-xs h-9 md:h-8">Save Changes</Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
