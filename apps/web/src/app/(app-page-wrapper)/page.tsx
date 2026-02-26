"use client";

import JobsPage from "./jobs/page";

export default function RootPage() {
  // TODO(mvp-nav): Restore Dashboard page at "/" after MVP launch.
  /*
  import { Card, CardContent } from "@onehash/ui/card";
  import { Briefcase, Users, Calendar, TrendingUp } from "lucide-react";

  const stats = [
    { label: "Active Jobs", value: "12", icon: Briefcase },
    { label: "In Pipeline", value: "148", icon: Users },
    { label: "Interviews", value: "5", icon: Calendar },
    { label: "Velocity", value: "23d", icon: TrendingUp },
  ];

  function DashboardPage() {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-3 md:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] md:text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-xl md:text-2xl font-semibold mt-0.5 md:mt-1">{stat.value}</p>
                  </div>
                  <stat.icon className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
          <Card className="lg:col-span-2">
            <CardContent className="p-4 md:p-5">
              <h3 className="text-sm font-medium mb-3 md:mb-4">Conversion Funnel</h3>
              <div className="space-y-2.5 md:space-y-3">
                {["Applied", "Screened", "Interview", "Offer", "Hired"].map((stage, i) => (
                  <div key={stage} className="flex items-center gap-2 md:gap-3">
                    <span className="text-[11px] md:text-xs text-muted-foreground w-14 md:w-16">{stage}</span>
                    <div className="flex-1 h-5 md:h-6 bg-muted rounded-md overflow-hidden">
                      <div className="h-full bg-foreground/10 rounded-md" style={{ width: `${100 - i * 18}%` }} />
                    </div>
                    <span className="text-[11px] md:text-xs text-muted-foreground w-7 md:w-8 text-right">{[250, 180, 95, 32, 12][i]}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-5">
              <h3 className="text-sm font-medium mb-3 md:mb-4">Recent Activity</h3>
              <div className="space-y-3 md:space-y-4">
                {[
                  "New application for Senior Engineer",
                  "Interview scheduled with Alex R.",
                  "Offer sent to Maria K.",
                  "Job posted: Product Designer",
                ].map((activity, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">{activity}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  return <DashboardPage />;
  */

  return <JobsPage />;
}
