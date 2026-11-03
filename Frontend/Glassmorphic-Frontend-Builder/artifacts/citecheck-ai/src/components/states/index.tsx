import React, { useEffect, useState, useRef } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  WifiOff,
  Clock,
  Search,
  Lock,
  UserCheck,
  CheckCircle2,
  FilePlus2,
  FolderOpen,
  ArrowRight,
  X,
  History,
} from 'lucide-react';
import { Button, Glass, Tag } from '@/components/ui-atoms';

// ==========================================
// 1. EMPTY STATE
// ==========================================
export interface EmptyStateProps {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionHref?: string;
  secondaryText?: string;
  onSecondaryAction?: () => void;
  className?: string;
  testId?: string;
}

export function EmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  actionText,
  onAction,
  actionHref,
  secondaryText,
  onSecondaryAction,
  className = '',
  testId = 'state-empty',
}: EmptyStateProps) {
  return (
    <div
      role="region"
      aria-label={title}
      data-testid={testId}
      className={`glass rounded-2xl p-8 text-center sm:p-12 ${className}`}
    >
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-teal-400/15 text-teal-600 dark:text-teal-200">
        <Icon size={24} />
      </div>
      <h3 className="display mt-4 text-lg font-bold text-foreground sm:text-xl">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground sm:text-sm">
        {description}
      </p>

      {(actionText || secondaryText) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actionText && (
            actionHref ? (
              <a
                href={actionHref}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-300 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5"
              >
                {actionText} <ArrowRight size={14} />
              </a>
            ) : (
              <Button onClick={onAction} className="bg-teal-300 font-bold text-slate-950 hover:bg-teal-200 text-xs">
                {actionText}
              </Button>
            )
          )}
          {secondaryText && onSecondaryAction && (
            <Button variant="outline" onClick={onSecondaryAction} className="text-xs">
              {secondaryText}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. LOADING STATE (LAYOUT-MATCHING SKELETONS)
// ==========================================
export interface LoadingStateProps {
  variant?: 'cards' | 'table' | 'editor' | 'review' | 'generic';
  count?: number;
  message?: string;
  testId?: string;
}

export function LoadingState({
  variant = 'cards',
  count = 4,
  message = 'Loading live data…',
  testId = 'state-loading',
}: LoadingStateProps) {
  return (
    <div role="status" aria-busy="true" aria-label={message} data-testid={testId} className="w-full">
      <span className="sr-only">{message}</span>
      {variant === 'cards' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-5 space-y-3 animate-pulse">
              <div className="h-3 w-20 rounded bg-white/10" />
              <div className="h-8 w-24 rounded bg-white/15" />
              <div className="h-2.5 w-full rounded bg-white/10" />
            </div>
          ))}
        </div>
      )}

      {variant === 'table' && (
        <div className="glass overflow-hidden rounded-2xl border border-border/70 p-4 space-y-3 animate-pulse">
          <div className="h-4 w-48 rounded bg-white/15 mb-4" />
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white/10" />
                <div className="space-y-1.5">
                  <div className="h-3 w-40 rounded bg-white/15" />
                  <div className="h-2.5 w-24 rounded bg-white/10" />
                </div>
              </div>
              <div className="h-6 w-16 rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      )}

      {variant === 'editor' && (
        <div className="grid gap-4 lg:grid-cols-2 animate-pulse">
          <div className="glass rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-4 w-32 rounded bg-white/15" />
              <div className="h-6 w-16 rounded-full bg-white/10" />
            </div>
            <div className="h-64 rounded-xl bg-white/5" />
          </div>
          <div className="glass rounded-2xl p-5 space-y-4">
            <div className="h-4 w-40 rounded bg-white/15" />
            <div className="space-y-3">
              <div className="h-20 rounded-xl bg-white/10" />
              <div className="h-20 rounded-xl bg-white/10" />
            </div>
          </div>
        </div>
      )}

      {variant === 'review' && (
        <div className="grid gap-4 lg:grid-cols-3 animate-pulse">
          <div className="glass rounded-2xl p-4 space-y-3 lg:col-span-1">
            <div className="h-4 w-28 rounded bg-white/15" />
            <div className="h-16 rounded-xl bg-white/10" />
            <div className="h-16 rounded-xl bg-white/10" />
          </div>
          <div className="glass rounded-2xl p-5 space-y-4 lg:col-span-2">
            <div className="h-5 w-48 rounded bg-white/15" />
            <div className="h-40 rounded-xl bg-white/5" />
          </div>
        </div>
      )}

      {variant === 'generic' && (
        <div className="glass rounded-2xl p-8 text-center animate-pulse space-y-3">
          <div className="mx-auto h-8 w-8 rounded-full bg-white/15" />
          <div className="mx-auto h-4 w-36 rounded bg-white/15" />
          <div className="mx-auto h-3 w-64 rounded bg-white/10" />
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. ERROR STATE (FRIENDLY REMEDY + RETRY)
// ==========================================
export interface ErrorStateProps {
  error?: unknown;
  title?: string;
  description?: string;
  retry?: () => void;
  requestId?: string;
  className?: string;
  testId?: string;
}

export function ErrorState({
  error,
  title,
  description,
  retry,
  requestId,
  className = '',
  testId = 'state-error',
}: ErrorStateProps) {
  // Parse error into plain human guidance
  let userTitle = title || 'Unable to complete request';
  let userFix = description;
  const rawMsg = error instanceof Error ? error.message : String(error || '');

  if (!userFix) {
    if (rawMsg.includes('404') || rawMsg.includes('not found')) {
      userTitle = 'Resource not found';
      userFix = 'The requested draft or fact record may have been deleted or moved. Check the URL or return to drafts.';
    } else if (rawMsg.includes('403') || rawMsg.includes('Permission')) {
      userTitle = 'Permission required';
      userFix = 'Your current role does not have authorization to perform this change. Switch to an authorized persona.';
    } else if (rawMsg.includes('401') || rawMsg.includes('unauthorized')) {
      userTitle = 'Session expired';
      userFix = 'Your credentials expired. Please re-authenticate to continue safely.';
    } else if (rawMsg.includes('limit') || rawMsg.includes('500000') || rawMsg.includes('50,000')) {
      userTitle = 'Draft length limit exceeded';
      userFix = 'Drafts must be under 50,000 words. Please shorten or split your document.';
    } else if (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')) {
      userTitle = 'Connection interrupted';
      userFix = 'Could not reach the CiteCheck API server. Please check your internet connection or retry in a moment.';
    } else {
      userFix = rawMsg || 'An unexpected interruption occurred. Your work is safe. Try refreshing the view.';
    }
  }

  const reqId = requestId || (typeof window !== 'undefined' ? `req-${Math.random().toString(36).slice(2, 9)}` : 'req-live');

  return (
    <div
      role="alert"
      data-testid={testId}
      className={`glass rounded-2xl border border-rose-400/30 bg-rose-500/[.06] p-6 sm:p-8 ${className}`}
    >
      <div className="flex items-start gap-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-400/20 text-rose-500">
          <AlertTriangle size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="display text-base font-bold text-foreground sm:text-lg">{userTitle}</h3>
            <span className="mono text-[10px] text-muted-foreground uppercase">Ref: {reqId}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{userFix}</p>

          {retry && (
            <div className="mt-4 flex items-center gap-3">
              <Button
                onClick={retry}
                className="bg-teal-300 font-bold text-slate-950 hover:bg-teal-200 text-xs flex items-center gap-2 cursor-pointer"
                data-testid="button-retry"
              >
                <RefreshCw size={13} /> Retry request
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. OFFLINE BANNER
// ==========================================
export function OfflineBanner({ onReconnect }: { onReconnect?: () => void }) {
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      if (onReconnect) onReconnect();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onReconnect]);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="state-offline-banner"
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-3 border-b border-amber-400/40 bg-amber-500/90 px-4 py-2 text-slate-950 backdrop-blur shadow-md"
    >
      <div className="flex items-center gap-2.5 text-xs font-bold">
        <WifiOff size={16} className="animate-pulse" />
        <span>You are currently offline. Loaded drafts remain readable. CiteCheck will automatically sync when reconnected.</span>
      </div>
      <button
        onClick={() => setIsOffline(false)}
        className="rounded-lg p-1 hover:bg-black/10 text-slate-950 cursor-pointer"
        aria-label="Dismiss offline banner"
      >
        <X size={15} />
      </button>
    </div>
  );
}

// ==========================================
// 5. SLOW NETWORK NOTICE
// ==========================================
export interface SlowNoticeProps {
  loading: boolean;
  thresholdMs?: number;
  stage?: string;
  onTimeoutFallback?: () => void;
}

export function SlowNotice({
  loading,
  thresholdMs = 2500,
  stage = 'Analyzing draft…',
  onTimeoutFallback,
}: SlowNoticeProps) {
  const [elapsed, setElapsed] = useState(0);
  const [isSlow, setIsSlow] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!loading) {
      setIsSlow(false);
      setElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const start = Date.now();
    timerRef.current = setInterval(() => {
      const diff = Math.floor((Date.now() - start) / 1000);
      setElapsed(diff);
      if (Date.now() - start >= thresholdMs) {
        setIsSlow(true);
      }
    }, 500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, thresholdMs]);

  if (!loading || !isSlow) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="state-slow-notice"
      className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-300/30 bg-amber-400/10 p-3 text-xs text-foreground"
    >
      <div className="flex items-center gap-2.5">
        <Clock size={15} className="animate-spin text-amber-500" />
        <div>
          <b className="block">Still working ({elapsed}s elapsed) · {stage}</b>
          <span className="text-[11px] text-muted-foreground">Serverless runtime may be cold-starting. Results will appear automatically.</span>
        </div>
      </div>
      {onTimeoutFallback && elapsed >= 12 && (
        <Button variant="outline" onClick={onTimeoutFallback} className="text-[11px] shrink-0">
          Continue with local rules only
        </Button>
      )}
    </div>
  );
}

// ==========================================
// 6. NO SEARCH RESULTS
// ==========================================
export interface NoResultsProps {
  query: string;
  onClear: () => void;
  suggestions?: string[];
  onSelectSuggestion?: (item: string) => void;
  onCreateNamed?: (name: string) => void;
  testId?: string;
}

export function NoResults({
  query,
  onClear,
  suggestions = [],
  onSelectSuggestion,
  onCreateNamed,
  testId = 'state-no-results',
}: NoResultsProps) {
  return (
    <div
      role="region"
      aria-label="No results"
      data-testid={testId}
      className="glass rounded-2xl p-8 text-center sm:p-10"
    >
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-violet-400/15 text-violet-600 dark:text-violet-200">
        <Search size={22} />
      </div>
      <h3 className="display mt-3 text-base font-bold text-foreground sm:text-lg">
        No results matching "{query}"
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
        Check your spelling or clear active filters to view all workspace items.
      </p>

      {suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">Did you mean:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSelectSuggestion && onSelectSuggestion(s)}
              className="rounded-lg border border-border bg-background/50 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-white/10 cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" onClick={onClear} className="text-xs" data-testid="button-clear-search">
          Clear filters
        </Button>
        {onCreateNamed && (
          <Button
            onClick={() => onCreateNamed(query)}
            className="bg-teal-300 font-bold text-slate-950 hover:bg-teal-200 text-xs flex items-center gap-1.5"
            data-testid="button-create-named"
          >
            <FilePlus2 size={14} /> Create draft named "{query}"
          </Button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 7. PERMISSION DENIED (ROLE BOUNDARY)
// ==========================================
export interface PermissionDeniedProps {
  requiredRole: 'creator' | 'reviewer' | 'brand_manager';
  actionName: string;
  onSwitchRole?: () => void;
  onBack?: () => void;
  testId?: string;
}

export function PermissionDenied({
  requiredRole,
  actionName,
  onSwitchRole,
  onBack,
  testId = 'state-permission-denied',
}: PermissionDeniedProps) {
  const roleTitle = requiredRole === 'brand_manager' ? 'Brand Manager' : requiredRole === 'reviewer' ? 'Reviewer' : 'Creator';
  return (
    <div
      role="alert"
      data-testid={testId}
      className="glass rounded-2xl border border-amber-300/30 bg-amber-300/[.06] p-6 sm:p-8"
    >
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-400/20 text-amber-600 dark:text-amber-200">
          <Lock size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="display text-base font-bold text-foreground sm:text-lg">
              {roleTitle} Access Required
            </h3>
            <Tag tone="amber">{roleTitle} Only</Tag>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            You do not have permission to {actionName}. In accordance with brand governance rules, only team members with the <b>{roleTitle}</b> role can perform this action.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {onSwitchRole && (
              <Button
                onClick={onSwitchRole}
                className="bg-teal-300 font-bold text-slate-950 hover:bg-teal-200 text-xs flex items-center gap-1.5 cursor-pointer"
                data-testid="button-switch-permitted-role"
              >
                <UserCheck size={14} /> Switch to {roleTitle}
              </Button>
            )}
            {onBack && (
              <Button variant="outline" onClick={onBack} className="text-xs">
                Back to workspace
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 8. SESSION EXPIRED DIALOG
// ==========================================
export interface SessionExpiredDialogProps {
  open: boolean;
  onReLogin: () => void;
  savedItemName?: string;
  testId?: string;
}

export function SessionExpiredDialog({
  open,
  onReLogin,
  savedItemName = 'Draft content',
  testId = 'state-session-expired',
}: SessionExpiredDialogProps) {
  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      data-testid={testId}
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm"
    >
      <div className="glass w-full max-w-md rounded-2xl p-6 sm:p-7 shadow-2xl border border-amber-300/40">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400/20 text-amber-500 mx-auto">
          <Lock size={22} />
        </div>
        <h3 id="session-expired-title" className="display mt-4 text-center text-lg font-bold text-foreground">
          Your session ended
        </h3>
        <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">
          Your credentials have expired, but <b>{savedItemName} was saved safely to your local browser storage</b>. Re-authenticate to resume without losing changes.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <Button
            onClick={onReLogin}
            className="w-full bg-teal-300 font-bold text-slate-950 hover:bg-teal-200 py-3 text-xs cursor-pointer shadow-md"
            data-testid="button-relogin"
          >
            Sign in & restore work
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 9. FIELD ERROR
// ==========================================
export interface FieldErrorProps {
  id?: string;
  message?: string;
}

export function FieldError({ id, message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <div
      id={id}
      role="alert"
      aria-live="assertive"
      className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-500 animate-in fade-in duration-200"
    >
      <AlertTriangle size={13} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ==========================================
// 10. SUCCESS PANEL
// ==========================================
export interface SuccessPanelProps {
  title: string;
  detail: string;
  actionText?: string;
  onAction?: () => void;
  secondaryText?: string;
  onSecondaryAction?: () => void;
  className?: string;
  testId?: string;
}

export function SuccessPanel({
  title,
  detail,
  actionText,
  onAction,
  secondaryText,
  onSecondaryAction,
  className = '',
  testId = 'state-success-panel',
}: SuccessPanelProps) {
  return (
    <div
      role="region"
      aria-label={title}
      data-testid={testId}
      className={`glass rounded-2xl border border-teal-300/35 bg-teal-300/[.08] p-5 sm:p-6 shadow-md transition-all ${className}`}
    >
      <div className="flex items-start gap-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-300/25 text-teal-600 dark:text-teal-200">
          <CheckCircle2 size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="display text-base font-bold text-foreground sm:text-lg">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>

          {(actionText || secondaryText) && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {actionText && onAction && (
                <Button
                  onClick={onAction}
                  className="bg-teal-300 font-bold text-slate-950 hover:bg-teal-200 text-xs cursor-pointer"
                  data-testid="button-success-action"
                >
                  {actionText}
                </Button>
              )}
              {secondaryText && onSecondaryAction && (
                <Button variant="outline" onClick={onSecondaryAction} className="text-xs cursor-pointer">
                  {secondaryText}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

