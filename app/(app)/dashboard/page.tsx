import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const metrics = [
  { label: "Portfolio value", value: "EUR 0.00" },
  { label: "Invested capital", value: "EUR 0.00" },
  { label: "Total gain/loss", value: "EUR 0.00" },
  { label: "Dividends received", value: "EUR 0.00" }
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Portfolio analytics will be calculated from your transactions.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio development</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-72 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            Time-series chart placeholder
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

