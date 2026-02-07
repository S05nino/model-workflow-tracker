import { useReleasesAdapter as useReleases, useCountriesAdapter as useCountries } from '@/hooks/adapters';
import { DashboardStats } from '@/components/DashboardStats';
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

  // Convert releases to projects format for stats and export
  const projects = releases.flatMap(r => 
    r.models.map(m => ({
      id: m.id,
      country: m.country,
      segment: m.segment,
      status: m.status,
      currentRound: m.currentRound,
      rounds: m.rounds,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      confirmedAt: m.confirmedAt,
      awaitingConfirmation: m.status === 'waiting',
    }))
  );

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

        {/* Tabs for Releases and TestSuite */}
        <Tabs defaultValue="releases" className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <TabsList className="mb-6">
            <TabsTrigger value="releases">Rilasci</TabsTrigger>
            <TabsTrigger value="testsuite">TestSuite</TabsTrigger>
          </TabsList>

          <TabsContent value="releases">
            <ReleasesSection />
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
