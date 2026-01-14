import { Button } from '@/components/ui/button';
import { MonitorX, RefreshCwIcon, ClockFading } from 'lucide-react';

interface BrowserStateProps {
  onRetry?: () => void;
}

export const BrowserLoadingState = () => (
  <div className="flex items-center justify-center h-full bg-gray-50 text-gray-500">
    <div className="flex flex-col w-full max-w-4xl">
      {/* Browser chrome header */}
      <div className="bg-[#ececec] h-[30px] rounded-tl-lg rounded-tr-lg" />
      
      {/* Main content area */}
      <div className="flex-1 bg-[rgba(235,235,235,0.2)] flex flex-col items-center justify-center py-20">
        {/* Spinning icon with circular background */}
        <div className="relative mb-2">
          <div className="w-[53px] h-[53px] rounded-full bg-[#e5e5e5] flex items-center justify-center">
            <RefreshCwIcon className="size-8 animate-spin" />
          </div>
        </div>
        
        {/* Text content */}
        <p className="text-sm font-medium font-source-serif">
          Setting up the browser
        </p>
        <p className="text-xs opacity-75 font-inter">
          Please wait a few moments
        </p>
      </div>
    </div>
  </div>
);

export const BrowserErrorState = ({ onRetry }: BrowserStateProps) => (
  <div className="flex items-center justify-center h-full bg-gray-50 text-gray-500">
    <div className="text-center">
      <MonitorX className="size-8 mx-auto mb-2" />
      <p className="text-sm font-medium font-source-serif">Failed to connect to browser</p>
      <p className="text-xs opacity-75 font-inter">Wait a few moments and try again</p>
      <Button 
        variant="outline" 
        size="sm" 
        className="mt-2"
        onClick={onRetry}
      >
        <RefreshCwIcon className="size-4 mr-1" />
        Retry
      </Button>
    </div>
  </div>
);

export const BrowserTimeoutState = ({ onRetry }: BrowserStateProps) => (
  <div className="flex items-center justify-center h-full bg-gray-50 text-gray-500">
    <div className="text-center">
      <ClockFading className="size-8 mx-auto mb-2" />
      <p className="text-xs sm:text-sm font-medium font-source-serif">Your session was paused due to inactivity</p>
      <p className="text-xs opacity-75 font-inter">Refresh the connection and try again</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={onRetry}
      >
        <RefreshCwIcon className="size-4 mr-1" />
        Retry
      </Button>
    </div>
  </div>
);
