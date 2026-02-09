import { Project, WorkflowStep, TestType, CountryConfig, SEGMENT_LABELS, TEST_TYPE_LABELS, WORKFLOW_STEPS, getTestTypesForSegment } from '@/types/project';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { WorkflowProgress } from './WorkflowProgress';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  MoreVertical, 
  Plus, 
  CheckCircle2, 
  ChevronRight,
  Globe,
  Calendar,
  RefreshCw,
  Trash2,
  Pause,
  Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

interface ProjectCardProps {
  project: Project;
  countries: CountryConfig[];
  onUpdateStep: (step: WorkflowStep) => void;
  onStartNewRound: (testType: TestType) => void;
  onConfirm: () => void;
  onUpdateStatus: (status: Project['status']) => void;
  onDelete: () => void;
}

export function ProjectCard({
  project,
  countries,
  onUpdateStep,
  onStartNewRound,
  onConfirm,
  onUpdateStatus,
  onDelete,
}: ProjectCardProps) {
  const currentRoundData = project.rounds.find(r => r.roundNumber === project.currentRound);
  const isRoundCompleted = currentRoundData?.currentStep === 5;
  const isProjectCompleted = project.status === 'completed';
  
  const countryConfig = countries.find(c => c.code === project.country);
  const countryName = countryConfig?.name || project.country;
  const availableTestTypes = getTestTypesForSegment(project.segment);
  const currentStepLabel = currentRoundData ? WORKFLOW_STEPS[currentRoundData.currentStep]?.label : '';

  const handleAdvanceStep = () => {
    if (currentRoundData && currentRoundData.currentStep < 5) {
      onUpdateStep((currentRoundData.currentStep + 1) as WorkflowStep);
    }
  };

  return (
    <Card className={cn(
      "glass-card animate-slide-up transition-all duration-300 hover:shadow-xl",
      isProjectCompleted && "opacity-75"
    )}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-lg text-foreground">{countryName}</h3>
            <span className="font-mono text-xs text-muted-foreground">({project.country})</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {SEGMENT_LABELS[project.segment]}
            </Badge>
            {project.awaitingConfirmation ? (
              <Badge variant="warning" className="text-xs">
                In attesa di conferma
              </Badge>
            ) : currentRoundData && !isProjectCompleted && (
              <Badge variant="secondary" className="text-xs">
                {currentStepLabel}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={project.status} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {project.status === 'in-progress' && (
                <DropdownMenuItem onClick={() => onUpdateStatus('on-hold')}>
                  <Pause className="w-4 h-4 mr-2" />
                  Metti in pausa
                </DropdownMenuItem>
              )}
              {project.status === 'on-hold' && (
                <DropdownMenuItem onClick={() => onUpdateStatus('in-progress')}>
                  <Play className="w-4 h-4 mr-2" />
                  Riprendi
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Elimina
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Round {project.currentRound}
            </span>
            {currentRoundData && (
              <Badge variant={currentRoundData.testType === 'test-suite' ? 'warning' : 'info'}>
                {TEST_TYPE_LABELS[currentRoundData.testType]}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true, locale: it })}
          </div>
        </div>

        <div className="py-2">
          <WorkflowProgress 
            currentStep={currentRoundData?.currentStep || 1}
            isCompleted={isRoundCompleted}
            onStepClick={onUpdateStep}
            interactive={!isProjectCompleted && project.status === 'in-progress'}
          />
        </div>

        {!isProjectCompleted && project.status === 'in-progress' && (
          <div className="flex gap-2 pt-2">
            {!isRoundCompleted ? (
              <Button 
                onClick={handleAdvanceStep}
                className="flex-1 gap-2"
                size="sm"
              >
                Prossimo Step
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 gap-2">
                      <Plus className="w-4 h-4" />
                      Nuovo Round
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {availableTestTypes.map((tt) => (
                      <DropdownMenuItem key={tt} onClick={() => onStartNewRound(tt)}>
                        {TEST_TYPE_LABELS[tt]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button 
                  onClick={onConfirm}
                  variant="default"
                  size="sm"
                  className="flex-1 gap-2 bg-success hover:bg-success/90"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Conferma Modello
                </Button>
              </>
            )}
          </div>
        )}

        {project.status === 'waiting' && project.awaitingConfirmation && (
          <div className="flex gap-2 pt-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 gap-2">
                  <Plus className="w-4 h-4" />
                  Nuovo Round
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {availableTestTypes.map((tt) => (
                  <DropdownMenuItem key={tt} onClick={() => onStartNewRound(tt)}>
                    {TEST_TYPE_LABELS[tt]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              onClick={onConfirm}
              variant="default"
              size="sm"
              className="flex-1 gap-2 bg-success hover:bg-success/90"
            >
              <CheckCircle2 className="w-4 h-4" />
              Conferma Modello
            </Button>
          </div>
        )}

        {isProjectCompleted && (
          <div className="flex items-center justify-center gap-2 py-2 text-success">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Modello Confermato</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
