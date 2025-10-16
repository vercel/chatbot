import { memo } from 'react';
import { CrossIcon } from './icons';
import { Button } from './ui/button';
import { closeArtifact, useArtifact } from '@/hooks/use-artifact';

function PureArtifactCloseButton() {
  const { setArtifact } = useArtifact();

  return (
    <Button
      data-testid="artifact-close-button"
      variant="outline"
      className="h-fit p-2 hover:bg-custom-purple/20 dark:hover:bg-custom-purple/20"
      onClick={() => {
        closeArtifact(setArtifact);
      }}
    >
      <CrossIcon size={18} />
    </Button>
  );
}

export const ArtifactCloseButton = memo(PureArtifactCloseButton, () => true);
