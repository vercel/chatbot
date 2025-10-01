'use client';

import {
  ArrowLeft,
  Brain,
  Camera,
  CheckSquare,
  Clock,
  Code,
  Database,
  Download,
  FileText,
  Globe,
  Keyboard,
  Maximize2,
  MessageCircle,
  MessageSquare,
  Monitor,
  MousePointer,
  Move,
  Network,
  PanelLeft,
  Search,
  Type,
  Upload,
  X
} from 'lucide-react';

interface ToolIconProps {
  toolName: string;
  size?: number;
  className?: string;
}

// Icon mapping for tool actions
const getToolIcon = (toolName: string) => {
  const cleanToolName = toolName.replace('tool-', '');
  
  const iconMap: Record<string, React.ComponentType<any>> = {
    'playwright_browser_navigate': Globe,
    'playwright_browser_click': MousePointer,
    'playwright_browser_type': Type,
    'playwright_browser_fill_form': FileText,
    'playwright_browser_select_option': CheckSquare,
    'playwright_browser_take_screenshot': Camera,
    'playwright_browser_snapshot': Monitor,
    'playwright_browser_wait_for': Clock,
    'playwright_browser_hover': Move,
    'playwright_browser_drag': Move,
    'playwright_browser_press_key': Keyboard,
    'playwright_browser_evaluate': Code,
    'playwright_browser_close': X,
    'playwright_browser_resize': Maximize2,
    'playwright_browser_tabs': PanelLeft,
    'playwright_browser_console_messages': MessageSquare,
    'playwright_browser_network_requests': Network,
    'playwright_browser_handle_dialog': MessageCircle,
    'playwright_browser_file_upload': Upload,
    'playwright_browser_install': Download,
    'playwright_browser_navigate_back': ArrowLeft,
    'search-participants-by-name': Search,
    'get-participant-with-household': Database,
    'updateWorkingMemory': Brain,
  };

  return iconMap[cleanToolName] || FileText; // Default icon
};

export const ToolIcon = ({ toolName, size = 12, className = "text-gray-500 flex-shrink-0" }: ToolIconProps) => {
  const IconComponent = getToolIcon(toolName);
  
  return <IconComponent size={size} className={className} />;
};

// Helper function to get tool display name with icon
export const getToolDisplayInfo = (toolName: string, input?: any): { text: string; icon: React.ComponentType<any> } => {
  const toolMappings: Record<string, (input?: any) => string> = {
    'playwright_browser_navigate': (input) => input?.url ? `Navigated to ${input.url}` : 'Navigated to page',
    'playwright_browser_click': (input) => input?.element ? `Clicked on ${input.element}` : 'Clicked element',
    'playwright_browser_type': (input) => input?.text ? `Typed "${input.text}"` : 'Typed text',
    'playwright_browser_fill_form': () => 'Filled form fields',
    'playwright_browser_select_option': (input) => input?.values ? `Selected "${input.values.join(', ')}"` : 'Selected option',
    'playwright_browser_take_screenshot': () => 'Took screenshot',
    'playwright_browser_snapshot': () => 'Captured page snapshot',
    'playwright_browser_wait_for': (input) => input?.text ? `Waited for "${input.text}"` : 'Waited for element',
    'playwright_browser_hover': (input) => input?.element ? `Hovered over ${input.element}` : 'Hovered over element',
    'playwright_browser_drag': () => 'Performed drag and drop',
    'playwright_browser_press_key': (input) => input?.key ? `Pressed key "${input.key}"` : 'Pressed key',
    'playwright_browser_evaluate': () => 'Executed JavaScript',
    'playwright_browser_close': () => 'Closed browser',
    'playwright_browser_resize': () => 'Resized browser window',
    'playwright_browser_tabs': () => 'Managed browser tabs',
    'playwright_browser_console_messages': () => 'Retrieved console messages',
    'playwright_browser_network_requests': () => 'Retrieved network requests',
    'playwright_browser_handle_dialog': () => 'Handled dialog',
    'playwright_browser_file_upload': () => 'Uploaded files',
    'playwright_browser_install': () => 'Installed browser',
    'playwright_browser_navigate_back': () => 'Navigated back',
    'search-participants-by-name': (input) => input?.name ? `Searched for participant "${input.name}"` : 'Searched for participant',
    'get-participant-with-household': () => 'Retrieved participant data',
    'updateWorkingMemory': () => 'Updated working memory',
  };

  const cleanToolName = toolName.replace('tool-', '');
  const mapper = toolMappings[cleanToolName];
  
  let text: string;
  if (mapper) {
    text = mapper(input);
  } else {
    // Fallback: convert kebab-case to readable format
    text = cleanToolName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  return {
    text,
    icon: getToolIcon(toolName)
  };
};
