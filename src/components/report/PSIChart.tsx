import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PSIData } from "@/lib/reportParser";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Props {
  data: PSIData[];
  title: string;
}

export const PSIChart = ({ data, title }: Props) => {
  const banks = useMemo(() => [...new Set(data.map(d => d.bankName))], [data]);
  const [selectedBank, setSelectedBank] = useState<string>(banks[0] ?? '');

  const chartData = useMemo(() => {
    return data
      .filter(d => d.bankName === selectedBank && d.category !== 'TOT')
      .map(d => ({
        category: d.category,
        'Freq Old %': +(d.freqOld * 100).toFixed(2),
        'Freq New %': +(d.freqNew * 100).toFixed(2),
        psi: d.psi,
      }));
  }, [data, selectedBank]);

  const totalPSI = useMemo(() => {
    const tot = data.find(d => d.bankName === selectedBank && d.category === 'TOT');
    return tot?.psi ?? 0;
  }, [data, selectedBank]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{title}</CardTitle>
            <Badge
              variant={totalPSI > 0.1 ? 'destructive' : totalPSI > 0.01 ? 'secondary' : 'default'}
              className="font-mono"
            >
              PSI: {totalPSI.toFixed(4)}
            </Badge>
          </div>
          <Select value={selectedBank} onValueChange={setSelectedBank}>
            <SelectTrigger className="w-[250px]">
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
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="category" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                formatter={(value: number, name: string) => [`${value}%`, name]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Legend />
              <Bar dataKey="Freq Old %" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Freq New %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
