import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Bell, Check, Clock, AlertTriangle, ShieldAlert, Radar, FileText, CheckCheck } from 'lucide-react';
import { useNotifications } from '@/hooks/use-product-data';
import { api } from '@/lib/api/endpoints';
import { toast } from 'sonner';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setPath] = useLocation();
  const popoverRef = useRef<HTMLDivElement>(null);

  const notificationsQuery = useNotifications();
  const notifs = Array.isArray(notificationsQuery.data) ? notificationsQuery.data : [];
  const unreadList = notifs.filter((n) => !n.read);
  const unreadCount = unreadList.length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      await notificationsQuery.refetch();
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Could not mark notifications as read');
    }
  };

  const handleNotificationClick = async (item: any) => {
    try {
      if (!item.read) {
        await api.markNotificationRead(item.id);
        await notificationsQuery.refetch();
      }
    } catch {}

    setIsOpen(false);

    // Route according to ref_type
    if (item.ref_type === 'fact' || item.kind?.includes('fact')) {
      setPath('/brand-kit');
    } else if (item.ref_type === 'rule' || item.kind?.includes('radar') || item.kind?.includes('gap')) {
      setPath('/gap-radar');
    } else if (item.ref_type === 'draft' || item.kind?.includes('draft')) {
      if (item.ref_id) {
        setPath(`/drafts/${item.ref_id}`);
      } else {
        setPath('/review');
      }
    } else {
      setPath('/brand-kit');
    }
  };

  const getToneIcon = (kind: string) => {
    if (kind.includes('expired')) return <ShieldAlert size={14} className="text-rose-500" />;
    if (kind.includes('expiring')) return <Clock size={14} className="text-amber-500" />;
    if (kind.includes('radar') || kind.includes('gap')) return <Radar size={14} className="text-violet-500" />;
    if (kind.includes('draft')) return <FileText size={14} className="text-amber-500" />;
    return <AlertTriangle size={14} className="text-teal-500" />;
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-border bg-background/50 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
        title="Governance Notifications"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white shadow-sm ring-2 ring-background animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 w-80 sm:w-96 rounded-2xl border border-border bg-popover/95 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-300">
                Governance Alerts
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 mono text-[9px] font-bold text-rose-500">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:underline dark:text-teal-300"
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          <div className="mt-3 max-h-[380px] overflow-y-auto space-y-2 pr-1">
            {notifs.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <Check size={24} className="mx-auto text-teal-500 mb-2" />
                All caught up. No unread governance alerts.
              </div>
            ) : (
              notifs.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`cursor-pointer rounded-xl border p-3 text-xs transition ${
                    item.read
                      ? 'border-border/50 bg-background/30 opacity-70 hover:opacity-100 hover:bg-white/5'
                      : 'border-teal-400/25 bg-teal-400/[.06] hover:bg-teal-400/10'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0 rounded-lg bg-background p-1.5 shadow-sm border border-border/60">
                      {getToneIcon(item.kind || '')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-foreground text-[11px] truncate">{item.title}</span>
                        {!item.read && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground leading-4">{item.body}</p>
                      <div className="mt-2 flex items-center justify-between mono text-[9px] text-muted-foreground">
                        <span className="capitalize">{item.kind?.replace(/_/g, ' ')}</span>
                        <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Active'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Real-time fact expiry & Gap Radar feed</span>
            <button
              onClick={() => {
                api.scanNotifications().then(() => notificationsQuery.refetch());
                toast.success('Governance alert scan completed');
              }}
              className="text-teal-600 hover:underline dark:text-teal-300 font-bold"
            >
              Scan now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

