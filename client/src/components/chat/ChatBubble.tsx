"use client";

import { useDrag } from 'react-dnd';
import type { DragSourceMonitor } from 'react-dnd';

export type ChatBubbleProps = {
  role: 'user' | 'assistant';
  content: string;
  panelId?: string | null;
  onEdit?: () => void;
  onRegenerate?: (panelId: string) => void;
  draggable?: boolean;
};

export function ChatBubble({ role, content, panelId, onEdit, onRegenerate, draggable }: ChatBubbleProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'PANEL',
    item: { panelId },
    canDrag: () => Boolean(draggable && panelId),
    collect: (monitor: DragSourceMonitor) => ({ isDragging: monitor.isDragging() }),
  }), [panelId, draggable]);

  const isUser = role === 'user';

  return (
    <div
      ref={draggable ? (drag as any) : undefined}
      className={`group max-w-3xl ${isUser ? 'ml-auto' : ''} ${isDragging ? 'opacity-60' : ''}`}
    >
      <div className={`rounded-2xl px-4 py-3 whitespace-pre-wrap shadow-sm border ${isUser ? 'bg-accent border-accent text-white' : 'bg-bg-primary border-border-default text-text-primary'}`}>
        {content}
      </div>
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 mt-1">
        {onEdit && (
          <button onClick={onEdit} className="text-xs text-text-tertiary hover:text-text-primary transition-colors duration-150">Edit</button>
        )}
        {panelId && onRegenerate && (
          <button onClick={() => onRegenerate(panelId)} className="text-xs text-text-tertiary hover:text-text-primary transition-colors duration-150">Regenerate Panel</button>
        )}
      </div>
    </div>
  );
}
