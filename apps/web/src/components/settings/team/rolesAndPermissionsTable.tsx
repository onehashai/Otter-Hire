"use client";

import { Fragment } from "react";
import { Card, CardContent, Separator, Icon } from "@onehash/ui";
import { permissionMatrix, roles, ROLE_LABELS } from "./lib/permissonMatrix";

export function RolesAndPermissionsTable() {
  return (
    <Card>
      <CardContent className="p-4 md:p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-0.5">Roles & Permissions</h3>
          <p className="text-xs text-muted-foreground">Overview of available roles and their access levels.</p>
        </div>
        <Separator />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map(({ role, label, description, icon }) => (
            <div key={role} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
              <div className="h-8 w-8 rounded-md bg-background border flex items-center justify-center shrink-0 mt-0.5">
                <Icon name={icon} className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div>
          <h4 className="text-xs font-semibold mb-3">Permission Matrix</h4>
          <div className="relative w-full overflow-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left font-medium p-2.5 sticky left-0 bg-muted/40 min-w-[160px] z-10">Permission</th>
                  {roles.map(({ role, label }) => (
                    <th key={role} className="text-center font-medium p-2.5 min-w-[80px]">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionMatrix.map((category) => (
                  <Fragment key={category.category}>
                    <tr className="border-b bg-muted/20">
                      <td colSpan={7} className="p-2 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider sticky left-0 bg-muted/20 z-10">
                        {category.category}
                      </td>
                    </tr>
                    {category.permissions.map((perm) => (
                      <tr key={perm.label} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="p-2.5 text-muted-foreground sticky left-0 bg-background z-10">{perm.label}</td>
                        {roles.map(({ role, label }) => (
                          <td key={role} className="p-2.5 text-center">
                            {perm.roles[label as keyof typeof perm.roles] ? (
                              <span className="inline-block h-4 w-4 rounded-full bg-foreground/80" />
                            ) : (
                              <span className="inline-block h-4 w-4 rounded-full border border-muted-foreground/20" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
