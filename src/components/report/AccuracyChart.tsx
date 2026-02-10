import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AccuracyScore } from "@/lib/reportParser";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  data: AccuracyScore[];
  title?: string;
}

export const AccuracyChart = ({ data, title = "Accuracy Scores" }: Props) => {
  const banks = useMemo(() => [...new Set(data.map(d => d.bankName))], [data]);
  const [selectedBank, setSelectedBank] = useState<string>(banks.includes('TOTAL') ? 'TOTAL' : banks[0] ?? '');

  const chartData = useMemo(() => {
    return data
      .filter(d => d.bankName === selectedBank)
      .map(d => ({
        metric: d.metric.replace('accuracy_', '').replace('_hitrate', ' HR'),
        benchmark: +(d.benchmark * 100).toFixed(2),
        development: +(d.development * 100).toFixed(2),
        delta: d.delta,
      }));
  }, [data, selectedBank]);

  const totalData = useMemo(() => data.filter(d => d.bankName === 'TOTAL'), [data]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Select value={selectedBank} onValueChange={setSelectedBank}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {banks.map(b => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary badges for TOTAL */}
        {totalData.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {totalData.map(d => (
              <Badge
                key={d.metric}
                variant={d.delta < -1 ? 'destructive' : d.delta > 0 ? 'default' : 'secondary'}
                className="font-mono text-xs"
              >
                {d.metric}: {d.delta > 0 ? '+' : ''}{d.delta.toFixed(2)}%
              </Badge>
            ))}
          </div>
        )}

        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                formatter={(value: number, name: string) => [`${value}%`, name]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Legend />
              <Bar dataKey="benchmark" name="Benchmark" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="development" name="Development" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.delta < -0.5 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
