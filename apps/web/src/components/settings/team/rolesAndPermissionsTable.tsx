"use client";

import { Fragment } from "react";
import { Card, CardContent } from "@onehash/ui/card";
import { Separator } from "@onehash/ui/separator";
import { permissionMatrix, roles } from "./lib/permissonMatrix";

export function RolesAndPermissionsTable() {
  return (
    <Card>
      <CardContent className="p-4 md:p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-0.5">Roles & Permissions</h3>
          <p className="text-xs text-muted-foreground">Overview of available roles and their access levels.</p>
        </div>
        <Separator />

        <div>
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
