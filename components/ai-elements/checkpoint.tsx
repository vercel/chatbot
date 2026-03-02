'use client';

import { BookmarkIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function Checkpoint() {
  return (
    <div className="flex items-center gap-3 px-4 md:px-0 md:max-w-3xl mx-auto w-full">
      <Separator className="flex-1" />
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
        <BookmarkIcon size={12} />
        <span>Context compacted</span>
      </div>
      <Separator className="flex-1" />
    </div>
  );
}
