"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@onehash/ui/table";
import type { SourceItem } from "@/api/reports";

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function useChartWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = () => setWidth(node.getBoundingClientRect().width);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return [ref, width] as const;
}

function SourceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="grid min-w-[9rem] gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{capitalize(String(label))}</div>
      {payload.map((item) => (
        <div key={String(item.name)} className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{item.name}</span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {Number(item.value ?? 0).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

interface SourceEffectivenessSectionProps {
  data: SourceItem[];
  showTrend?: boolean;
}

export function SourceEffectivenessSection({
  data,
  showTrend = false,
}: SourceEffectivenessSectionProps) {
  const hasData = data.length > 0;
  const [compactChartRef, compactChartWidth] = useChartWidth();
  const [trendChartRef, trendChartWidth] = useChartWidth();
  const maxCandidates = Math.max(...data.map((item) => item.candidates), 0);
  const yAxisMax = maxCandidates > 0 ? Math.max(10, Math.ceil(maxCandidates * 1.25)) : 10;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Source Effectiveness</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div
            className={`grid gap-4 ${hasData ? "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px]" : "grid-cols-1"}`}
          >
            <div className="overflow-x-auto -mx-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] h-9">Source</TableHead>
                    <TableHead className="text-[11px] h-9 text-right">Candidates</TableHead>
                    <TableHead className="text-[11px] h-9 text-right hidden sm:table-cell">
                      Interviews
                    </TableHead>
                    <TableHead className="text-[11px] h-9 text-right hidden sm:table-cell">
                      Hires
                    </TableHead>
                    <TableHead className="text-[11px] h-9 text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row) => (
                    <TableRow key={row.source}>
                      <TableCell className="text-xs py-2.5 font-medium">
                        {capitalize(row.source)}
                      </TableCell>
                      <TableCell className="text-xs py-2.5 text-right text-muted-foreground">
                        {row.candidates}
                      </TableCell>
                      <TableCell className="text-xs py-2.5 text-right text-muted-foreground hidden sm:table-cell">
                        {row.interviews}
                      </TableCell>
                      <TableCell className="text-xs py-2.5 text-right text-muted-foreground hidden sm:table-cell">
                        {row.hires}
                      </TableCell>
                      <TableCell className="text-xs py-2.5 text-right">
                        {row.hire_rate_pct.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-xs text-muted-foreground text-center py-8"
                      >
                        No source data for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {hasData && (
              <div ref={compactChartRef} className="w-full xl:self-center" style={{ height: 220 }}>
                {compactChartWidth > 0 && (
                  <BarChart
                    width={compactChartWidth}
                    height={220}
                    data={data}
                    margin={{ left: 0, right: 0, top: 8, bottom: 0 }}
                    barCategoryGap={18}
                  >
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="source"
                      tick={{ fontSize: 9 }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tickFormatter={(value: string) => capitalize(value.split(" ")[0])}
                    />
                    <YAxis
                      domain={[0, yAxisMax]}
                      tick={{ fontSize: 9 }}
                      tickLine={false}
                      axisLine={false}
                      width={34}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
                      content={<SourceTooltip />}
                    />
                    <Bar
                      dataKey="candidates"
                      name="Candidates"
                      fill="hsl(var(--chart-2))"
                      radius={[4, 4, 0, 0]}
                      barSize={28}
                      minPointSize={6}
                      activeBar={{ fill: "hsl(var(--chart-2) / 0.85)" }}
                    />
                  </BarChart>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showTrend && hasData && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Source Trend</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div ref={trendChartRef} className="w-full" style={{ height: 240 }}>
              {trendChartWidth > 0 && (
                <BarChart
                  width={trendChartWidth}
                  height={240}
                  data={data}
                  margin={{ left: 0, right: 16, top: 4, bottom: 0 }}
                  barCategoryGap={22}
                >
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="source"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={capitalize}
                  />
                  <YAxis
                    domain={[0, yAxisMax]}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={34}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
                    content={<SourceTooltip />}
                  />
                  <Bar
                    dataKey="candidates"
                    name="Candidates"
                    fill="hsl(var(--chart-2))"
                    radius={[4, 4, 0, 0]}
                    barSize={36}
                    minPointSize={6}
                    activeBar={{ fill: "hsl(var(--chart-2) / 0.85)" }}
                  />
                  <Bar
                    dataKey="hires"
                    name="Hires"
                    fill="hsl(var(--chart-1))"
                    radius={[4, 4, 0, 0]}
                    barSize={12}
                    minPointSize={3}
                    activeBar={{ fill: "hsl(var(--chart-1) / 0.85)" }}
                  />
                </BarChart>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
