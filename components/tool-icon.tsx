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
    // New toolset format (browser_*)
    'browser_navigate': Globe,
    'browser_click': MousePointer,
    'browser_type': Type,
    'browser_fill_form': FileText,
    'browser_select_option': CheckSquare,
    'browser_take_screenshot': Camera,
    'browser_snapshot': Monitor,
    'browser_wait_for': Clock,
    'browser_hover': Move,
    'browser_drag': Move,
    'browser_press_key': Keyboard,
    'browser_evaluate': Code,
    'browser_close': X,
    'browser_resize': Maximize2,
    'browser_tabs': PanelLeft,
    'browser_console_messages': MessageSquare,
    'browser_network_requests': Network,
    'browser_handle_dialog': MessageCircle,
    'browser_file_upload': Upload,
    'browser_install': Download,
    'browser_navigate_back': ArrowLeft,
    // Legacy format (playwright_browser_*)
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
    // Database tools
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
    // New toolset format (browser_*)
    'browser_navigate': (input) => input?.url ? `Navigated to ${input.url}` : 'Navigated to page',
    'browser_click': (input) => input?.element ? `Clicked on ${input.element}` : 'Clicked element',
    'browser_type': (input) => input?.text ? `Typed "${input.text}"` : 'Typed text',
    'browser_fill_form': () => 'Filled form fields',
    'browser_select_option': (input) => input?.values ? `Selected "${input.values.join(', ')}"` : 'Selected option',
    'browser_take_screenshot': () => 'Took screenshot',
    'browser_snapshot': () => 'Captured page snapshot',
    'browser_wait_for': (input) => input?.text ? `Waited for "${input.text}"` : 'Waited for element',
    'browser_hover': (input) => input?.element ? `Hovered over ${input.element}` : 'Hovered over element',
    'browser_drag': () => 'Performed drag and drop',
    'browser_press_key': (input) => input?.key ? `Pressed key "${input.key}"` : 'Pressed key',
    'browser_evaluate': () => 'Executed JavaScript',
    'browser_close': () => 'Closed browser',
    'browser_resize': () => 'Resized browser window',
    'browser_tabs': () => 'Managed browser tabs',
    'browser_console_messages': () => 'Retrieved console messages',
    'browser_network_requests': () => 'Retrieved network requests',
    'browser_handle_dialog': () => 'Handled dialog',
    'browser_file_upload': () => 'Uploaded files',
    'browser_install': () => 'Installed browser',
    'browser_navigate_back': () => 'Navigated back',
    // Legacy format (playwright_browser_*)
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
    // Database tools
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
