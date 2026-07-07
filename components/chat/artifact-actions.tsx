import { memo, type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { artifactDefinitions, type UIArtifact } from "./artifact";
import type { ArtifactActionContext } from "./create-artifact";

type ArtifactActionsProps = {
  artifact: UIArtifact;
  handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  mode: "edit" | "diff";
  metadata: ArtifactActionContext["metadata"];
  setMetadata: ArtifactActionContext["setMetadata"];
};

type ArtifactAction = {
  description: string;
  icon: ReactNode;
  onClick: (context: ArtifactActionContext) => Promise<void> | void;
};

function ArtifactActionButton({
  action,
  actionContext,
  disabled,
  isActive,
  setIsLoading,
}: {
  action: ArtifactAction;
  actionContext: ArtifactActionContext;
  disabled: boolean;
  isActive: boolean;
  setIsLoading: (isLoading: boolean) => void;
}) {
  const handleClick = useCallback(async () => {
    setIsLoading(true);

    try {
      await Promise.resolve(action.onClick(actionContext));
    } catch {
      toast.error("Failed to execute action");
    } finally {
      setIsLoading(false);
    }
  }, [action, actionContext, setIsLoading]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            "flex items-center justify-center rounded-full p-3 text-muted-foreground transition-all duration-150",
            "hover:text-foreground",
            "active:scale-95",
            "disabled:pointer-events-none disabled:opacity-30",
            {
              "text-foreground": isActive,
            }
          )}
          disabled={disabled}
          onClick={handleClick}
          type="button"
        >
          {action.icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8}>
        {action.description}
      </TooltipContent>
    </Tooltip>
  );
}

function PureArtifactActions({
  artifact,
  handleVersionChange,
  currentVersionIndex,
  isCurrentVersion,
  mode,
  metadata,
  setMetadata,
}: ArtifactActionsProps) {
  const [isLoading, setIsLoading] = useState(false);

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind
  );

  if (!artifactDefinition) {
    throw new Error("Artifact definition not found!");
  }

  const actionContext: ArtifactActionContext = {
    content: artifact.content,
    currentVersionIndex,
    handleVersionChange,
    isCurrentVersion,
    metadata,
    mode,
    setMetadata,
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      {artifactDefinition.actions.map((action) => {
        const disabled =
          isLoading || artifact.status === "streaming"
            ? true
            : action.isDisabled
              ? action.isDisabled(actionContext)
              : false;

        return (
          <ArtifactActionButton
            action={action}
            actionContext={actionContext}
            disabled={disabled}
            isActive={mode === "diff" && action.description === "View changes"}
            key={action.description}
            setIsLoading={setIsLoading}
          />
        );
      })}
    </div>
  );
}

export const ArtifactActions = memo(
  PureArtifactActions,
  (prevProps, nextProps) => {
    if (prevProps.artifact.status !== nextProps.artifact.status) {
      return false;
    }
    if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex) {
      return false;
    }
    if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) {
      return false;
    }
    if (prevProps.artifact.content !== nextProps.artifact.content) {
      return false;
    }
    if (prevProps.mode !== nextProps.mode) {
      return false;
    }

    return true;
  }
);
