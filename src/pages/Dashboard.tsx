import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Users, Calendar, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const stats = [
  { label: "Active Jobs", value: "12", icon: Briefcase },
  { label: "Candidates in Pipeline", value: "148", icon: Users },
  { label: "Interviews Today", value: "5", icon: Calendar },
  { label: "Hiring Velocity", value: "23 days", icon: TrendingUp },
];

const Dashboard = () => {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-semibold mt-1">{stat.value}</p>
                </div>
                <stat.icon className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Conversion Funnel */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <h3 className="text-sm font-medium mb-4">Conversion Funnel</h3>
            <div className="space-y-3">
              {["Applied", "Screened", "Interview", "Offer", "Hired"].map((stage, i) => (
                <div key={stage} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16">{stage}</span>
                  <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                    <div
                      className="h-full bg-foreground/10 rounded-md"
                      style={{ width: `${100 - i * 18}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{[250, 180, 95, 32, 12][i]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-medium mb-4">Recent Activity</h3>
            <div className="space-y-4">
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
};

export default Dashboard;
