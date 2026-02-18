'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface SummaryField {
  field: string;
  value: string;
}

interface FormSummaryCardProps {
  formName?: string;
  fromDatabase: SummaryField[];
  fromCaseworker: SummaryField[];
  inferred: SummaryField[];
  missing?: string[];
  notes?: string;
  className?: string;
}

function SectionBlock({
  label,
  fields,
}: {
  label: string;
  fields: SummaryField[];
}) {
  if (fields.length === 0) return null;

  return (
    <div>
      <p className="text-sm font-ibm-plex-mono font-semibold uppercase tracking-widest text-foreground mb-3">
        {label}
      </p>
      <div className="space-y-1">
        {fields.map((item, i) => (
          <div key={i} className="flex justify-between gap-4">
            <span className="text-sm text-muted-foreground">{item.field}</span>
            <span className="text-sm font-ibm-plex-mono text-foreground text-right">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSummaryCard({
  formName,
  fromDatabase,
  fromCaseworker,
  inferred,
  missing,
  notes,
  className,
}: FormSummaryCardProps) {
  return (
    <Alert
      className={cn(
        'rounded-xl border-accent bg-background p-6',
        className,
      )}
    >
      <AlertDescription>
        <div className="font-source-serif leading-[1.5] text-foreground">
          {formName && (
            <p className="text-lg font-bold mb-1">{formName}</p>
          )}

          <div className="space-y-5">
            <SectionBlock
              label="Filled from database"
              fields={fromDatabase}
            />
            <SectionBlock
              label="Provided by caseworker"
              fields={fromCaseworker}
            />
            <SectionBlock
              label="Inferred by agent"
              fields={inferred}
            />

            {missing && missing.length > 0 && (
              <div>
                <p className="text-sm font-ibm-plex-mono font-semibold uppercase tracking-widest text-foreground mb-3">
                  Could not be filled
                </p>
                <div className="space-y-1">
                  {missing.map((item, i) => (
                    <p key={i} className="text-sm text-muted-foreground">{item}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {notes && (
            <p className="text-sm text-muted-foreground italic mt-5">
              {notes}
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
