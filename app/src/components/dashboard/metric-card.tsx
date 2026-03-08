import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  trend?: {
    direction: "up" | "down" | "flat";
    label: string;
    isPositive?: boolean; // up can be good or bad depending on metric
  };
  loading?: boolean;
  variant?: "default" | "highlight" | "warning";
}

export function MetricCard({
  label,
  value,
  subtitle,
  trend,
  loading,
  variant = "default",
}: MetricCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="mt-2 h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        variant === "highlight" && "border-primary/20 bg-primary/[0.02]",
        variant === "warning" && "border-score-high/20 bg-score-high/[0.02]"
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl font-semibold text-foreground">
          {value}
        </p>
        {trend && (
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-xs",
              trend.isPositive ? "text-score-low" : "text-score-high"
            )}
          >
            <span>
              {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}
            </span>
            {trend.label}
          </p>
        )}
        {subtitle && !trend && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
