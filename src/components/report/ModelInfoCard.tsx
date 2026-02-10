import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, Copy } from "lucide-react";
import { ModelInfo } from "@/lib/reportParser";
import { toast } from "sonner";

interface Props {
  data: ModelInfo[];
}

export const ModelInfoCard = ({ data }: Props) => {
  const devModelId = data.find(d => d.field === 'id')?.development ?? '';
  const devRuleId = data.find(d => d.field === 'expert_rule_id')?.development ?? '';
  const versionBench = data.find(d => d.field === 'version')?.benchmark ?? '';
  const versionDev = data.find(d => d.field === 'version')?.development ?? '';
  const hasDifferences = data.some(d => d.isDifferent);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiato!`);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Model Information</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="font-mono">{versionBench} → {versionDev}</Badge>
            {hasDifferences ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" /> Differenze rilevate
              </Badge>
            ) : (
              <Badge className="gap-1 bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">
                <CheckCircle className="w-3 h-3" /> Config compatibile
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Release IDs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground mb-1">Development Model ID</p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono truncate flex-1">{devModelId}</code>
              <button onClick={() => copyToClipboard(devModelId, 'Model ID')} className="shrink-0 text-muted-foreground hover:text-foreground">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground mb-1">Development Expert Rule ID</p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono truncate flex-1">{devRuleId}</code>
              <button onClick={() => copyToClipboard(devRuleId, 'Rule ID')} className="shrink-0 text-muted-foreground hover:text-foreground">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Full table */}
        <div className="max-h-[300px] overflow-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky top-0 bg-card">Campo</TableHead>
                <TableHead className="sticky top-0 bg-card">Benchmark</TableHead>
                <TableHead className="sticky top-0 bg-card">Development</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.field} className={row.isDifferent ? 'bg-destructive/10' : ''}>
                  <TableCell className="font-medium text-xs">{row.field}</TableCell>
                  <TableCell className="font-mono text-xs">{row.benchmark}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.development}
                    {row.isDifferent && <AlertTriangle className="inline ml-1 w-3 h-3 text-destructive" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
