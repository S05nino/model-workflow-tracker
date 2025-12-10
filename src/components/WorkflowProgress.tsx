import { WorkflowStep, WORKFLOW_STEPS } from '@/types/project';
import { cn } from '@/lib/utils';
import { Check, Mail, Cog, TestTube, Upload, Send } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const STEP_ICONS: Record<WorkflowStep, React.ElementType> = {
  1: Mail,
  2: Cog,
  3: TestTube,
  4: Upload,
  5: Send,
};

interface WorkflowProgressProps {
  currentStep: WorkflowStep;
  isCompleted?: boolean;
  onStepClick?: (step: WorkflowStep) => void;
  interactive?: boolean;
}

export function WorkflowProgress({ 
  currentStep, 
  isCompleted = false,
  onStepClick,
  interactive = false 
}: WorkflowProgressProps) {
  const steps = Object.entries(WORKFLOW_STEPS) as [string, { label: string; description: string }][];

  return (
    <div className="flex items-center gap-1">
      {steps.map(([stepKey, stepInfo], index) => {
        const stepNumber = Number(stepKey) as WorkflowStep;
        const Icon = STEP_ICONS[stepNumber];
        const isActive = stepNumber === currentStep && !isCompleted;
        const isPast = stepNumber < currentStep || isCompleted;
        const isFuture = stepNumber > currentStep && !isCompleted;

        return (
          <Tooltip key={stepNumber}>
            <TooltipTrigger asChild>
              <button
                onClick={() => interactive && onStepClick?.(stepNumber)}
                disabled={!interactive}
                className={cn(
                  "relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300",
                  isPast && "bg-success text-success-foreground",
                  isActive && "bg-primary text-primary-foreground animate-pulse-subtle glow-primary",
                  isFuture && "bg-muted text-muted-foreground",
                  interactive && !isFuture && "cursor-pointer hover:scale-110",
                  !interactive && "cursor-default"
                )}
              >
                {isPast ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <p className="font-medium">{stepInfo.label}</p>
              <p className="text-xs text-muted-foreground">{stepInfo.description}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
