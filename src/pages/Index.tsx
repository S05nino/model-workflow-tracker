import { useProjectsAdapter as useProjects, useReleasesAdapter as useReleases, useCountriesAdapter as useCountries } from '@/hooks/adapters';
import { ManageCountriesDialog } from '@/components/ManageCountriesDialog';
import { ReleasesSection } from '@/components/ReleasesSection';
import { TestSuiteSection } from '@/components/TestSuiteSection';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DashboardStats } from '@/components/DashboardStats';
import { NewProjectDialog } from '@/components/NewProjectDialog';
import { NewReleaseDialog } from '@/components/NewReleaseDialog';
import { Segment } from '@/types/project';
import { Brain, Workflow, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { exportDashboardReport } from '@/lib/exportReport';
import { toast } from 'sonner';

const Index = () => {
  const { projects, addProject } = useProjects();
  const { releases, addRelease } = useReleases();
  const { countries, addCountry, removeCountry } = useCountries();

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
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  const fileName = await exportDashboardReport(projects, releases, countries);
                  toast.success('Report esportato', {
                    description: `File ${fileName} scaricato`,
                  });
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Esporta Report
              </Button>
              <ManageCountriesDialog
                countries={countries}
                onAddCountry={(country) => addCountry(country)}
                onRemoveCountry={(code) => removeCountry(code)}
              />
            </div>
          </div>
        </header>

        {/* Dashboard Stats */}
        <DashboardStats projects={projects} />

        {/* Single Tabs wrapper */}
        <Tabs defaultValue="releases" className="animate-fade-in mt-6" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="releases">Rilasci</TabsTrigger>
              <TabsTrigger value="testsuite">TestSuite</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <NewProjectDialog onAdd={(country, segment, testType) => {
                addProject(country, segment, testType);
              }} countries={countries} />
              <NewReleaseDialog onAdd={(version, targetDate, models) => {
                addRelease(version, targetDate, models);
              }} countries={countries} />
            </div>
          </div>

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
