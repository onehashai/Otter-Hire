"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@onehash/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { StageTime, MonthTrend } from "@/api/reports";

const CHART_HEIGHT = 180;

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

function MetricTooltip({
  active,
  payload,
  label,
  suffix = "",
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string }>;
  label?: string | number;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="grid min-w-[8rem] gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{label}</div>
      {payload.map((item) => (
        <div key={String(item.name)} className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{item.name}</span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {Number(item.value ?? 0).toFixed(1)}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

interface TimeMetricsProps {
  avgTimePerStage: StageTime[];
  timeToHireTrend: MonthTrend[];
}

export function TimeMetrics({ avgTimePerStage, timeToHireTrend }: TimeMetricsProps) {
  const [stageChartRef, stageChartWidth] = useChartWidth();
  const [trendChartRef, trendChartWidth] = useChartWidth();
  const hasStageData = avgTimePerStage.length > 0;
  const hasTrendData = timeToHireTrend.length > 0;
  const allStageValuesZero = hasStageData && avgTimePerStage.every((item) => item.avg_days === 0);
  const allTrendValuesZero = hasTrendData && timeToHireTrend.every((item) => item.days === 0);
  const stageMax = hasStageData
    ? Math.max(1, Math.ceil(Math.max(...avgTimePerStage.map((item) => item.avg_days), 0)))
    : 1;
  const trendMax = hasTrendData
    ? Math.max(1, Math.ceil(Math.max(...timeToHireTrend.map((item) => item.days), 0)))
    : 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Time Analytics</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-3">Avg. Time in Stage</p>
            {hasStageData ? (
              <div ref={stageChartRef} className="w-full" style={{ height: CHART_HEIGHT }}>
                {stageChartWidth > 0 && (
                  <>
                    <BarChart
                      width={stageChartWidth}
                      height={CHART_HEIGHT}
                      data={avgTimePerStage}
                      layout="vertical"
                      margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
                      barCategoryGap={18}
                    >
                      <CartesianGrid
                        horizontal={false}
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        type="number"
                        domain={[0, stageMax]}
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        dataKey="stage"
                        type="category"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        width={74}
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
                        content={<MetricTooltip suffix="d" />}
                      />
                      <Bar
                        dataKey="avg_days"
                        name="Avg Days"
                        fill="hsl(var(--chart-2))"
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                        minPointSize={allStageValuesZero ? 4 : 2}
                        activeBar={{ fill: "hsl(var(--chart-2) / 0.85)" }}
                      />
                    </BarChart>
                    {allStageValuesZero ? (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        All tracked stage times are currently 0d for this period.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : (
              <div
                style={{ height: CHART_HEIGHT }}
                className="flex items-center justify-center text-xs text-muted-foreground"
              >
                No stage data for this period
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-3">Time to Hire Trend</p>
            {hasTrendData ? (
              <div ref={trendChartRef} className="w-full" style={{ height: CHART_HEIGHT }}>
                {trendChartWidth > 0 && (
                  <>
                    <AreaChart
                      width={trendChartWidth}
                      height={CHART_HEIGHT}
                      data={timeToHireTrend}
                      margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        domain={[0, trendMax]}
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        width={30}
                      />
                      <Tooltip
                        cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                        content={<MetricTooltip suffix="d" />}
                      />
                      {allTrendValuesZero ? (
                        <ReferenceLine y={0} stroke="hsl(var(--chart-1))" strokeOpacity={0.45} />
                      ) : null}
                      <Area
                        type="monotone"
                        dataKey="days"
                        name="Days"
                        stroke="hsl(var(--chart-1))"
                        fill="hsl(var(--chart-1))"
                        fillOpacity={allTrendValuesZero ? 0.02 : 0.1}
                        strokeWidth={2}
                        dot={{ r: 3, fill: "hsl(var(--chart-1))", strokeWidth: 0 }}
                        activeDot={{ r: 4 }}
                        connectNulls
                      />
                    </AreaChart>
                    {allTrendValuesZero ? (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Current hires in this period have an average time-to-hire of 0d.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : (
              <div
                style={{ height: CHART_HEIGHT }}
                className="flex items-center justify-center text-xs text-muted-foreground"
              >
                No hire trend data for this period
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
