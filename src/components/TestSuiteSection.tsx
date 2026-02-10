import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, FlaskConical, Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useState, useCallback } from "react";
import { ParsedReport, parseReportFile } from "@/lib/reportParser";
import { ReportViewer } from "./report/ReportViewer";

const STREAMLIT_URL = "http://localhost:8501";

export const TestSuiteSection = () => {
  const [reports, setReports] = useState<ParsedReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpen = () => {
    window.open(STREAMLIT_URL, "_blank");
    toast.info("Apertura TestSuite", {
      description: "Assicurati che Streamlit sia in esecuzione: streamlit run dashboard.py",
    });
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    try {
      const newReports: ParsedReport[] = [];
      for (const file of Array.from(files)) {
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
          toast.error(`File non supportato: ${file.name}`, { description: "Carica solo file .xlsx" });
          continue;
        }
        const parsed = await parseReportFile(file);
        newReports.push(parsed);
      }
      setReports(prev => [...prev, ...newReports]);
      if (newReports.length > 0) {
        toast.success(`${newReports.length} report caricati!`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Errore nel parsing del file");
    } finally {
      setIsLoading(false);
      // Reset input
      e.target.value = '';
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files.length) return;

    setIsLoading(true);
    try {
      const newReports: ParsedReport[] = [];
      for (const file of Array.from(files)) {
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) continue;
        const parsed = await parseReportFile(file);
        newReports.push(parsed);
      }
      setReports(prev => [...prev, ...newReports]);
      if (newReports.length > 0) {
        toast.success(`${newReports.length} report caricati!`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Errore nel parsing del file");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeReport = (index: number) => {
    setReports(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 py-6">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Test Suite</h2>
          <p className="text-sm text-muted-foreground">
            Carica i report Excel per visualizzare i risultati, oppure avvia Streamlit per eseguire i test
          </p>
        </div>
        <Button onClick={handleOpen} variant="outline" className="gap-2">
          <ExternalLink className="w-4 h-4" />
          Apri Streamlit
        </Button>
      </div>

      {/* Upload area */}
      <Card
        className="border-dashed border-2 cursor-pointer hover:border-primary/50 transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <CardContent className="py-8">
          <label className="flex flex-col items-center gap-3 cursor-pointer">
            <div className="p-4 rounded-full bg-primary/10">
              {isLoading ? (
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-8 h-8 text-primary" />
              )}
            </div>
            <div className="text-center">
              <p className="font-medium">
                {isLoading ? 'Parsing in corso...' : 'Trascina i file qui o clicca per caricare'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supporta file .xlsx — Accuracy, Anomalie, Precision, Stability
              </p>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              disabled={isLoading}
            />
          </label>
        </CardContent>
      </Card>

      {/* Loaded reports count */}
      {reports.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileSpreadsheet className="w-4 h-4" />
          <span>{reports.length} report caricati</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs"
            onClick={() => setReports([])}
          >
            Rimuovi tutti
          </Button>
        </div>
      )}

      {/* Report viewers */}
      {reports.map((report, idx) => (
        <ReportViewer key={`${report.fileName}-${idx}`} report={report} onRemove={() => removeReport(idx)} />
      ))}
    </div>
  );
};
