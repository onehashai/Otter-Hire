"use client";

import { Card, CardContent } from "@onehash/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { KPIDataItem } from "./data";

export function KPICard({ title, value, change, trend, icon: Icon }: KPIDataItem) {
  const isPositive = trend === "up";
  return (
    <Card>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[11px] md:text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl md:text-3xl font-semibold tracking-tight">{value}</p>
          </div>
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2">
          {isPositive ? (
            <TrendingUp className="h-3 w-3 text-foreground" />
          ) : (
            <TrendingDown className="h-3 w-3 text-muted-foreground" />
          )}
          <span className={`text-[11px] font-medium ${isPositive ? "text-foreground" : "text-muted-foreground"}`}>
            {change > 0 ? "+" : ""}
            {change}%
          </span>
          <span className="text-[10px] text-muted-foreground">vs prev period</span>
        </div>
      </CardContent>
    </Card>
  );
}
