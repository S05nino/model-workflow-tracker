import { useState } from 'react';
import { Release, ReleaseModelIds } from '@/types/release';
import { CountryConfig, Segment, WorkflowStep, TestType } from '@/types/project';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReleaseModelRow } from './ReleaseModelRow';
import { AddModelToReleaseDialog } from './AddModelToReleaseDialog';
import { EditReleaseDateDialog } from './EditReleaseDateDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  Check,
  CalendarDays,
  ChevronDown,
  ChevronRight,
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
  onStartModelNewRound: (modelId: string, testType: TestType) => void;
  onUpdateModelStatus: (modelId: string, status: string) => void;
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
  onStartModelNewRound,
  onUpdateModelStatus,
}: ReleaseCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingDate, setEditingDate] = useState(false);

  const targetDate = parseISO(release.targetDate);
  const isOverdue = isPast(targetDate) && !release.completed;
  const daysRemaining = differenceInDays(targetDate, new Date());

  const includedModels = release.models.filter(m => m.included);
  const confirmedCount = includedModels.filter(m => m.confirmed).length;
  const allConfirmed = confirmedCount === includedModels.length && includedModels.length > 0;

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
              <div className="space-y-2">
                {release.models.filter(m => m.included).map((model) => (
                  <ReleaseModelRow
                    key={model.id}
                    model={model}
                    countries={countries}
                    releaseCompleted={release.completed}
                    allConfirmed={allConfirmed}
                    onToggleInclusion={() => onToggleInclusion(model.id)}
                    onConfirmModel={(modelIds) => onConfirmModel(model.id, modelIds)}
                    onUpdateStep={(step) => onUpdateModelStep(model.id, step)}
                    onStartNewRound={(testType) => onStartModelNewRound(model.id, testType)}
                    onUpdateStatus={(status) => onUpdateModelStatus(model.id, status as string)}
                  />
                ))}
                {/* Excluded models shown at bottom */}
                {release.models.filter(m => !m.included).map((model) => (
                  <ReleaseModelRow
                    key={model.id}
                    model={model}
                    countries={countries}
                    releaseCompleted={release.completed}
                    allConfirmed={allConfirmed}
                    onToggleInclusion={() => onToggleInclusion(model.id)}
                    onConfirmModel={(modelIds) => onConfirmModel(model.id, modelIds)}
                    onUpdateStep={(step) => onUpdateModelStep(model.id, step)}
                    onStartNewRound={(testType) => onStartModelNewRound(model.id, testType)}
                    onUpdateStatus={(status) => onUpdateModelStatus(model.id, status as string)}
                  />
                ))}
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
