// ABOUTME: Barrel export for all UI components to enable clean imports
// ABOUTME: Centralizes UI component exports for better tree-shaking and import organization

// Core UI Components
export { Button } from './button';
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
export { Input } from './input';
export { Label } from './label';
export { Textarea } from './textarea';
export { Badge } from './badge';
export { Avatar, AvatarFallback, AvatarImage } from './avatar';
export { Alert, AlertDescription, AlertTitle } from './alert';

// Navigation & Layout
export { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
export { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from './sheet';
export { ScrollArea, ScrollBar } from './scroll-area';
export { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion';

// Form Controls
export { Switch } from './switch';
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

// Dropdowns & Menus
export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './dropdown-menu';
export { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './context-menu';
export { Menu } from './menu';

// Feedback Components
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
export { Toast, ToastAction, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from './toast';
export { Toaster } from './toaster';
export { useToast } from './use-toast';

// Data Display
export { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from './table';

// Layout & Utility
export { Hero } from './hero';
export { LoadingIndicator } from './loading';
export { PageLoader } from './page-loader';
export { RecursiveUI } from './recursive-ui';

// Error Handling
export { DisplayError } from './error/display-error';

// Chat-specific components
export { 
  ChatInputForm, 
  ChatInputStatus, 
  ChatInputActionArea, 
  ChatInputPrimaryActionArea, 
  ChatInputSecondaryActionArea 
} from './chat/chat-input-area/chat-input-area';

export {
  ChatTextInput
} from './chat/chat-input-area/chat-text-input';

export {
  AttachFile
} from './chat/chat-input-area/attach-file';

export {
  ImageInput
} from './chat/chat-input-area/image-input';

export {
  Microphone
} from './chat/chat-input-area/microphone';

export {
  StopChat
} from './chat/chat-input-area/stop-chat';

export {
  SubmitChat
} from './chat/chat-input-area/submit-chat';

export {
  ChatMessageArea
} from './chat/chat-message-area/chat-message-area';

export {
  ChatLoading
} from './chat/chat-message-area/chat-loading';

export { default as ChatMessageContainer } from './chat/chat-message-area/chat-message-container';

export { default as ChatMessageContent } from './chat/chat-message-area/chat-message-content';

export {
  useChatScrollAnchor
} from './chat/chat-message-area/use-chat-scroll-anchor';

// Markdown components
export {
  Markdown
} from './markdown/markdown';

export {
  CodeBlock
} from './markdown/code-block';

export {
  Citation
} from './markdown/citation';

export {
  CitationSlider
} from './markdown/citation-slider';

export {
  Paragraph
} from './markdown/paragraph';

// Error Boundaries
export {
  AppErrorBoundary
} from './error-boundary/app-error-boundary';

export {
  ChatErrorBoundary
} from './error-boundary/chat-error-boundary';

export {
  BaseErrorBoundary
} from './error-boundary/base-error-boundary';

// Network Status
export {
  NetworkStatusIndicator,
  DetailedNetworkStatus,
  OfflineBanner
} from './network-status';

// Utility functions
export { cn } from './lib';