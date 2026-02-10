import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, FlaskConical } from "lucide-react";
import { toast } from "sonner";

const STREAMLIT_URL = "http://localhost:8501";

export const TestSuiteSection = () => {
  const handleOpen = () => {
    window.open(STREAMLIT_URL, "_blank");
    toast.info("Apertura TestSuite", {
      description: "Assicurati che Streamlit sia in esecuzione: streamlit run dashboard.py",
    });
  };

  return (
    <div className="flex items-center justify-center py-16">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto p-3 rounded-xl bg-primary/10 w-fit mb-2">
            <FlaskConical className="w-8 h-8 text-primary" />
          </div>
          <CardTitle>Test Suite Dashboard</CardTitle>
          <CardDescription>
            Avvia la dashboard Streamlit per eseguire i test ML
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleOpen} size="lg" className="w-full">
            <ExternalLink className="w-4 h-4 mr-2" />
            Apri TestSuite
          </Button>
          <p className="text-xs text-muted-foreground">
            Esegui prima: <code className="bg-muted px-1 py-0.5 rounded">streamlit run dashboard.py</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
