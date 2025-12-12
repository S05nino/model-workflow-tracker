import { Project, CountryConfig, SEGMENT_LABELS, TEST_TYPE_LABELS, WORKFLOW_STEPS } from "@/types/project";
import { Release } from "@/types/release";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    waiting: "In Attesa",
    "in-progress": "In Corso",
    completed: "Completato",
    "on-hold": "In Pausa",
  };
  return labels[status] || status;
};

export async function exportDashboardReport(projects: Project[], releases: Release[], countries: CountryConfig[]) {
  const getCountryName = (code: string) => countries.find((c) => c.code === code)?.name || code;
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const reportDate = format(new Date(), "dd/MM/yyyy HH:mm", { locale: it });

  // === SHEET 1: Summary ===
  const summaryData = [
    ["ML Workflow Tracker - Report Completo"],
    [`Generato il: ${reportDate}`],
    [],
    ["RIEPILOGO PROGETTI"],
    ["Totale Progetti", projects.length],
    ["In Corso", projects.filter((p) => p.status === "in-progress").length],
    ["In Attesa", projects.filter((p) => p.status === "waiting").length],
    ["In Pausa", projects.filter((p) => p.status === "on-hold").length],
    ["Completati", projects.filter((p) => p.status === "completed").length],
    [],
    ["RIEPILOGO RILASCI"],
    ["Totale Rilasci", releases.length],
    ["Rilasci Attivi", releases.filter((r) => !r.completed).length],
    ["Rilasci Completati", releases.filter((r) => r.completed).length],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 25 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Riepilogo");

  // === SHEET 2: Active Projects ===
  const activeProjects = projects.filter((p) => p.status !== "completed");
  const activeProjectsData = [
    ["PROGETTI IN CORSO"],
    [],
    ["Paese", "Segmento", "Tipo Test", "Step Attuale", "Round", "Stato", "In Attesa Conferma", "Ultimo Aggiornamento"],
    ...activeProjects.map((p) => {
      const currentRound = p.rounds[p.rounds.length - 1];
      return [
        getCountryName(p.country),
        SEGMENT_LABELS[p.segment],
        currentRound ? TEST_TYPE_LABELS[currentRound.testType] : "-",
        currentRound ? `${currentRound.currentStep} - ${WORKFLOW_STEPS[currentRound.currentStep].label}` : "-",
        p.currentRound,
        getStatusLabel(p.status),
        p.awaitingConfirmation ? "Sì" : "No",
        format(new Date(p.updatedAt), "dd/MM/yyyy HH:mm", { locale: it }),
      ];
    }),
  ];

  const activeProjectsSheet = XLSX.utils.aoa_to_sheet(activeProjectsData);
  activeProjectsSheet["!cols"] = [
    { wch: 15 },
    { wch: 12 },
    { wch: 15 },
    { wch: 25 },
    { wch: 8 },
    { wch: 12 },
    { wch: 18 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(workbook, activeProjectsSheet, "Progetti Attivi");

  // === SHEET 3: Completed Projects ===
  const completedProjects = projects.filter((p) => p.status === "completed");
  const completedProjectsData = [
    ["PROGETTI COMPLETATI"],
    [],
    ["Paese", "Segmento", "Round Totali", "Data Conferma", "Data Creazione"],
    ...completedProjects.map((p) => [
      getCountryName(p.country),
      SEGMENT_LABELS[p.segment],
      p.currentRound,
      p.confirmedAt ? format(new Date(p.confirmedAt), "dd/MM/yyyy HH:mm", { locale: it }) : "-",
      format(new Date(p.createdAt), "dd/MM/yyyy", { locale: it }),
    ]),
  ];

  const completedProjectsSheet = XLSX.utils.aoa_to_sheet(completedProjectsData);
  completedProjectsSheet["!cols"] = [{ wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, completedProjectsSheet, "Progetti Completati");

  // === SHEET 4: Active Releases ===
  const activeReleases = releases
    .filter((r) => !r.completed)
    .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());

  const activeReleasesData: (string | number)[][] = [["RILASCI ATTIVI"], []];

  activeReleases.forEach((release) => {
    const includedModels = release.models.filter((m) => m.included);
    const confirmedCount = includedModels.filter((m) => m.confirmed).length;

    activeReleasesData.push([`Versione: ${release.version}`, `Scadenza: ${format(new Date(release.targetDate), "dd/MM/yyyy", { locale: it })}`, `Progresso: ${confirmedCount}/${includedModels.length}`]);
    activeReleasesData.push(["Paese", "Segmento", "Incluso", "Confermato", "Model Out", "Model In", "Rules Out", "Rules In"]);

    release.models.forEach((m) => {
      activeReleasesData.push([
        getCountryName(m.country),
        SEGMENT_LABELS[m.segment],
        m.included ? "Sì" : "No",
        m.confirmed ? "Sì" : "No",
        m.modelIds?.modelOut || "-",
        m.modelIds?.modelIn || "-",
        m.modelIds?.rulesOut || "-",
        m.modelIds?.rulesIn || "-",
      ]);
    });

    activeReleasesData.push([]);
  });

  const activeReleasesSheet = XLSX.utils.aoa_to_sheet(activeReleasesData);
  activeReleasesSheet["!cols"] = [
    { wch: 15 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(workbook, activeReleasesSheet, "Rilasci Attivi");

  // === SHEET 5: Completed Releases ===
  const completedReleases = releases.filter((r) => r.completed);
  const completedReleasesData: (string | number)[][] = [["RILASCI COMPLETATI"], []];

  completedReleases.forEach((release) => {
    completedReleasesData.push([`Versione: ${release.version}`, `Data Target: ${format(new Date(release.targetDate), "dd/MM/yyyy", { locale: it })}`]);
    completedReleasesData.push(["Paese", "Segmento", "Model Out", "Model In", "Rules Out", "Rules In"]);

    release.models
      .filter((m) => m.included && m.confirmed)
      .forEach((m) => {
        completedReleasesData.push([
          getCountryName(m.country),
          SEGMENT_LABELS[m.segment],
          m.modelIds?.modelOut || "-",
          m.modelIds?.modelIn || "-",
          m.modelIds?.rulesOut || "-",
          m.modelIds?.rulesIn || "-",
        ]);
      });

    completedReleasesData.push([]);
  });

  const completedReleasesSheet = XLSX.utils.aoa_to_sheet(completedReleasesData);
  completedReleasesSheet["!cols"] = [{ wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, completedReleasesSheet, "Rilasci Completati");

  // Generate filename with date
  const fileName = `ML_Workflow_Report_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;

  // Download the file
  XLSX.writeFile(workbook, fileName);

  return fileName;
}
