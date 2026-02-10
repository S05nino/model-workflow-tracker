import { ParsedReport } from "@/lib/reportParser";
import { ModelInfoCard } from "./ModelInfoCard";
import { AccuracyChart } from "./AccuracyChart";
import { CrosstabHeatmap } from "./CrosstabHeatmap";
import { PSIChart } from "./PSIChart";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  report: ParsedReport;
  onRemove: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  accuracy: 'Accuracy',
  anomaly: 'Anomalie',
  precision: 'Precision',
  stability: 'Stabilità',
  unknown: 'Report',
};

const TYPE_COLORS: Record<string, string> = {
  accuracy: 'bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]',
  anomaly: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]',
  precision: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]',
  stability: 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]',
  unknown: 'bg-muted text-muted-foreground',
};

export const ReportViewer = ({ report, onRemove }: Props) => {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
          <span className="font-mono text-sm truncate max-w-[300px]">{report.fileName}</span>
          <Badge className={TYPE_COLORS[report.type]}>
            {TYPE_LABELS[report.type]}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Model Info */}
      {report.modelInfo.length > 0 && (
        <ModelInfoCard data={report.modelInfo} />
      )}

      {/* Accuracy/Anomaly specific */}
      {report.accuracyScores && report.accuracyScores.length > 0 && (
        <AccuracyChart
          data={report.accuracyScores}
          title={report.type === 'anomaly' ? 'Anomaly Scores' : 'Accuracy Scores'}
        />
      )}

      {/* Crosstab Macro */}
      {report.crosstabMacro && report.crosstabMacro.rows.length > 0 && (
        <CrosstabHeatmap
          data={report.crosstabMacro}
          title={report.type === 'accuracy' || report.type === 'anomaly'
            ? 'Prediction Crosstab (Macro)'
            : 'Crosstab (Macro)'}
        />
      )}

      {/* Crosstab Micro */}
      {report.crosstabMicro && report.crosstabMicro.rows.length > 0 && (
        <CrosstabHeatmap
          data={report.crosstabMicro}
          title={report.type === 'accuracy' || report.type === 'anomaly'
            ? 'Prediction Crosstab (Micro)'
            : 'Crosstab (Micro)'}
        />
      )}

      {/* Correction Crosstab */}
      {report.correctionCrosstab && report.correctionCrosstab.rows.length > 0 && (
        <CrosstabHeatmap data={report.correctionCrosstab} title="Correction Crosstab (Macro)" />
      )}

      {/* PSI Charts */}
      {report.psiMacro && report.psiMacro.length > 0 && (
        <PSIChart data={report.psiMacro} title="PSI (Macro)" />
      )}

      {report.psiMicro && report.psiMicro.length > 0 && (
        <PSIChart data={report.psiMicro} title="PSI (Micro)" />
      )}
    </div>
  );
};
