import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

function Spinner({ className, ...props }: React.ComponentProps<typeof Loader2>) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn('size-4 animate-spin text-custom-purple', className)}
      {...props}
    />
  );
}

export { Spinner };

