import React from 'react';
import { 
  Bell, 
  X, 
  Check, 
  RotateCcw, 
  ExternalLink, 
  AlertTriangle, 
  AlertCircle, 
  Info 
} from 'lucide-react';
import { AppNotification, NotificationPriority } from '../types';

interface NotificationToastProps {
  notification: AppNotification | null;
  onDismiss: () => void;
  onMarkAsRead: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onOpenItem?: (taskId?: string, eventId?: string) => void;
  snoozeMinutes: number;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onDismiss,
  onMarkAsRead,
  onSnooze,
  onOpenItem,
  snoozeMinutes,
}) => {
  if (!notification) return null;

  const getPriorityIcon = (p: NotificationPriority) => {
    switch (p) {
      case 'urgent':
        return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      case 'high':
        return <AlertCircle className="w-5 h-5 text-amber-400" />;
      case 'normal':
        return <Info className="w-5 h-5 text-blue-400" />;
      case 'low':
      default:
        return <Bell className="w-5 h-5 text-zinc-400" />;
    }
  };

  return (
    <div 
      className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-[#121212] border border-amber-500/40 rounded-2xl p-4 shadow-2xl space-y-3 animate-slideInRight"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 shrink-0 mt-0.5">
            {getPriorityIcon(notification.priority)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                {notification.priority} priority
              </span>
              {notification.itemType && (
                <span className="text-[10px] text-zinc-400">
                  • {notification.itemType}
                </span>
              )}
            </div>
            <h4 className="text-sm font-semibold text-zinc-100 mt-0.5">
              {notification.title}
            </h4>
            {notification.message && (
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                {notification.message}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onMarkAsRead(notification.id);
              onDismiss();
            }}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg transition-colors flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Acknowledge</span>
          </button>

          <button
            onClick={() => {
              onSnooze(notification.id, snoozeMinutes);
              onDismiss();
            }}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Snooze ({snoozeMinutes}m)</span>
          </button>
        </div>

        {(notification.relatedTaskId || notification.relatedEventId) && onOpenItem && (
          <button
            onClick={() => {
              onOpenItem(notification.relatedTaskId, notification.relatedEventId);
              onDismiss();
            }}
            className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>View</span>
          </button>
        )}
      </div>
    </div>
  );
};
