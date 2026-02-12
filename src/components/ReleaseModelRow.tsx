import { useState } from 'react';
import { ReleaseModel, ReleaseModelIds } from '@/types/release';
import { CountryConfig, Segment, SEGMENT_LABELS, WorkflowStep, TestType, TEST_TYPE_LABELS, WORKFLOW_STEPS, getTestTypesForSegment } from '@/types/project';
import { WorkflowProgress } from './WorkflowProgress';
import { ConfirmModelDialog } from './ConfirmModelDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Plus,
  Pause,
  Play,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReleaseModelRowProps {
  model: ReleaseModel;
  countries: CountryConfig[];
  releaseCompleted: boolean;
  allConfirmed: boolean;
  onToggleInclusion: () => void;
  onConfirmModel: (modelIds: ReleaseModelIds) => void;
  onUpdateStep: (step: WorkflowStep) => void;
  onStartNewRound: (testType: TestType) => void;
  onUpdateStatus: (status: ReleaseModel['status']) => void;
}

export function ReleaseModelRow({
  model,
  countries,
  releaseCompleted,
  allConfirmed,
  onToggleInclusion,
  onConfirmModel,
  onUpdateStep,
  onStartNewRound,
  onUpdateStatus,
}: ReleaseModelRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmingModel, setConfirmingModel] = useState(false);

  const countryConfig = countries.find(c => c.code === model.country);
  const countryName = countryConfig?.name || model.country;
  const currentRound = model.rounds?.find(r => r.roundNumber === (model.currentRound || 1));
  const isRoundCompleted = currentRound?.currentStep === 3;
  const isModelCompleted = model.confirmed;
  const availableTestTypes = getTestTypesForSegment(model.segment);

  const handleAdvanceStep = () => {
    if (currentRound && currentRound.currentStep < 3) {
      onUpdateStep((currentRound.currentStep + 1) as WorkflowStep);
    }
  };

  // Collapsed view
  if (!model.included) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border opacity-50 bg-muted/30">
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">
              {countryName} <span className="text-muted-foreground font-normal">({model.country})</span>
            </p>
            <p className="text-sm text-muted-foreground">{SEGMENT_LABELS[model.segment]}</p>
          </div>
        </div>
        {!releaseCompleted && !allConfirmed && (
          <Button size="sm" variant="ghost" onClick={onToggleInclusion}>
            Includi
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className={cn(
          "rounded-lg border transition-all",
          model.confirmed && "bg-success/5 border-success/30",
          model.awaitingConfirmation && "border-warning/50",
        )}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                {model.confirmed ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                )}
                <div className="text-left">
                  <p className="font-medium text-foreground">
                    {countryName} <span className="text-muted-foreground font-normal">({model.country})</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{SEGMENT_LABELS[model.segment]}</span>
                    {currentRound && !isModelCompleted && (
                      <Badge variant="secondary" className="text-xs">
                        R{model.currentRound || 1} - {WORKFLOW_STEPS[currentRound.currentStep]?.label}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                {model.confirmed && model.modelIds && (
                  <div className="text-xs text-muted-foreground text-right mr-2 space-y-0.5 hidden md:block">
                    {model.modelIds.modelOut && <span className="block">MO: {model.modelIds.modelOut}</span>}
                    {model.modelIds.modelIn && <span className="block">MI: {model.modelIds.modelIn}</span>}
                    {model.modelIds.rulesOut && <span className="block">RO: {model.modelIds.rulesOut}</span>}
                    {model.modelIds.rulesIn && <span className="block">RI: {model.modelIds.rulesIn}</span>}
                  </div>
                )}

                {!releaseCompleted && !allConfirmed && !model.confirmed && (
                  <>
                    <Button size="sm" variant="ghost" onClick={onToggleInclusion}>
                      Escludi
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-3 pb-3 pt-0 space-y-3 border-t mx-3">
              {/* Model IDs when confirmed (mobile) */}
              {model.confirmed && model.modelIds && (
                <div className="text-xs text-muted-foreground space-y-0.5 pt-2 md:hidden">
                  {model.modelIds.modelOut && <span className="block">Model Out: {model.modelIds.modelOut}</span>}
                  {model.modelIds.modelIn && <span className="block">Model In: {model.modelIds.modelIn}</span>}
                  {model.modelIds.rulesOut && <span className="block">Rules Out: {model.modelIds.rulesOut}</span>}
                  {model.modelIds.rulesIn && <span className="block">Rules In: {model.modelIds.rulesIn}</span>}
                </div>
              )}

              {/* Workflow Progress */}
              {!isModelCompleted && currentRound && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Round {model.currentRound || 1}</span>
                      <Badge variant={currentRound.testType === 'test-suite' ? 'warning' : 'info'} className="text-xs">
                        {TEST_TYPE_LABELS[currentRound.testType]}
                      </Badge>
                    </div>
                    
                    {!releaseCompleted && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {model.status === 'in-progress' && (
                            <DropdownMenuItem onClick={() => onUpdateStatus('on-hold')}>
                              <Pause className="w-4 h-4 mr-2" />
                              Metti in pausa
                            </DropdownMenuItem>
                          )}
                          {model.status === 'on-hold' && (
                            <DropdownMenuItem onClick={() => onUpdateStatus('in-progress')}>
                              <Play className="w-4 h-4 mr-2" />
                              Riprendi
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <WorkflowProgress
                    currentStep={currentRound.currentStep}
                    isCompleted={isRoundCompleted}
                    onStepClick={onUpdateStep}
                    interactive={!releaseCompleted && model.status === 'in-progress'}
                  />

                  {!releaseCompleted && model.status === 'in-progress' && (
                    <div className="flex gap-2">
                      {!isRoundCompleted ? (
                        <Button onClick={handleAdvanceStep} className="flex-1 gap-2" size="sm">
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
                            onClick={() => setConfirmingModel(true)}
                            variant="default"
                            size="sm"
                            className="flex-1 gap-2 bg-success hover:bg-success/90"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Conferma
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {model.status === 'waiting' && model.awaitingConfirmation && (
                    <div className="flex gap-2">
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
                        onClick={() => setConfirmingModel(true)}
                        variant="default"
                        size="sm"
                        className="flex-1 gap-2 bg-success hover:bg-success/90"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Conferma
                      </Button>
                    </div>
                  )}

                  {model.status === 'on-hold' && (
                    <div className="text-center py-1 text-sm text-warning">
                      <Pause className="w-4 h-4 inline mr-1" />
                      In pausa
                    </div>
                  )}
                </div>
              )}

              {isModelCompleted && (
                <div className="flex items-center gap-2 py-2 text-success text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">Modello Confermato</span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {confirmingModel && (
        <ConfirmModelDialog
          open={confirmingModel}
          onOpenChange={setConfirmingModel}
          countryName={countryName}
          segment={SEGMENT_LABELS[model.segment]}
          onConfirm={onConfirmModel}
        />
      )}
    </>
  );
}
