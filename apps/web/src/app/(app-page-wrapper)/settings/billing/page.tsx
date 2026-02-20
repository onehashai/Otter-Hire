"use client";

import { Card, CardContent } from "@onehash/ui/card";

export default function BillingSettingsPage() {
  return (
    <>
      <h2 className="text-base md:text-lg font-semibold mb-1">Billing</h2>
      <p className="text-xs text-muted-foreground mb-4 md:mb-6">Manage your billing settings</p>

      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Billing settings coming soon</p>
        </CardContent>
      </Card>
    </>
  );
}
