import type React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SignOutButton } from '@clerk/nextjs';

type OnboardingFormLayoutProps = {
  children: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  currentStep: number;
  totalSteps: number;
  onNext?: () => void;
  onBack?: () => void;
  isLastStep?: boolean;
  isNextDisabled?: boolean;
};

export function OnboardingFormLayout({
  children,
  title,
  description,
  currentStep,
  totalSteps,
  onNext,
  onBack,
  isLastStep,
  isNextDisabled,
}: OnboardingFormLayoutProps) {
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round(((currentStep + 1) / totalSteps) * 100)),
  );

  return (
    <div className="container mx-auto px-4 md:px-8 py-8 flex items-center">
      <Card className="mx-auto w-full max-w-7xl rounded-3xl p-0 shadow-lg overflow-hidden">
        <div className="grid min-h-[calc(100dvh-5rem)] rounded-3xl overflow-hidden lg:grid-cols-2">
          <div className="relative hidden flex-col justify-center gap-6 bg-gradient-to-br from-primary/15 via-secondary/20 to-accent/20 p-8 lg:flex xl:p-10">
            <div className="relative z-10 max-w-md">
              <div className="text-sm font-medium text-muted-foreground">
                Step {currentStep + 1} of {totalSteps}
              </div>
              {title && (
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-3 text-base text-muted-foreground">
                  {description}
                </p>
              )}
              <div className="mt-6 h-2 w-full rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <div className="relative z-10 mt-auto flex items-center gap-2">
              <SignOutButton>
                <Button variant="outline">Sign out</Button>
              </SignOutButton>
            </div>
            <div className="pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(60%_60%_at_30%_30%,black,transparent_70%)]">
              <div className="absolute -left-10 -top-10 size-40 rounded-full bg-primary/20 blur-3xl" />
              <div className="absolute -right-10 bottom-0 size-48 rounded-full bg-secondary/30 blur-3xl" />
            </div>
          </div>

          <div className="bg-card p-6 sm:p-8 xl:p-10 flex flex-col justify-center">
            <div className="lg:hidden">
              <div className="h-1 w-full rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {(title || description) && (
                <div className="pt-4">
                  {title && (
                    <div className="text-2xl font-bold text-foreground">
                      {title}
                    </div>
                  )}
                  {description && (
                    <p className="text-muted-foreground">{description}</p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 space-y-6 lg:mt-0">{children}</div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onBack}
                disabled={currentStep === 0}
              >
                Back
              </Button>
              <Button
                onClick={onNext}
                type={isLastStep ? 'submit' : 'button'}
                size="lg"
                disabled={!!isNextDisabled}
              >
                {isLastStep ? 'Submit' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
