import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrosstabData } from "@/lib/reportParser";
import { useMemo } from "react";

interface Props {
  data: CrosstabData;
  title: string;
}

function getHeatColor(value: number, max: number): string {
  if (value === 0) return 'transparent';
  const intensity = Math.min(value / Math.max(max * 0.3, 1), 1);
  // Diagonal (matching) = blue, off-diagonal = red/orange
  return `hsla(var(--primary), ${0.1 + intensity * 0.6})`;
}

function getDiagonalColor(value: number, max: number): string {
  if (value === 0) return 'transparent';
  const intensity = Math.min(value / Math.max(max, 1), 1);
  return `hsla(var(--success), ${0.15 + intensity * 0.5})`;
}

function getOffDiagonalColor(value: number, max: number): string {
  if (value === 0) return 'transparent';
  const intensity = Math.min(value / Math.max(max * 0.1, 1), 1);
  return `hsla(var(--destructive), ${0.1 + Math.min(intensity, 1) * 0.5})`;
}

export const CrosstabHeatmap = ({ data, title }: Props) => {
  const maxVal = useMemo(() => {
    let max = 0;
    data.rows.forEach(r => r.values.forEach(v => { if (v > max) max = v; }));
    return max;
  }, [data]);

  // Limit display for very large matrices
  const isLarge = data.headers.length > 30;

  if (isLarge) {
    // Show summary stats instead of full heatmap
    const totalChanges = data.rows.reduce((sum, row, ri) => {
      return sum + row.values.reduce((s, v, ci) => {
        if (ri !== ci && v > 0) return s + v;
        return s;
      }, 0);
    }, 0);
    const totalDiag = data.rows.reduce((sum, row, ri) => {
      return sum + (row.values[ri] ?? 0);
    }, 0);
    const total = totalChanges + totalDiag;
    const stability = total > 0 ? ((totalDiag / total) * 100).toFixed(2) : '100.00';

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 border text-center">
              <p className="text-2xl font-bold font-mono text-[hsl(var(--success))]">{stability}%</p>
              <p className="text-xs text-muted-foreground mt-1">Stabilità</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border text-center">
              <p className="text-2xl font-bold font-mono">{totalDiag.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Unchanged</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border text-center">
              <p className="text-2xl font-bold font-mono text-[hsl(var(--destructive))]">{totalChanges.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Changed</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Matrice {data.headers.length}×{data.rows.length} — troppo grande per la visualizzazione completa
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto max-h-[500px]">
          <table className="text-[10px] border-collapse w-full">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 bg-card p-1 border border-border text-left font-medium">
                  old\new
                </th>
                {data.headers.map(h => (
                  <th key={h} className="sticky top-0 z-10 bg-card p-1 border border-border font-medium text-center whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, ri) => (
                <tr key={row.label}>
                  <td className="sticky left-0 z-10 bg-card p-1 border border-border font-medium whitespace-nowrap">
                    {row.label}
                  </td>
                  {row.values.map((val, ci) => {
                    const isDiag = ri === ci;
                    const bg = isDiag
                      ? getDiagonalColor(val, maxVal)
                      : getOffDiagonalColor(val, maxVal);
                    return (
                      <td
                        key={ci}
                        className="p-1 border border-border text-center font-mono"
                        style={{ backgroundColor: bg }}
                        title={`${row.label} → ${data.headers[ci]}: ${val}`}
                      >
                        {val > 0 ? val : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
