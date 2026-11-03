import React, { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import type { Role } from '@/lib/api/types';

export const roleName = (role?: Role) =>
  role === 'brand_manager' ? 'Brand Manager' : role === 'reviewer' ? 'Reviewer' : 'Creator';

export const time = (value?: string) => {
  if (!value) return '—';
  try {
    const d = new Date(value);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 0) {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
};

export function getFactExpiry(reviewDateStr?: string) {
  if (!reviewDateStr) return { status: 'active', label: 'Active', tone: 'teal', isExpired: false, isExpiringSoon: false, days: 999 };
  try {
    const reviewDate = new Date(reviewDateStr);
    const now = new Date();
    const diffDays = Math.ceil((reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { status: 'expired', label: `Expired (${Math.abs(diffDays)}d ago)`, tone: 'rose', isExpired: true, isExpiringSoon: false, days: Math.abs(diffDays) };
    }
    if (diffDays <= 30) {
      return { status: 'expiring', label: `Expiring soon (${diffDays}d)`, tone: 'amber', isExpired: false, isExpiringSoon: true, days: diffDays };
    }
    return { status: 'active', label: 'Active', tone: 'teal', isExpired: false, isExpiringSoon: false, days: diffDays };
  } catch {
    return { status: 'active', label: 'Active', tone: 'teal', isExpired: false, isExpiringSoon: false, days: 999 };
  }
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'danger' | 'outline' }) {
  const styles = {
    primary: 'bg-teal-300 text-slate-950 hover:bg-teal-200 shadow-[0_8px_24px_rgba(45,212,191,.15)]',
    quiet: 'bg-white/5 text-foreground hover:bg-white/10 border border-white/10',
    danger: 'bg-rose-400/15 text-rose-200 border border-rose-300/20 hover:bg-rose-400/25',
    outline: 'border border-border bg-transparent hover:bg-white/5 text-foreground',
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition duration-200 active:scale-[.97] hover:-translate-y-0.5 disabled:opacity-45 disabled:pointer-events-none ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Glass({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={`glass rounded-[1.5rem] ${className}`}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="mono text-[10px] font-medium uppercase tracking-[.2em] text-teal-500 dark:text-teal-300">
      {children}
    </div>
  );
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  const colors: Record<string, string> = {
    neutral: 'bg-white/7 text-muted-foreground border-white/10',
    teal: 'bg-teal-300/10 text-teal-700 dark:text-teal-200 border-teal-300/15',
    violet: 'bg-violet-400/10 text-violet-700 dark:text-violet-200 border-violet-300/15',
    amber: 'bg-amber-300/10 text-amber-700 dark:text-amber-200 border-amber-300/20',
    rose: 'bg-rose-400/10 text-rose-700 dark:text-rose-200 border-rose-300/20',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.09em] ${
        colors[tone] || colors.neutral
      }`}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
      {label}
      <input
        {...props}
        className={`h-11 w-full rounded-xl border bg-background/55 px-3 text-sm text-foreground outline-none transition focus:border-teal-400 ${
          error ? 'border-rose-400' : 'border-border'
        }`}
      />
      {error && <span className="text-rose-500">{error}</span>}
    </label>
  );
}

export function TextArea({
  label,
  error,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
      {label}
      <textarea
        {...props}
        className={`w-full rounded-xl border bg-background/55 px-3 py-3 text-sm text-foreground outline-none transition focus:border-teal-400 ${
          error ? 'border-rose-400' : 'border-border'
        }`}
      />
      {error && <span className="text-rose-500">{error}</span>}
    </label>
  );
}

export function PageHead({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function LoadingCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="glass rounded-3xl p-5">
          <div className="skeleton h-4 w-1/3 rounded-full" />
          <div className="skeleton mt-5 h-8 w-2/3 rounded-lg" />
          <div className="skeleton mt-4 h-16 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function ApiFailure({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <Glass className="p-6 sm:p-8">
      <div className="flex gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-400/10 text-rose-500">
          <ShieldAlert size={20} />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold">API unreachable</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Could not load this data.'}
          </p>
          <Button onClick={retry} variant="outline" className="mt-4">
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      </div>
    </Glass>
  );
}

export function ErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <Glass className="m-4 p-7">
      <Eyebrow>Something interrupted this view</Eyebrow>
      <h2 className="display mt-2 text-xl font-bold">The work is still safe.</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Button className="mt-5" onClick={resetError}>
        Try again
      </Button>
    </Glass>
  );
}
