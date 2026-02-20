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
      <p className="text-xs font-semibold font-ibm-plex-mono uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </p>
      <div className="space-y-2">
        {fields.map((item, i) => (
          <div key={i}>
            <p className="text-sm font-bold text-foreground">{item.field}</p>
            <p className="text-sm text-foreground">{item.value}</p>
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
            <p className="text-lg font-bold mb-3">{formName}</p>
          )}

          <div className="space-y-5">
            <SectionBlock
              label="Filled from A360"
              fields={fromDatabase}
            />
            <SectionBlock
              label="Provided by caseworker"
              fields={fromCaseworker}
            />
            <SectionBlock
              label="Inferred by AI"
              fields={inferred}
            />

            {missing && missing.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
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
