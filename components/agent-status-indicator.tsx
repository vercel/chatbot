import { memo } from 'react';
import type { ChatStatus } from './create-artifact';

type ControlMode = 'agent' | 'user';

interface AgentStatusIndicatorProps {
  chatStatus?: ChatStatus;
  controlMode: ControlMode;
  className?: string;
}

const PureAgentStatusIndicator = ({
  chatStatus,
  controlMode,
  className = '',
}: AgentStatusIndicatorProps) => {
  // Determine if agent is working based on chat status
  const isAgentWorking = chatStatus === 'streaming' || chatStatus === 'submitted';
  const isUserMode = controlMode === 'user';

  // Determine indicator color and animation
  const getIndicatorClasses = () => {
    if (isUserMode) {
      return 'bg-red-500 animate-pulse';
    }
    if (isAgentWorking) {
      return 'bg-green-500 animate-pulse';
    }
    // Idle/stopped state
    return 'bg-gray-400';
  };

  // Determine status text
  const getStatusText = () => {
    if (isUserMode) {
      return "You're editing manually";
    }
    if (isAgentWorking) {
      return 'AI is working';
    }
    return 'AI has stopped';
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`size-2 rounded-full status-indicator ${getIndicatorClasses()}`}
        role="status"
        aria-label={getStatusText()}
      />
      <span className="text-xs font-ibm-plex-mono">{getStatusText()}</span>
    </div>
  );
};

export const AgentStatusIndicator = memo(PureAgentStatusIndicator);

