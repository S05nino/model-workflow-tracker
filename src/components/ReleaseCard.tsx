import { useState } from 'react';
import { Release, ReleaseModel, ReleaseModelIds } from '@/types/release';
import { CountryConfig, Segment, SEGMENT_LABELS, TestType, TEST_TYPE_LABELS, WorkflowStep, WORKFLOW_STEPS, getTestTypesForSegment } from '@/types/project';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmModelDialog } from './ConfirmModelDialog';
import { AddModelToReleaseDialog } from './AddModelToReleaseDialog';
import { EditReleaseDateDialog } from './EditReleaseDateDialog';
import { WorkflowProgress } from './WorkflowProgress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Calendar, 
  Package, 
  MoreVertical, 
  Trash2, 
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Check,
  CalendarDays,
  Plus,
  RefreshCw,
  Pause,
  Play,
} from 'lucide-react';
import { format, parseISO, isPast, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ReleaseCardProps {
  release: Release;
  countries: CountryConfig[];
  onToggleInclusion: (modelId: string) => void;
  onConfirmModel: (modelId: string, modelIds: ReleaseModelIds) => void;
  onAddModel: (country: string, segment: Segment) => void;
  onUpdateDate: (newDate: string) => void;
  onDelete: () => void;
  onComplete: () => void;
  onUpdateModelStep: (modelId: string, step: WorkflowStep) => void;
  onStartNewRound: (modelId: string, testType: TestType) => void;
  onUpdateModelStatus: (modelId: string, status: ReleaseModel['status']) => void;
}

export function ReleaseCard({
  release,
  countries,
  onToggleInclusion,
  onConfirmModel,
  onAddModel,
  onUpdateDate,
  onDelete,
  onComplete,
  onUpdateModelStep,
  onStartNewRound,
  onUpdateModelStatus,
}: ReleaseCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmingModel, setConfirmingModel] = useState<{
    id: string;
    country: string;
    segment: string;
  } | null>(null);
  const [editingDate, setEditingDate] = useState(false);

  const targetDate = parseISO(release.targetDate);
  const isOverdue = isPast(targetDate) && !release.completed;
  const daysRemaining = differenceInDays(targetDate, new Date());

  const includedModels = release.models.filter(m => m.included);
  const confirmedCount = includedModels.filter(m => m.confirmed).length;
  const allConfirmed = confirmedCount === includedModels.length && includedModels.length > 0;

  const getCountryName = (code: string) => {
    return countries.find(c => c.code === code)?.name || code;
  };

  const getCurrentRoundData = (model: ReleaseModel) => {
    return model.rounds?.find(r => r.roundNumber === model.currentRound);
  };

  const isRoundCompleted = (model: ReleaseModel) => {
    const currentRound = getCurrentRoundData(model);
    return currentRound?.currentStep === 5;
  };

  const handleAdvanceStep = (model: ReleaseModel) => {
    const currentRound = getCurrentRoundData(model);
    if (currentRound && currentRound.currentStep < 5) {
      onUpdateModelStep(model.id, (currentRound.currentStep + 1) as WorkflowStep);
    }
  };

  return (
    <>
      <Card className={cn(
        "glass-card transition-all duration-300",
        release.completed && "opacity-75",
        isOverdue && "border-destructive/50"
      )}>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <CollapsibleTrigger className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-lg text-foreground">v{release.version}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {format(targetDate, 'dd MMM yyyy', { locale: it })}
                    {!release.completed && (
                      <span className={cn(
                        "text-xs",
                        isOverdue ? "text-destructive" : daysRemaining <= 3 ? "text-warning" : ""
                      )}>
                        ({isOverdue ? 'Scaduto' : `${daysRemaining} giorni`})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>

            <div className="flex items-center gap-2">
              <Badge variant={release.completed ? 'success' : allConfirmed ? 'warning' : 'secondary'}>
                {release.completed ? 'Completato' : `${confirmedCount}/${includedModels.length}`}
              </Badge>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!release.completed && (
                    <DropdownMenuItem onClick={() => setEditingDate(true)}>
                      <CalendarDays className="w-4 h-4 mr-2" />
                      Modifica Data
                    </DropdownMenuItem>
                  )}
                  {allConfirmed && !release.completed && (
                    <DropdownMenuItem onClick={onComplete}>
                      <Check className="w-4 h-4 mr-2" />
                      Completa Rilascio
                    </DropdownMenuItem>
                  )}
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

          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {release.models.map((model) => {
                  const countryName = getCountryName(model.country);
                  const currentRound = getCurrentRoundData(model);
                  const roundCompleted = isRoundCompleted(model);
                  const availableTestTypes = getTestTypesForSegment(model.segment);
                  const isModelCompleted = model.confirmed;
                  
                  return (
                    <div
                      key={model.id}
                      className={cn(
                        "p-4 rounded-lg border space-y-3",
                        !model.included && "opacity-50 bg-muted/30",
                        model.confirmed && "bg-success/10 border-success/30"
                      )}
                    >
                      {/* Header row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {model.confirmed ? (
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          ) : model.included ? (
                            <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                          ) : (
                            <XCircle className="w-5 h-5 text-muted-foreground" />
                          )}
                          
                          <div>
                            <p className="font-medium text-foreground">
                              {countryName} <span className="text-muted-foreground font-normal">({model.country})</span>
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-muted-foreground">
                                {SEGMENT_LABELS[model.segment]}
                              </span>
                              {currentRound && !isModelCompleted && (
                                <>
                                  <Badge variant="outline" className="text-xs">
                                    Round {model.currentRound}
                                  </Badge>
                                  <Badge variant={currentRound.testType === 'test-suite' ? 'warning' : 'info'} className="text-xs">
                                    {TEST_TYPE_LABELS[currentRound.testType]}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status dropdown for active models */}
                        {!release.completed && model.included && !model.confirmed && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {model.status === 'in-progress' && (
                                <DropdownMenuItem onClick={() => onUpdateModelStatus(model.id, 'on-hold')}>
                                  <Pause className="w-4 h-4 mr-2" />
                                  Metti in pausa
                                </DropdownMenuItem>
                              )}
                              {model.status === 'on-hold' && (
                                <DropdownMenuItem onClick={() => onUpdateModelStatus(model.id, 'in-progress')}>
                                  <Play className="w-4 h-4 mr-2" />
                                  Riprendi
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onToggleInclusion(model.id)}>
                                <XCircle className="w-4 h-4 mr-2" />
                                {model.included ? 'Escludi' : 'Includi'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      {/* Workflow progress */}
                      {model.included && !model.confirmed && currentRound && (
                        <div className="py-2">
                          <WorkflowProgress 
                            currentStep={currentRound.currentStep}
                            isCompleted={roundCompleted}
                            onStepClick={(step) => onUpdateModelStep(model.id, step)}
                            interactive={model.status === 'in-progress'}
                          />
                        </div>
                      )}

                      {/* Action buttons */}
                      {!release.completed && model.included && !model.confirmed && model.status === 'in-progress' && (
                        <div className="flex gap-2 pt-2">
                          {!roundCompleted ? (
                            <Button 
                              onClick={() => handleAdvanceStep(model)}
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
                                    <DropdownMenuItem key={tt} onClick={() => onStartNewRound(model.id, tt)}>
                                      {TEST_TYPE_LABELS[tt]}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Button 
                                onClick={() => setConfirmingModel({
                                  id: model.id,
                                  country: countryName,
                                  segment: SEGMENT_LABELS[model.segment],
                                })}
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

                      {/* Waiting confirmation state */}
                      {!release.completed && model.included && !model.confirmed && model.status === 'waiting' && roundCompleted && (
                        <div className="flex gap-2 pt-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="flex-1 gap-2">
                                <RefreshCw className="w-4 h-4" />
                                Nuovo Round
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {availableTestTypes.map((tt) => (
                                <DropdownMenuItem key={tt} onClick={() => onStartNewRound(model.id, tt)}>
                                  {TEST_TYPE_LABELS[tt]}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button 
                            onClick={() => setConfirmingModel({
                              id: model.id,
                              country: countryName,
                              segment: SEGMENT_LABELS[model.segment],
                            })}
                            variant="default"
                            size="sm"
                            className="flex-1 gap-2 bg-success hover:bg-success/90"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Conferma Modello
                          </Button>
                        </div>
                      )}

                      {/* On hold state */}
                      {model.status === 'on-hold' && !model.confirmed && (
                        <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
                          <Pause className="w-4 h-4" />
                          <span className="text-sm">In pausa</span>
                        </div>
                      )}

                      {/* Confirmed model info */}
                      {model.confirmed && model.modelIds && (
                        <div className="text-xs text-muted-foreground space-y-0.5 pt-2 border-t">
                          {model.modelIds.modelOut && <span className="block">Model Out: {model.modelIds.modelOut}</span>}
                          {model.modelIds.modelIn && <span className="block">Model In: {model.modelIds.modelIn}</span>}
                          {model.modelIds.rulesOut && <span className="block">Rules Out: {model.modelIds.rulesOut}</span>}
                          {model.modelIds.rulesIn && <span className="block">Rules In: {model.modelIds.rulesIn}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {!release.completed && !allConfirmed && (
                <div className="mt-4 pt-4 border-t">
                  <AddModelToReleaseDialog
                    existingModels={release.models}
                    countries={countries}
                    onAdd={onAddModel}
                  />
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {confirmingModel && (
        <ConfirmModelDialog
          open={!!confirmingModel}
          onOpenChange={(open) => !open && setConfirmingModel(null)}
          countryName={confirmingModel.country}
          segment={confirmingModel.segment}
          onConfirm={(modelIds) => onConfirmModel(confirmingModel.id, modelIds)}
        />
      )}

      <EditReleaseDateDialog
        open={editingDate}
        onOpenChange={setEditingDate}
        currentDate={release.targetDate}
        version={release.version}
        onSave={onUpdateDate}
      />
    </>
  );
}
