import { Users, Briefcase, UserCheck, Clock, ThumbsUp, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type KPIDataItem = {
  title: string;
  value: string;
  change: number;
  trend: "up" | "down";
  icon: LucideIcon;
};

export const kpiData: KPIDataItem[] = [
  { title: "Total Candidates", value: "1,284", change: 12.5, trend: "up", icon: Users },
  { title: "Active Jobs", value: "18", change: -2.1, trend: "down", icon: Briefcase },
  { title: "Hires", value: "34", change: 8.3, trend: "up", icon: UserCheck },
  { title: "Time to Hire", value: "23d", change: -15.2, trend: "up", icon: Clock },
  { title: "Offer Acceptance", value: "87%", change: 3.1, trend: "up", icon: ThumbsUp },
  { title: "Conversion Rate", value: "4.8%", change: 0.6, trend: "up", icon: ArrowRight },
];

export const funnelData = [
  { name: "Applied", value: 1284, fill: "hsl(var(--chart-1))" },
  { name: "Screening", value: 842, fill: "hsl(var(--chart-2))" },
  { name: "Interview", value: 386, fill: "hsl(var(--chart-3))" },
  { name: "Offer", value: 64, fill: "hsl(var(--chart-4))" },
  { name: "Hired", value: 34, fill: "hsl(var(--chart-5))" },
];

export const timeMetricsData = [
  { stage: "Screening", avgDays: 3.2 },
  { stage: "Interview", avgDays: 8.5 },
  { stage: "Offer", avgDays: 4.1 },
  { stage: "Hired", avgDays: 7.2 },
];

export const timeToHireTrend = [
  { month: "Sep", days: 31 },
  { month: "Oct", days: 28 },
  { month: "Nov", days: 26 },
  { month: "Dec", days: 25 },
  { month: "Jan", days: 24 },
  { month: "Feb", days: 23 },
];

export const sourceData = [
  { source: "LinkedIn", candidates: 412, interviews: 128, hires: 14, rate: "3.4%" },
  { source: "Careers Page", candidates: 356, interviews: 89, hires: 9, rate: "2.5%" },
  { source: "Referral", candidates: 198, interviews: 96, hires: 8, rate: "4.0%" },
  { source: "Indeed", candidates: 186, interviews: 42, hires: 2, rate: "1.1%" },
  { source: "Other", candidates: 132, interviews: 31, hires: 1, rate: "0.8%" },
];

export const sourceChartData = [
  { name: "LinkedIn", candidates: 412, hires: 14 },
  { name: "Careers Page", candidates: 356, hires: 9 },
  { name: "Referral", candidates: 198, hires: 8 },
  { name: "Indeed", candidates: 186, hires: 2 },
  { name: "Other", candidates: 132, hires: 1 },
];

export const recruiterData = [
  { name: "Sarah Chen", handled: 312, interviews: 89, hires: 12, avgDays: 19 },
  { name: "Mike Johnson", handled: 278, interviews: 72, hires: 9, avgDays: 22 },
  { name: "Emily Davis", handled: 245, interviews: 68, hires: 8, avgDays: 21 },
  { name: "Alex Kim", handled: 198, interviews: 54, hires: 5, avgDays: 28 },
];

export const jobPerformance = [
  {
    id: "1",
    title: "Senior Frontend Engineer",
    applicants: 186,
    conversion: "5.4%",
    timeToHire: "18d",
    status: "Active",
  },
  {
    id: "2",
    title: "Product Designer",
    applicants: 142,
    conversion: "4.2%",
    timeToHire: "22d",
    status: "Active",
  },
  {
    id: "3",
    title: "Backend Engineer",
    applicants: 128,
    conversion: "3.9%",
    timeToHire: "25d",
    status: "Active",
  },
  {
    id: "4",
    title: "Data Analyst",
    applicants: 96,
    conversion: "6.3%",
    timeToHire: "15d",
    status: "Closed",
  },
  {
    id: "5",
    title: "DevOps Engineer",
    applicants: 74,
    conversion: "2.7%",
    timeToHire: "30d",
    status: "Active",
  },
];

export const chartConfig = {
  candidates: { label: "Candidates", color: "hsl(var(--chart-1))" },
  hires: { label: "Hires", color: "hsl(var(--chart-3))" },
  days: { label: "Days", color: "hsl(var(--chart-1))" },
  avgDays: { label: "Avg Days", color: "hsl(var(--chart-2))" },
};
