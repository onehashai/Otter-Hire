import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const charts = [
  { title: "Time to Hire", value: "23 days", subtitle: "avg. across all roles" },
  { title: "Source Performance", value: "LinkedIn", subtitle: "highest quality source" },
  { title: "Funnel Conversion", value: "4.8%", subtitle: "applied → hired rate" },
  { title: "Diversity Metrics", value: "42%", subtitle: "underrepresented groups" },
  { title: "Team Activity", value: "156", subtitle: "actions this week" },
  { title: "Open Roles", value: "12", subtitle: "across 5 departments" },
];

const Reports = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs">Last 30 days</Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">Last 90 days</Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">This Year</Button>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {charts.map((chart) => (
          <Card key={chart.title} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground mb-1">{chart.title}</p>
              <p className="text-2xl font-semibold">{chart.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{chart.subtitle}</p>
              {/* Placeholder chart area */}
              <div className="mt-4 h-20 bg-muted/50 rounded-lg flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground">Chart</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Reports;
