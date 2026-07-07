"use client";

import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import { cn } from "@/lib/utils";
import {
  CheckCircleFillIcon,
  ChevronDownIcon,
  GlobeIcon,
  LockIcon,
} from "./icons";

export type VisibilityType = "private" | "public";

const visibilities: Array<{
  id: VisibilityType;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    description: "Only you can access this chat",
    icon: <LockIcon />,
    id: "private",
    label: "Private",
  },
  {
    description: "Anyone with the link can access this chat",
    icon: <GlobeIcon />,
    id: "public",
    label: "Public",
  },
];

function VisibilitySelectorItem({
  setOpen,
  setVisibilityType,
  visibility,
  visibilityType,
}: {
  setOpen: Dispatch<SetStateAction<boolean>>;
  setVisibilityType: (visibilityType: VisibilityType) => void;
  visibility: (typeof visibilities)[number];
  visibilityType: VisibilityType;
}) {
  const handleSelect = useCallback(() => {
    setVisibilityType(visibility.id);
    setOpen(false);
  }, [setOpen, setVisibilityType, visibility.id]);

  return (
    <DropdownMenuItem
      className="group/item flex flex-row items-center justify-between gap-4"
      data-active={visibility.id === visibilityType}
      data-testid={`visibility-selector-item-${visibility.id}`}
      onSelect={handleSelect}
    >
      <div className="flex flex-col items-start gap-1">
        {visibility.label}
        {visibility.description ? (
          <div className="text-muted-foreground text-xs">
            {visibility.description}
          </div>
        ) : null}
      </div>
      <div className="text-foreground opacity-0 group-data-[active=true]/item:opacity-100 dark:text-foreground">
        <CheckCircleFillIcon />
      </div>
    </DropdownMenuItem>
  );
}

export function VisibilitySelector({
  chatId,
  className,
  selectedVisibilityType,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);

  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId,
    initialVisibilityType: selectedVisibilityType,
  });

  const selectedVisibility = useMemo(
    () => visibilities.find((visibility) => visibility.id === visibilityType),
    [visibilityType]
  );

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          "w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
          className
        )}
      >
        <Button
          className="gap-1.5 rounded-lg border-border/50 text-muted-foreground shadow-none transition-colors hover:text-foreground focus-visible:ring-0 focus-visible:border-border/50 active:translate-y-0"
          data-testid="visibility-selector"
          size="sm"
          variant="outline"
        >
          {selectedVisibility?.icon}
          <span className="md:sr-only">{selectedVisibility?.label}</span>
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[300px]">
        {visibilities.map((visibility) => (
          <VisibilitySelectorItem
            key={visibility.id}
            setOpen={setOpen}
            setVisibilityType={setVisibilityType}
            visibility={visibility}
            visibilityType={visibilityType}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
