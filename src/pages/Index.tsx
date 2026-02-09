import { useState } from 'react';
import { useReleasesAdapter as useReleases, useCountriesAdapter as useCountries, useProjectsAdapter as useProjects } from '@/hooks/adapters';
import { DashboardStats } from '@/components/DashboardStats';
import { ProjectsSection } from '@/components/ProjectsSection';
import { ReleasesSection } from '@/components/ReleasesSection';
import { TestSuiteSection } from '@/components/TestSuiteSection';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Brain, Workflow, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { exportDashboardReport } from '@/lib/exportReport';

const Index = () => {
  const { releases } = useReleases();
  const { countries } = useCountries();
  const projectsHook = useProjects();
  const projects = projectsHook.projects;

  // State for active tab - to enable navigation from Projects to Releases
  const [activeTab, setActiveTab] = useState('progetti');
  const [targetReleaseId, setTargetReleaseId] = useState<string | null>(null);

  // Handle navigation from ProjectsSection to ReleasesSection
  const handleNavigateToRelease = (releaseId: string) => {
    setTargetReleaseId(releaseId);
    setActiveTab('releases');
    toast.info('Naviga al Rilascio', {
      description: 'Apri la scheda del rilascio per completare la conferma',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-8 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10 glow-primary">
                <Brain className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  ML Workflow Tracker
                </h1>
                <p className="text-muted-foreground flex items-center gap-2">
                  <Workflow className="w-4 h-4" />
                  Gestione fine-tuning modelli
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                const fileName = await exportDashboardReport(projects as any, releases, countries);
                toast.success('Report esportato', {
                  description: `File ${fileName} scaricato`,
                });
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Esporta Report
            </Button>
          </div>
        </header>

        {/* Stats */}
        <section className="mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <DashboardStats projects={projects as any} />
        </section>

        {/* Tabs for Projects, Releases, and TestSuite */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <TabsList className="mb-6">
            <TabsTrigger value="progetti">Progetti</TabsTrigger>
            <TabsTrigger value="releases">Rilasci</TabsTrigger>
            <TabsTrigger value="testsuite">TestSuite</TabsTrigger>
          </TabsList>

          <TabsContent value="progetti">
            <ErrorBoundary fallbackTitle="Errore nei Progetti">
              <ProjectsSection onNavigateToRelease={handleNavigateToRelease} />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="releases">
            <ReleasesSection targetReleaseId={targetReleaseId} />
          </TabsContent>

          <TabsContent value="testsuite">
            <ErrorBoundary fallbackTitle="Errore nella TestSuite">
              <TestSuiteSection />
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
