'use client';

import { ChevronDown, ChevronUp, CircleCheck } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './collapsible';

import { Button } from './button';
import { useState } from 'react';

interface CollapsibleWrapperProps {
  displayName: string;
  input?: any;
  output?: any;
  isError?: boolean;
  className?: string;
  icon?: React.ComponentType<any>;
}

export function CollapsibleWrapper({ 
  displayName, 
  input, 
  output, 
  isError = false,
  className,
  icon: Icon
}: CollapsibleWrapperProps) {
  const [open, setOpen] = useState(false);
  
  const baseClassName = isError ? "border-0 rounded-md" : "border-0 rounded-md";
  const finalClassName = className ? `${baseClassName} ${className}` : baseClassName;
  
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={finalClassName}>
      <div className="flex items-center justify-between p-3">
        <div className={`text-[10px] leading-[150%] font-ibm-plex-mono text-muted-foreground flex items-center gap-2 ${isError ? 'text-red-600' : ''}`}>
          {Icon && (
            <Icon size={12} className="text-gray-500 flex-shrink-0" />
          )}
          {displayName}
          {isError && ' (Error)'}
          
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="p-1 h-auto text-muted-foreground hover:text-primary hover:bg-accent">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="sr-only">Toggle details</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="px-3 pb-3">
        <div className="border-t pt-3">
          {input && !isError && (
            <>
              <div className="text-xs text-muted-foreground mb-2">Input:</div>
              <pre className="text-[10px] bg-gray-50 dark:bg-gray-900 p-1 rounded whitespace-pre-wrap break-words overflow-x-auto mb-3">
                {JSON.stringify(input, null, 1)}
              </pre>
            </>
          )}
          {isError && output && 'error' in output ? (
            <>
              <div className="text-xs text-muted-foreground mb-2">Error:</div>
              <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded">
                {String(output.error)}
              </div>
            </>
          ) : output ? (
            <>
              <div className="text-xs text-muted-foreground mb-2">Result:</div>
              <pre className="text-[10px] bg-gray-50 dark:bg-gray-900 p-1 rounded whitespace-pre-wrap break-words overflow-x-auto">
                {JSON.stringify(output, null, 1)}
              </pre>
            </>
          ) : (
            <>
              <div className="text-xs text-muted-foreground mb-2">Input:</div>
              <pre className="text-[10px] bg-gray-50 dark:bg-gray-900 p-1 rounded whitespace-pre-wrap break-words overflow-x-auto">
                {input ? JSON.stringify(input, null, 1) : 'No input data'}
              </pre>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
