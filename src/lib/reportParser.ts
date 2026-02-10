import type { WorkBook, WorkSheet } from 'xlsx';

export interface ModelInfo {
  field: string;
  benchmark: string;
  development: string;
  isDifferent: boolean;
}

export interface AccuracyScore {
  bankName: string;
  metric: string;
  benchmark: number;
  development: number;
  delta: number;
}

export interface CrosstabCell {
  row: string;
  col: string;
  value: number;
}

export interface CrosstabData {
  headers: string[];
  rows: { label: string; values: number[]; rowTotal?: number }[];
  columnTotals?: number[];
}

export interface PSIData {
  bankName: string;
  category: string;
  freqOld: number;
  countOld: number;
  freqNew: number;
  countNew: number;
  psi: number;
}

export interface ConfidenceData {
  id: string;
  [key: string]: string | number;
}

export type ReportType = 'accuracy' | 'anomaly' | 'precision' | 'stability' | 'unknown';

export interface ParsedReport {
  type: ReportType;
  fileName: string;
  modelInfo: ModelInfo[];
  accuracyScores?: AccuracyScore[];
  crosstabMacro?: CrosstabData;
  crosstabMicro?: CrosstabData;
  correctionCrosstab?: CrosstabData;
  psiMacro?: PSIData[];
  psiMicro?: PSIData[];
  confidenceReport?: ConfidenceData[];
}

// Identify report type from filename
export function identifyReportType(fileName: string): ReportType {
  const lower = fileName.toLowerCase();
  if (lower.includes('accuracy') || lower.includes('acc')) return 'accuracy';
  if (lower.includes('anomal') || lower.includes('anom')) return 'anomaly';
  if (lower.includes('precision') || lower.includes('prec')) return 'precision';
  if (lower.includes('stab')) return 'stability';
  return 'unknown';
}

// Compare fields that should match between benchmark and development
const COMPARABLE_FIELDS = [
  'source account type', 'value sign', 'currency', 'source code',
  'text preprocessing', 'amount preprocessing', 'classifier'
];

function parseModelInfo(sheet: WorkSheet, XLSX: any): ModelInfo[] {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (!data || data.length < 2) return [];
  
  const results: ModelInfo[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;
    const field = String(row[0]).trim();
    const benchmark = String(row[1] ?? '').trim();
    const development = String(row[2] ?? '').trim();
    const isDifferent = COMPARABLE_FIELDS.includes(field) ? benchmark !== development : false;
    results.push({ field, benchmark, development, isDifferent });
  }
  return results;
}

function parseAccuracyScores(sheet: WorkSheet, XLSX: any): AccuracyScore[] {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (!data || data.length < 2) return [];
  
  const results: AccuracyScore[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    results.push({
      bankName: String(row[0] ?? '').trim(),
      metric: String(row[1] ?? '').trim(),
      benchmark: Number(row[2]) || 0,
      development: Number(row[3]) || 0,
      delta: Number(row[4]) || 0,
    });
  }
  return results;
}

function parseCrosstab(sheet: WorkSheet, XLSX: any): CrosstabData {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (!data || data.length < 2) return { headers: [], rows: [] };
  
  const headerRow = data[0];
  // First column is row label, last might be "% of row total"
  const hasPercentCol = String(headerRow[headerRow.length - 1]).includes('%');
  const headers = headerRow.slice(1, hasPercentCol ? -1 : undefined).map(String);
  
  const rows: CrosstabData['rows'] = [];
  const lastRowIdx = data.length - 1;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const label = String(row[0] ?? '').trim();
    if (label.includes('% of column')) continue; // skip totals row
    const values = row.slice(1, hasPercentCol ? -1 : undefined).map((v: any) => Number(v) || 0);
    const rowTotal = hasPercentCol ? Number(row[row.length - 1]) || 0 : undefined;
    rows.push({ label, values, rowTotal });
  }
  
  return { headers, rows };
}

function parsePSI(sheet: WorkSheet, XLSX: any): PSIData[] {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (!data || data.length < 2) return [];
  
  const results: PSIData[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    results.push({
      bankName: String(row[0] ?? '').trim(),
      category: String(row[1] ?? '').trim(),
      freqOld: Number(row[2]) || 0,
      countOld: Number(row[3]) || 0,
      freqNew: Number(row[4]) || 0,
      countNew: Number(row[5]) || 0,
      psi: Number(row[6]) || 0,
    });
  }
  return results;
}

export async function parseReportFile(file: File): Promise<ParsedReport> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  
  const type = identifyReportType(file.name);
  const sheetNames = workbook.SheetNames;
  
  const report: ParsedReport = {
    type,
    fileName: file.name,
    modelInfo: [],
  };
  
  // Sheet 1 is always model_information
  if (sheetNames.length > 0) {
    report.modelInfo = parseModelInfo(workbook.Sheets[sheetNames[0]], XLSX);
  }
  
  if (type === 'accuracy' || type === 'anomaly') {
    // Sheet 2: accuracy_score
    if (sheetNames.length > 1) {
      report.accuracyScores = parseAccuracyScores(workbook.Sheets[sheetNames[1]], XLSX);
    }
    // Sheet 3: prediction_crosstab_macro
    if (sheetNames.length > 2) {
      report.crosstabMacro = parseCrosstab(workbook.Sheets[sheetNames[2]], XLSX);
    }
    // Sheet 4: prediction_crosstab_micro
    if (sheetNames.length > 3) {
      report.crosstabMicro = parseCrosstab(workbook.Sheets[sheetNames[3]], XLSX);
    }
    // Sheet 5: correction_crosstab_macro
    if (sheetNames.length > 4) {
      report.correctionCrosstab = parseCrosstab(workbook.Sheets[sheetNames[4]], XLSX);
    }
  } else if (type === 'precision' || type === 'stability') {
    // Sheet 2: crosstab_macro
    if (sheetNames.length > 1) {
      report.crosstabMacro = parseCrosstab(workbook.Sheets[sheetNames[1]], XLSX);
    }
    // Sheet 3: crosstab_micro
    if (sheetNames.length > 2) {
      report.crosstabMicro = parseCrosstab(workbook.Sheets[sheetNames[2]], XLSX);
    }
    // Sheet 4: psi_macro
    if (sheetNames.length > 3) {
      report.psiMacro = parsePSI(workbook.Sheets[sheetNames[3]], XLSX);
    }
    // Sheet 5: psi_micro
    if (sheetNames.length > 4) {
      report.psiMicro = parsePSI(workbook.Sheets[sheetNames[4]], XLSX);
    }
    // Sheet 6: confidence_report (just IDs)
    if (sheetNames.length > 5) {
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetNames[5]]) as ConfidenceData[];
      report.confidenceReport = data;
    }
  }
  
  return report;
}
