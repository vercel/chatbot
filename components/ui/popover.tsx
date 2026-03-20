"use client";

import { Popover } from "radix-ui";
import { cn } from "@/lib/utils";

function PopoverRoot({ ...props }: React.ComponentProps<typeof Popover.Root>) {
  return <Popover.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof Popover.Trigger>) {
  return <Popover.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverAnchor({ ...props }: React.ComponentProps<typeof Popover.Anchor>) {
  return <Popover.Anchor data-slot="popover-anchor" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof Popover.Content>) {
  return (
    <Popover.Portal>
      <Popover.Content
        align={align}
        className={cn(
          "z-50 w-72 rounded-xl border border-border/60 bg-card/95 p-4 shadow-[var(--shadow-float)] backdrop-blur-xl outline-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        data-slot="popover-content"
        sideOffset={sideOffset}
        {...props}
      />
    </Popover.Portal>
  );
}

export { PopoverRoot as Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
