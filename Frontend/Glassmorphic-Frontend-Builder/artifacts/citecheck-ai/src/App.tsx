import { getSupabase, initSupabase } from '@/lib/supabase';
import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, BookOpen, Check,
  CheckCheck, ChevronDown, CircleHelp, Download, FilePlus2, FileText, Flag, Gauge,
  GitCompareArrows, History, Home, Layers3, LockKeyhole, LogIn, MoreHorizontal, PanelRight,
  Plus, Radar, RefreshCw, Search, Send, Settings2, ShieldAlert, ShieldCheck, Sparkles,
  Sun, Moon, Upload, UserCheck, X, LogOut,
} from 'lucide-react';
import { api, API_BASE_URL } from '@/lib/api/endpoints';
import { sampleText } from '@/lib/api/fixtures';
import type { Draft, Finding, Role } from '@/lib/api/types';
import { useSession } from '@/store/session';
import { useAddComment, useAuditLog, useBrandKit, useComments, useCreateDraft, useCreateVersion, useDecision, useDraft, useDrafts, useFindings, useGapRadar, useReviewDecision, useReviewRun, useVersions, keys } from '@/hooks/use-product-data';
import { changesSchema, commentSchema, dismissSchema, draftSchema, editSchema, kitItemSchema, loginSchema } from '@/lib/schemas';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { FindingCard } from '@/components/finding-card';
import { VerifierFunnel } from '@/components/verifier-funnel';
import { VerifierLabPage } from '@/pages/verifier-lab';
import { BrandKitFacts } from '@/components/brand-kit-facts';
import { NotificationCenter } from '@/components/notification-center';
import { BrandKitPage } from '@/pages/brand-kit';
import { GuidedTour } from '@/components/guided-tour';
import { GapRadarPage } from '@/pages/gap-radar';
import { AuditPage } from '@/pages/audit';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true }, mutations: { retry: 0 } } });
const nav = [
  { href: '/dashboard', label: 'Overview', icon: Home },
  { href: '/drafts', label: 'Drafts', icon: FileText },
  { href: '/brand-kit', label: 'Brand kit', icon: Layers3 },
  { href: '/review', label: 'Review queue', icon: CheckCheck },
  { href: '/verifier-lab', label: 'Verifier Lab', icon: ShieldCheck },
  { href: '/gap-radar', label: 'Gap Radar', icon: Radar },
  { href: '/audit', label: 'Audit log', icon: History },
];
const roleName = (role?: Role) => role === 'brand_manager' ? 'Brand Manager' : role === 'reviewer' ? 'Reviewer' : 'Creator';
const time = (value?: string) => {
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

function getFactExpiry(reviewDateStr?: string) {
  if (!reviewDateStr) return { status: 'active', label: 'Active', tone: 'teal', isExpired: false, isExpiringSoon: false };
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
    return { status: 'active', label: 'Active', tone: 'teal', isExpired: false, isExpiringSoon: false };
  }
}

function Button({ children, variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'danger' | 'outline' }) {
  const styles = { primary: 'bg-teal-300 text-slate-950 hover:bg-teal-200 shadow-[0_8px_24px_rgba(45,212,191,.15)]', quiet: 'bg-white/5 text-foreground hover:bg-white/10 border border-white/10', danger: 'bg-rose-400/15 text-rose-200 border border-rose-300/20 hover:bg-rose-400/25', outline: 'border border-border bg-transparent hover:bg-white/5 text-foreground' };
  return <button {...props} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition duration-200 active:scale-[.97] hover:-translate-y-0.5 disabled:opacity-45 disabled:pointer-events-none ${styles[variant]} ${className}`}>{children}</button>;
}
function Glass({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`glass rounded-[1.5rem] ${className}`}>{children}</div>;
}
function Eyebrow({ children }: { children: ReactNode }) { return <div className="mono text-[10px] font-medium uppercase tracking-[.2em] text-teal-500 dark:text-teal-300">{children}</div>; }
function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  const colors: Record<string, string> = { neutral: 'bg-white/7 text-muted-foreground border-white/10', teal: 'bg-teal-300/10 text-teal-700 dark:text-teal-200 border-teal-300/15', violet: 'bg-violet-400/10 text-violet-700 dark:text-violet-200 border-violet-300/15', amber: 'bg-amber-300/10 text-amber-700 dark:text-amber-200 border-amber-300/20', rose: 'bg-rose-400/10 text-rose-700 dark:text-rose-200 border-rose-300/20' };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.09em] ${colors[tone] || colors.neutral}`}>{children}</span>;
}
function Field({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">{label}<input {...props} className={`h-11 w-full rounded-xl border bg-background/55 px-3 text-sm text-foreground outline-none transition focus:border-teal-400 ${error ? 'border-rose-400' : 'border-border'}`} />{error && <span className="text-rose-500">{error}</span>}</label>;
}
function TextArea({ label, error, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">{label}<textarea {...props} className={`w-full rounded-xl border bg-background/55 px-3 py-3 text-sm text-foreground outline-none transition focus:border-teal-400 ${error ? 'border-rose-400' : 'border-border'}`} />{error && <span className="text-rose-500">{error}</span>}</label>;
}
function PageHead({ eyebrow, title, sub, action }: { eyebrow: string; title: string; sub?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><Eyebrow>{eyebrow}</Eyebrow><h1 className="display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>{sub && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{sub}</p>}</div>{action}</div>;
}
function LoadingCards() { return <div className="grid gap-4 md:grid-cols-2">{[1, 2, 3, 4].map((n) => <div key={n} className="glass rounded-3xl p-5"><div className="skeleton h-4 w-1/3 rounded-full" /><div className="skeleton mt-5 h-8 w-2/3 rounded-lg" /><div className="skeleton mt-4 h-16 rounded-xl" /></div>)}</div>; }
function ApiFailure({ error, retry }: { error: unknown; retry: () => void }) { return <Glass className="p-6 sm:p-8"><div className="flex gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-400/10 text-rose-500"><ShieldAlert size={20} /></div><div className="min-w-0"><h3 className="font-bold">API unreachable</h3><p className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Could not load this data.'}</p><Button onClick={retry} variant="outline" className="mt-4"><RefreshCw size={14} /> Retry</Button></div></div></Glass>; }
function ErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return <Glass className="m-4 p-7"><Eyebrow>Something interrupted this view</Eyebrow><h2 className="display mt-2 text-xl font-bold">The work is still safe.</h2><p className="mt-2 text-sm text-muted-foreground">{error.message}</p><Button className="mt-5" onClick={resetError}>Try again</Button></Glass>;
}

// GuidedTour is imported from @/components/guided-tour

function DocxUploadModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (draftId: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState<{
    filename: string;
    text: string;
    char_count: number;
    word_count: number;
    paragraph_count: number;
    heading_count?: number;
    table_count: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const createDraft = useCreateDraft();

  if (!open) return null;

  const handleFile = async (f?: File) => {
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext === 'doc') {
      toast.error('Legacy .doc format is not supported. Please save or export your document as a modern .docx file.');
      return;
    }
    if (!['docx', 'md', 'txt'].includes(ext || '')) {
      toast.error('CiteCheck accepts .docx, .md, and .txt files.');
      return;
    }
    if (f.size > 4 * 1024 * 1024) {
      toast.error('File size exceeds the 4 MB limit (Vercel serverless budget). Please choose a smaller document.');
      return;
    }
    if (f.size === 0) {
      toast.error('Uploaded file is empty (0 bytes).');
      return;
    }

    setFile(f);
    setLoading(true);
    try {
      if (ext === 'docx') {
        const res = await api.parseDocx(f);
        setExtracted(res);
        toast.success(`Extracted ${res.word_count} words from ${f.name}`);
      } else {
        const text = await f.text();
        if (!text.trim()) {
          toast.error('Uploaded file contains no readable text.');
          setFile(null);
          setExtracted(null);
          return;
        }
        const words = text.split(/\s+/).filter(Boolean).length;
        const paragraphs = text.split(/\n+/).filter(Boolean).length;
        setExtracted({
          filename: f.name,
          text: text.trim(),
          char_count: text.length,
          word_count: words,
          paragraph_count: paragraphs,
          table_count: 0,
        });
        toast.success(`Loaded ${words} words from ${f.name}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to parse file.');
      setFile(null);
      setExtracted(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!extracted) return;
    try {
      const created = await createDraft.mutateAsync({
        title: extracted.filename,
        text: extracted.text,
      });
      toast.success(`Draft "${extracted.filename}" created with ${extracted.word_count} words`);
      onCreated(created.id);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Could not create draft');
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <Glass className="w-full max-w-2xl p-6 sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <Eyebrow>Word Document Ingestion</Eyebrow>
            <h2 className="display mt-1 text-2xl font-bold">Upload Microsoft Word (.docx)</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Extracts body copy, bulleted lists, section headers, footers, and structured data tables. Limit: 4 MB (Vercel budget).
        </p>

        {!extracted ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0]) void handleFile(e.dataTransfer.files[0]);
            }}
            className="mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-background/30 p-8 text-center transition hover:border-teal-400 hover:bg-teal-300/[.03]"
          >
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-300/10 text-teal-600 dark:text-teal-200">
              <Upload size={24} />
            </span>
            <p className="mt-4 text-sm font-bold text-foreground">
              {loading ? 'Reading and extracting document structure…' : 'Drag & drop your .docx file here'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">or click below to browse from your device</p>
            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-300 px-4 py-2.5 text-xs font-bold text-slate-950 shadow hover:bg-teal-200">
              <FileText size={15} /> Select file (.docx, .md, .txt)
              <input
                type="file"
                accept=".docx,.md,.txt"
                className="sr-only"
                disabled={loading}
                onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
                onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])}
              />
            </label>
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-[10px] text-muted-foreground">
              <Tag tone="teal">.docx / .md / .txt (≤ 4MB)</Tag>
              <Tag tone="violet">Tables parsed</Tag>
              <Tag tone="neutral">No passwords</Tag>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/50 p-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-300/15 text-teal-600 dark:text-teal-200">
                  <FileText size={16} />
                </span>
                <div>
                  <b className="text-xs text-foreground">{extracted.filename}</b>
                  <span className="block text-[10px] text-muted-foreground">
                    {extracted.word_count} words {extracted.heading_count ? `· ${extracted.heading_count} headings ` : ''}· {extracted.paragraph_count} paragraphs {extracted.table_count > 0 ? `· ${extracted.table_count} tables` : ''}
                  </span>
                </div>
              </div>
              <button
                onClick={() => { setFile(null); setExtracted(null); }}
                className="text-xs font-semibold text-rose-500 hover:underline"
              >
                Choose another
              </button>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <Eyebrow>Extracted Text Preview</Eyebrow>
                <span className="text-[10px] text-muted-foreground">{extracted.char_count} characters</span>
              </div>
              <div className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-slate-950/70 p-4 font-mono text-xs leading-6 text-foreground">
                {extracted.text}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={createDraft.isPending} onClick={handleCreate}>
                <Sparkles size={14} /> {createDraft.isPending ? 'Ingesting…' : 'Create Draft & Run Review'}
              </Button>
            </div>
          </div>
        )}
      </Glass>
    </div>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const [path, setPath] = useLocation();
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  const theme = useSession((s) => s.theme);
  const setTheme = useSession((s) => s.setTheme);
  const demoRole = useSession((s) => s.demoRole);
  const { data: commandDraftsRaw } = useDrafts();
  const commandDrafts = Array.isArray(commandDraftsRaw) ? commandDraftsRaw : [];
  const [palette, setPalette] = useState(false);
  const [more, setMore] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPalette((v) => !v); }
      if (event.key === 'Escape') { setPalette(false); setMore(false); setUserMenu(false); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  const visibleNav = nav.filter((item) => !item.roles || item.roles.includes(user?.role || 'creator'));
  const go = (href: string) => { setPath(href); setPalette(false); setMore(false); };
  return <div className="app-atmosphere min-h-[100dvh]">
    <div className="aurora-orb orb-teal" /><div className="aurora-orb orb-violet" /><div className="aurora-orb orb-amber" />
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/65 backdrop-blur-2xl">
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-4 sm:px-7">
        <Link href="/" className="flex items-center gap-2.5" data-testid="link-brand-home">
          <img src="/security-banner.png" alt="CiteCheck Security Shield" className="h-9 w-auto max-w-[130px] rounded-lg shadow-md border border-violet-400/30 object-contain bg-slate-950/40 px-1 py-0.5" />
          <span className="display text-lg font-bold tracking-tight">CiteCheck<span className="ml-1 rounded-md bg-violet-400/15 px-1.5 py-0.5 align-middle font-sans text-[9px] font-extrabold tracking-[.12em] text-violet-600 dark:text-violet-200">AI</span></span>
        </Link>
        <div className="hidden items-center gap-2 md:flex"><span className="mono rounded-full border border-border bg-card/50 px-3 py-1.5 text-[9px] uppercase tracking-widest text-muted-foreground">Lumen Pay · synthetic demo</span>
          <button onClick={() => setPalette(true)} className="flex items-center gap-2 rounded-xl border border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground hover:bg-card" aria-label="Open command palette"><Search size={14} /> Jump to <kbd className="rounded border px-1.5 py-0.5 font-mono text-[9px]">⌘ K</kbd></button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-xl border border-border bg-card/50 p-2.5 text-muted-foreground hover:text-foreground" aria-label="Toggle theme" data-testid="button-theme-toggle">{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>
          <NotificationCenter />
          <div className="hidden items-center gap-1 rounded-xl border border-border/70 bg-card/50 p-1 xl:flex">
            {[
              ['creator', 'Meera (Creator)', 'bg-teal-300 text-slate-950 font-bold shadow-sm'],
              ['reviewer', 'Nisha (Reviewer)', 'bg-violet-400 text-slate-950 font-bold shadow-sm'],
              ['brand_manager', 'Arjun (Manager)', 'bg-amber-400 text-slate-950 font-bold shadow-sm'],
            ].map(([r, label, activeClass]) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  demoRole(r as any);
                  toast.success(`Switched role to ${label}`);
                }}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                  user?.role === r ? activeClass : 'text-muted-foreground hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenu(!userMenu)}
                className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-left text-xs hover:bg-card transition shadow-sm cursor-pointer"
                data-testid="button-user-menu"
                aria-label="User account menu"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-400/20 font-bold text-violet-600 dark:text-violet-200">
                  {user.name ? user.name.split(' ').map((v) => v[0]).slice(0, 2).join('').toUpperCase() : 'U'}
                </span>
                <span className="hidden sm:block">
                  <b className="block text-foreground leading-tight">{user.name || 'User'}</b>
                  <span className="text-[10px] text-muted-foreground">{roleName(user.role)}</span>
                </span>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${userMenu ? 'rotate-180' : ''}`} />
              </button>

              {userMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border/80 bg-background/95 p-2 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95">
                    <div className="border-b border-border/60 px-3 py-2.5">
                      <p className="text-xs font-bold text-foreground">{user.name || 'User'}</p>
                      <p className="text-[10px] text-muted-foreground">{roleName(user.role)}</p>
                    </div>
                    <div className="p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenu(false);
                          localStorage.removeItem('citecheck_dismiss_tour');
                          window.location.reload();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-card hover:text-foreground transition cursor-pointer"
                      >
                        <Sparkles size={15} /> Restart Guided Tour
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenu(false);
                          setPath('/settings');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-card hover:text-foreground transition cursor-pointer"
                      >
                        <Settings2 size={15} /> Settings
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setUserMenu(false);
                          await logout();
                          toast.success('Signed out successfully');
                          setPath('/');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        data-testid="button-logout"
                      >
                        <LogOut size={15} /> Log out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link href="/" className="rounded-xl bg-teal-300 px-4 py-2 text-xs font-bold text-slate-950 shadow-sm hover:bg-teal-200">Sign in</Link>
          )}
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <button onClick={() => setPalette(true)} aria-label="Search" className="rounded-xl border border-border p-2"><Search size={16} /></button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme" className="rounded-xl border border-border p-2">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
          <NotificationCenter />
          {user && (
            <button
              onClick={async () => { await logout(); toast.success('Signed out successfully'); setPath('/'); }}
              aria-label="Log out"
              title="Log out"
              className="rounded-xl border border-rose-300/30 bg-rose-500/10 p-2 text-rose-500"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
    <div className="mx-auto flex max-w-[1440px]">
      <aside className="hidden w-[235px] shrink-0 px-4 pt-7 lg:block">
        <div className="sticky top-[92px]">
          <Eyebrow>Workspace</Eyebrow>
          <nav className="mt-3 grid gap-1" aria-label="Main navigation">{visibleNav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-white/5 ${path === href || (href === '/drafts' && path.startsWith('/drafts/')) ? 'bg-teal-300/10 text-teal-700 dark:text-teal-200 ring-1 ring-teal-300/15' : 'text-muted-foreground hover:text-foreground'}`} data-testid={`nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={17} />{label}{path === href && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-300" />}</Link>)}</nav>
          <div className="mt-8 rounded-2xl border border-violet-300/15 bg-violet-300/[.07] p-4"><div className="flex items-center gap-2 text-violet-700 dark:text-violet-200"><Sparkles size={15} /><span className="text-xs font-bold">AI suggests, humans decide</span></div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Every issue points to an excerpt and a source. People make the call.</p></div>
          <div className="mt-4 grid gap-1"><Link href="/how-it-works" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground"><CircleHelp size={15} />How it works</Link><Link href="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground"><Settings2 size={15} />Settings</Link></div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-64 pt-7 sm:px-7 lg:px-8 lg:pb-64">{children}</main>
    </div>
    {user && <nav aria-label="Quick navigation" className="dock-shell fixed bottom-5 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-1 rounded-[1.35rem] border border-white/15 bg-slate-950/80 p-2 text-white backdrop-blur-2xl lg:flex">{visibleNav.slice(0, 5).map(({ href, label, icon: Icon }) => <Link key={href} href={href} title={label} aria-label={label} className={`group grid h-12 w-12 place-items-center rounded-2xl transition duration-200 hover:-translate-y-2 hover:scale-[1.18] hover:bg-white/10 ${path === href ? 'bg-teal-300 text-slate-950 shadow-lg shadow-teal-300/15' : 'text-white/70'}`}><Icon size={19} /></Link>)}<Link href="/settings" title="Settings" aria-label="Settings" className="grid h-12 w-12 place-items-center rounded-2xl text-white/70 transition hover:-translate-y-2 hover:scale-[1.18] hover:bg-white/10"><Settings2 size={19} /></Link></nav>}
    {user && <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border/70 bg-background/85 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-2xl lg:hidden">{visibleNav.slice(0, 4).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`grid justify-items-center gap-1 py-1 text-[9px] font-bold ${path === href ? 'text-teal-600 dark:text-teal-200' : 'text-muted-foreground'}`}><Icon size={19} /><span>{label.split(' ')[0]}</span></Link>)}<button onClick={() => setMore(true)} className="grid justify-items-center gap-1 py-1 text-[9px] font-bold text-muted-foreground"><MoreHorizontal size={19} />More</button></nav>}
  { more && <div className="fixed inset-0 z-50 flex items-end bg-slate-950/55 p-3 backdrop-blur-sm lg:hidden" onClick={() => setMore(false)}><div className="glass w-full rounded-[1.7rem] p-5" onClick={(e) => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h3 className="display text-lg font-bold">More in workspace</h3><button onClick={() => setMore(false)} aria-label="Close menu"><X /></button></div><div className="grid grid-cols-2 gap-2">{[...visibleNav.slice(4), { href: '/how-it-works', label: 'How it works', icon: BookOpen }, { href: '/settings', label: 'Settings', icon: Settings2 }, { href: '#logout', label: 'Log out', icon: LogOut, isLogout: true }].map((item: any) => <button key={item.href} onClick={() => { if (item.isLogout) { logout(); toast.success("Signed out successfully"); setPath("/"); } else { go(item.href); } }} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3 text-left text-sm"><item.icon size={16} />{item.label}</button>)}</div></div></div> }
  { palette && <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/60 px-4 pt-[12vh] backdrop-blur-sm" onClick={() => setPalette(false)}><div className="glass w-full max-w-xl rounded-3xl p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex items-center gap-3 border-b border-border px-3 pb-3"><Search size={18} className="text-muted-foreground" /><input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Jump to a page or draft…" className="h-10 flex-1 bg-transparent text-sm outline-none" data-testid="input-command-search" /><kbd className="rounded border px-2 py-1 font-mono text-[10px]">ESC</kbd></div><div className="p-2">{[...visibleNav, { href: '/how-it-works', label: 'How it works', icon: BookOpen }, { href: '/settings', label: 'Settings', icon: Settings2 }, ...(commandDrafts || []).map((draft) => ({ href: `/drafts/${draft.id}`, label: draft.title, icon: FileText }))].filter((n) => n.label.toLowerCase().includes(search.toLowerCase())).map(({ href, label, icon: Icon }) => <button key={href} onClick={() => go(href)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-white/10"><Icon size={16} />{label}<ArrowRight size={14} className="ml-auto text-muted-foreground" /></button>)}</div><div className="px-3 pb-2 text-[10px] text-muted-foreground">CiteCheck command menu <span className="float-right">↑↓ to navigate · Esc to close</span></div></div></div> }
  </div >;
}

function Landing() {
  const [decision, setDecision] = useState('');
  const scannerText = sampleText;
  const [scan, setScan] = useState(false);
  const sample = 'Lumen Pay is India’s ';
  return <div className="page-enter">
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex justify-center"><span className="mono rounded-full border border-violet-300/20 bg-violet-300/[.08] px-4 py-2 text-[9px] tracking-[.2em] text-violet-700 dark:text-violet-200">CODEX 48 <span className="mx-2 text-muted-foreground">|</span> BRAND GOVERNANCE <span className="mx-2 text-muted-foreground">|</span> INKLOOM AI BRIEF</span></div>
      <section className="relative grid items-center gap-8 lg:grid-cols-[1.03fr_.97fr] lg:gap-12">
        <div className="relative z-10 py-6 lg:py-12"><Eyebrow>Evidence-first brand governance</Eyebrow><h1 className="display mt-5 max-w-[680px] text-[clamp(2.7rem,6.4vw,5.7rem)] font-bold leading-[.98] tracking-[-.065em]">Every claim.<br /><span className="text-teal-500 dark:text-teal-300">A source behind it.</span></h1><p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">Every claim in your content, checked against approved facts before it goes public.</p><div className="mt-5 flex flex-wrap gap-2"><Tag tone="teal">Catch brand inconsistencies.</Tag><Tag tone="violet">Verify claims.</Tag><Tag tone="amber">Keep humans in control.</Tag></div><div className="mt-8 flex flex-wrap gap-3"><Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-teal-300 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-xl shadow-teal-300/10 transition hover:-translate-y-1 hover:bg-teal-200">Open the app <ArrowUpRight size={16} /></Link><Link href="/how-it-works" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-5 py-3 text-sm font-bold hover:bg-card">How it works <ArrowRight size={15} /></Link></div><p className="mt-5 text-xs text-muted-foreground">Synthetic Lumen Pay demo · An illustrative workflow, not a real product review</p></div>
        <Glass className="soft-grid relative p-5 sm:p-7"><div className="absolute inset-0 pointer-events-none rounded-[inherit] bg-gradient-to-br from-teal-300/[.09] via-transparent to-violet-400/[.12]" /><div className="relative"><div className="flex items-center justify-between"><div><Eyebrow>Illustrative claim scanner</Eyebrow><h2 className="display mt-1 text-xl font-bold">One line. Full provenance.</h2></div><span className="flex items-center gap-1.5 text-[10px] font-bold text-teal-600 dark:text-teal-200"><span className="h-2 w-2 animate-pulse rounded-full bg-teal-400" />LIVE PREVIEW</span></div><div className="relative mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 p-5 font-mono text-[13px] leading-7 text-slate-100 shadow-inner"><div className="scan-beam" /><span>{sample}</span><span className="highlight-rose">{scannerText.includes('most trusted') ? 'most trusted wallet' : 'your claim'}</span><span>{scannerText.includes('zero fees') ? ' and charges ' : ' and speaks '}</span><span className="highlight-amber">{scannerText.includes('zero fees') ? 'zero fees forever' : 'with certainty'}</span><span>.</span><button onClick={() => { setScan(true); setTimeout(() => setScan(false), 1800); }} className="absolute bottom-3 right-3 rounded-lg bg-white/10 px-2 py-1 text-[9px] text-white/70 hover:bg-white/20">{scan ? 'Checking sources…' : '↻ Scan again'}</button></div><div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/[.06] p-4 transition duration-300"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-400/15 text-rose-500"><Flag size={14} /></span><div><div className="text-sm font-bold">Unsupported superlative</div><div className="mt-0.5 text-[10px] text-muted-foreground">EXCERPT · “most trusted wallet”</div></div></div><Tag tone="rose">High</Tag></div><p className="mt-3 text-xs leading-5 text-muted-foreground">No approved evidence for “most trusted”. See <span className="mono text-violet-600 dark:text-violet-200">FACT-07</span> · Claims need proof.</p><div className="mt-3 rounded-xl bg-white/[.04] p-3 text-xs"><span className="text-muted-foreground line-through">most trusted wallet</span><span className="mx-2 text-muted-foreground">→</span><span className="font-semibold text-teal-600 dark:text-teal-200">a wallet built for simple, everyday payments</span></div>{decision && <div className="mt-2 text-[10px] font-bold text-teal-600 dark:text-teal-200">Decision recorded in this illustrative demo: {decision}</div>}<div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => setDecision('accepted')} className="px-3 py-2 text-[10px]" data-testid="button-demo-accept"><Check size={13} />Accept</Button><Button variant="quiet" onClick={() => setDecision('edited')} className="px-3 py-2 text-[10px]" data-testid="button-demo-edit">Edit</Button><Button variant="quiet" onClick={() => setDecision('dismissed with reason')} className="px-3 py-2 text-[10px]" data-testid="button-demo-dismiss">Dismiss</Button></div></div><p className="mt-3 text-center text-[10px] text-muted-foreground">Illustrative example. The human decides.</p></div></Glass>
      </section>
      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {[['Unsupported or outdated claims', 'A claim without a current approved source is a trust risk.', '01'], ['Brand identity drift', 'The same product can sound like three different companies.', '02'], ['Unclear review decisions', 'A finding needs an exact quote, a source, and a reason.', '03']].map(([title, body, num]) => <Glass key={num} className="glass-hover p-6"><Eyebrow>THE PROBLEM · {num}</Eyebrow><h3 className="display mt-4 text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></Glass>)}
      </section>
      <Glass className="mt-4 grid gap-5 p-6 sm:grid-cols-[auto_1fr] sm:p-8"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-300/15 text-amber-600 dark:text-amber-200"><CircleHelp /></span><div><Eyebrow>Why evidence matters</Eyebrow><h3 className="display mt-2 text-xl font-bold">Brand inconsistency is a trust problem.</h3><p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">In <i>Moffatt v Air Canada</i>, 2024 BCCRT 149 (2024), the tribunal addressed misinformation provided by Air Canada’s chatbot. In the ASCI Annual Complaints Report 2024–25, ASCI said 98% of ads it scrutinised required some modification. These references frame the problem; they are not claims about CiteCheck’s impact.</p></div></Glass>
      <section className="mt-16"><div className="mb-6 flex items-end justify-between"><div><Eyebrow>Seven deliberate steps</Eyebrow><h2 className="display mt-2 text-3xl font-bold">A review you can follow.</h2></div><Link href="/how-it-works" className="hidden text-sm font-bold text-teal-600 hover:underline sm:block">Explore the workflow <ArrowRight size={15} className="inline" /></Link></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[['01', 'Brand kit', 'Current approved facts'], ['02', 'Draft', 'Text + external AI notice'], ['03', 'Review', 'Rules + AI + verifier'], ['04', 'Resolve', 'Human decisions'], ['05', 'Submit', 'A saved version'], ['06', 'Decide', 'Reviewer sign-off'], ['07', 'Learn', 'Patterns, not blame']].map(([n, t, b]) => <Glass key={n} className={`p-4 ${n === '04' || n === '06' ? 'border-amber-300/25' : ''}`}><span className="mono text-[10px] text-teal-600 dark:text-teal-300">{n}{n === '04' || n === '06' ? ' · HUMAN' : ''}</span><h3 className="display mt-3 font-bold">{t}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{b}</p></Glass>)}</div></section>
      <section className="mt-16 grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><Glass className="p-7 sm:p-9"><Eyebrow>What makes this different</Eyebrow><h2 className="display mt-3 text-3xl font-bold">Evidence is the interface.</h2><div className="mt-6 grid gap-4 sm:grid-cols-3">{[['01', 'Evidence-first', 'No source and real excerpt, no finding.'], ['02', 'Facts have a clock', 'Each approved fact carries a review date.'], ['03', 'Gap Radar', 'Repeated dismissals can reveal unclear rules.']].map(([n, t, b]) => <div key={n} className="border-t border-border pt-4"><span className="mono text-[10px] text-violet-500">{n}</span><h3 className="mt-2 font-bold">{t}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{b}</p></div>)}</div></Glass><Glass className="p-7 sm:p-9"><Eyebrow>Before / after</Eyebrow><div className="mt-5 grid gap-3"><div className="rounded-2xl border border-rose-300/15 bg-rose-300/[.05] p-4"><div className="mono text-[9px] uppercase tracking-widest text-rose-500">Today</div><p className="mt-2 text-sm">Vague feedback. No source. Same mistake next time.</p></div><div className="rounded-2xl border border-teal-300/20 bg-teal-300/[.06] p-4"><div className="mono text-[9px] uppercase tracking-widest text-teal-600 dark:text-teal-200">With CiteCheck</div><p className="mt-2 text-sm">Exact excerpt. Approved reference. A human decision logged.</p></div></div></Glass></section>
      <Glass className="mt-5 flex flex-col items-start justify-between gap-5 border-teal-300/15 p-6 sm:flex-row sm:items-center sm:p-8"><div><Eyebrow>Team sign-off · illustrative</Eyebrow><h2 className="display mt-2 text-2xl font-bold">TECHNOVA — Submitted for review</h2><p className="mt-2 text-sm text-muted-foreground">Codex 48 · Inkloom AI brand-governance brief</p></div><div className="flex items-center gap-3 rounded-2xl border border-teal-300/20 bg-teal-300/[.08] px-4 py-3 text-teal-700 dark:text-teal-200"><BadgeCheck /><div><div className="text-sm font-bold">Evidence, not guesswork</div><div className="text-[10px] text-muted-foreground">Ugesh Kumar · Riya Sharma · Shushma Singh</div></div></div></Glass>
      <footer className="pb-10 pt-12 text-center text-xs text-muted-foreground">Codex 48 Idea Submission <span className="mx-2">·</span> Illustrative persona: Meera, growth marketer at a mid-size fintech publishing through 2 agencies and AI writing tools.</footer>
    </div>
  </div>;
}

function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

function LoginPage() {
  const [, setPath] = useLocation();
  const setSession = useSession((s) => s.setSession);
  const demoRole = useSession((s) => s.demoRole);
  const form = useForm<{ email: string; password: string; role: Role }>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'meera@lumenpay.example', password: 'demo-pass', role: 'creator' }
  });
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const choose = (role: Role) => {
    form.setValue('role', role);
    const email = role === 'creator' ? 'meera@lumenpay.example' : role === 'reviewer' ? 'nisha@lumenpay.example' : 'arjun@lumenpay.example';
    form.setValue('email', email);
  };

  const signInWithGoogle = async () => {
    setGoogleBusy(true);
    try {
      const sb = await initSupabase();
      if (!sb) {
        toast.error('Supabase authentication client is initializing. Please retry in a moment.');
        setGoogleBusy(false);
        return;
      }

      // Preserve chosen role in localStorage for post-OAuth redirect mapping
      const chosenRole = form.getValues('role') || 'creator';
      try {
        localStorage.setItem('citecheck_oauth_role', chosenRole);
      } catch {}

      const redirectUrl = window.location.origin;
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        toast.error(error.message || 'Google Sign-In failed');
        setGoogleBusy(false);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to initiate Google authentication');
      setGoogleBusy(false);
    }
  };

  const submit = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      const response = await api.login(values);
      setSession(response.token, response.user);
      toast.success(`Welcome, ${response.user.name}`);
      setPath('/dashboard');
    } catch {
      // In fixture / fallback mode, log in as the chosen role
      const role = form.getValues('role') || 'creator';
      demoRole(role);
      toast.success(`Welcome, ${role === 'creator' ? 'Meera Nair' : role === 'reviewer' ? 'Nisha Rao' : 'Arjun Mehta'}`);
      setPath('/dashboard');
    } finally {
      setBusy(false);
    }
  });

  return (
    <div className="mx-auto max-w-5xl py-5 lg:py-10">
      <div className="mb-6 flex justify-center">
        <img src="/security-banner.png" alt="CiteCheck AI Security Shield" className="h-16 w-auto max-w-full rounded-2xl border border-violet-400/30 shadow-xl object-contain bg-slate-950/70 px-4 py-2" />
      </div>
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_.85fr]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow>Welcome to your review room</Eyebrow>
          <span className="mono text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md">
            ( for security reasons, this step is mandatory )
          </span>
        </div>
        <h1 className="display mt-4 text-4xl font-bold leading-tight sm:text-5xl">
          Good claims have<br />
          <span className="text-teal-500 dark:text-teal-300">a paper trail.</span>
        </h1>
        <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
          Sign in to work with the Lumen Pay synthetic demo. Your role controls which actions are available.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ['creator', 'Meera', 'Write + resolve'],
            ['brand_manager', 'Arjun', 'Own the brand kit'],
            ['reviewer', 'Nisha', 'Review + decide']
          ].map(([role, name, desc]) => (
            <button
              key={role}
              type="button"
              onClick={() => choose(role as Role)}
              className={`rounded-2xl border p-4 text-left transition hover:-translate-y-1 ${
                form.watch('role') === role
                  ? 'border-teal-400 bg-teal-300/10 shadow-sm ring-1 ring-teal-400/40'
                  : 'border-border bg-card/50 hover:bg-card'
              }`}
              data-testid={`button-demo-${role}`}
            >
              <span className="mono text-[9px] uppercase tracking-widest text-muted-foreground">Demo account</span>
              <b className="mt-2 block text-sm">{name}</b>
              <span className="mt-1 block text-[10px] text-muted-foreground">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      <Glass className="p-6 sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <Eyebrow>Secure sign in</Eyebrow>
            <h2 className="display mt-2 text-2xl font-bold">Continue to CiteCheck</h2>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-400/15 text-violet-600 dark:text-violet-200">
            <LockKeyhole size={18} />
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Synthetic demo data only · credentials are sent to the configured API.</p>

        <form onSubmit={submit} className="mt-6 grid gap-4" noValidate>
          <Field label="Email" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email?.message} data-testid="input-login-email" />
          <Field label="Password" type="password" autoComplete="current-password" {...form.register('password')} error={form.formState.errors.password?.message} data-testid="input-login-password" />
          <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
            Role
            <select
              {...form.register('role')}
              onChange={(e) => choose(e.target.value as Role)}
              className="h-11 rounded-xl border border-border bg-background/55 px-3 text-sm text-foreground"
            >
              <option value="creator">Creator</option>
              <option value="brand_manager">Brand Manager</option>
              <option value="reviewer">Reviewer</option>
            </select>
          </label>
          <Button disabled={busy || googleBusy} type="submit" className="mt-2 w-full bg-teal-400 text-slate-950 font-bold hover:bg-teal-300 py-3.5 text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer" data-testid="button-login">
            {busy ? "Connecting..." : "Continue"} <ArrowRight size={16} />
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border/70" />
          <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border/70" />
        </div>

        <button
          type="button"
          disabled={googleBusy || busy}
          onClick={signInWithGoogle}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-card hover:-translate-y-0.5 active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          data-testid="button-google-login"
        >
          {googleBusy ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin text-teal-400" />
              <span>Connecting to Google...</span>
            </>
          ) : (
            <>
              <GoogleIcon className="h-4 w-4" />
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[.06] p-3 text-[10px] leading-5 text-muted-foreground">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-200" />
          The bearer token stays in memory for this session. For preview-only role switching, turn on VITE_USE_FIXTURES=true.
        </div>
      </Glass>
      </div>
    </div>
  );
}

      function Dashboard() {
  const {data, isLoading, isError, error, refetch} = useDrafts();
  const { data: brandKitData } = useBrandKit();
  const draftsList = Array.isArray(data) ? data : [];
  const openFindingCount = draftsList.reduce((sum, item) => sum + (item.findings_count || 0), 0);
  const statusCount = (status: string) => draftsList.filter((d) => d.status.toLowerCase() === status.toLowerCase()).length;
  const user = useSession((s) => s.user);
  const [docxOpen, setDocxOpen] = useState(false);
  const [, setPath] = useLocation();
  const factsList = brandKitData?.facts || [];
  const expiredFacts = factsList.filter((f: any) => getFactExpiry(f.expires_on || f.review_date).status === 'expired');

      return <div className="page-enter">
        <DocxUploadModal open={docxOpen} onClose={() => setDocxOpen(false)} onCreated={(id) => setPath(`/drafts/${id}`)} />
        <GuidedTour />
        {expiredFacts.length > 0 && (
          <Glass className="mb-4 flex flex-wrap items-center justify-between gap-3 border-rose-300/30 bg-rose-300/[.06] p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-400/20 text-rose-600 dark:text-rose-200">
                <ShieldAlert size={18} />
              </span>
              <div>
                <b className="text-xs text-foreground">Fact Expiry Radar · {expiredFacts.length} {expiredFacts.length === 1 ? 'claim requires' : 'claims require'} human confirmation</b>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {expiredFacts.map((f: any) => `${f.id || f.code || f.fact_code || 'FACT'} (${(f.text || f.fact_text || '').slice(0, 32)}...)`).join(' and ')} review {expiredFacts.length === 1 ? 'date has' : 'dates have'} passed. Evidence gates require human approval for expired claims.
                </p>
              </div>
            </div>
            <Link href="/brand-kit" className="text-xs font-bold text-rose-600 dark:text-rose-200 hover:underline shrink-0">Inspect Brand Kit →</Link>
          </Glass>
        )}
        <PageHead eyebrow={`${roleName(user?.role)} workspace`} title="Good work starts with a source." sub="A live view of drafts, decisions, and what's waiting for a human." action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDocxOpen(true)} className="px-4 py-3 text-xs"><Upload size={14} />Upload document (.docx / .md)</Button><Link href="/drafts/new" className="inline-flex items-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:-translate-y-1"><Plus size={16} />New draft</Link></div>} />
        {isLoading ? <LoadingCards /> : isError ? <ApiFailure error={error} retry={() => refetch()} /> : <div className="grid gap-4 md:grid-cols-4">
          <Glass className="glass-hover col-span-2 p-5 sm:p-6"><div className="flex items-center justify-between"><Eyebrow>Draft pulse</Eyebrow><Link href="/drafts" className="text-xs font-bold text-teal-600 dark:text-teal-200">All drafts <ArrowUpRight size={14} className="inline" /></Link></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Draft', statusCount('Draft'), 'text-muted-foreground'], ['In review', statusCount('In review'), 'text-violet-500'], ['Changes requested', statusCount('Changes requested'), 'text-amber-600'], ['Approved', statusCount('Approved'), 'text-teal-600']].map(([label, value, color]) => <div key={String(label)} className="rounded-2xl border border-border/70 bg-background/35 p-3"><div className={`display text-3xl font-bold ${color}`}>{isLoading ? '—' : value}</div><div className="mt-1 text-[10px] leading-4 text-muted-foreground">{label}</div></div>)}</div><div className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-teal-300" />Live from your workspace.</div></Glass>
          <Glass className="glass-hover p-5 sm:p-6"><div className="flex items-center justify-between"><Eyebrow>Open findings</Eyebrow><Flag size={16} className="text-amber-500" /></div><div className="display mt-4 text-4xl font-bold">{openFindingCount}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Findings reported across loaded drafts. Check each excerpt before you decide.</p><Link href="/drafts" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-200">Review drafts <ArrowRight size={13} /></Link></Glass>
          <Glass className="glass-hover p-5 sm:p-6"><div className="flex items-center justify-between"><Eyebrow>Human review</Eyebrow><Sparkles size={16} className="text-violet-500" /></div><div className="display mt-4 text-4xl font-bold">{draftsList.filter((d) => d.status.toLowerCase() === 'in review').length}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Submitted items waiting for a reviewer decision.</p><Link href="/review" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-200">Open queue <ArrowRight size={13} /></Link></Glass>
          <Glass className="col-span-2 p-5 sm:p-6"><div className="flex items-center justify-between"><div><Eyebrow>Recent work</Eyebrow><h2 className="display mt-1 text-xl font-bold">Drafts in motion</h2></div><Activity size={17} className="text-teal-500" /></div><div className="mt-4 divide-y divide-border/60">{draftsList.slice(0, 4).map((draft) => <Link key={draft.id} href={`/drafts/${draft.id}`} className="flex items-center gap-3 py-3 hover:text-teal-600 dark:hover:text-teal-200" data-testid={`row-recent-draft-${draft.id}`}><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-300/10 text-violet-600 dark:text-violet-200"><FileText size={16} /></span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{draft.title}</b><span className="text-[10px] text-muted-foreground">v{draft.version} · Updated {time(draft.updated_at)}</span></span><Tag tone={draft.status === 'Approved' ? 'teal' : draft.status === 'In review' ? 'violet' : draft.status === 'Changes requested' ? 'amber' : 'neutral'}>{draft.status}</Tag><ArrowRight size={14} className="hidden text-muted-foreground sm:block" /></Link>)}</div>{draftsList.length === 0 && <p className="mt-5 text-sm text-muted-foreground">No drafts yet. Start with a claim you want to verify.</p>}</Glass>
          <Glass className="col-span-2 p-5 sm:p-6"><div className="flex items-center justify-between"><div><Eyebrow>Quick actions</Eyebrow><h2 className="display mt-1 text-xl font-bold">Pick up where you are.</h2></div><ArrowUpRight size={17} className="text-muted-foreground" /></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{[[FilePlus2, 'Create a draft', '/drafts/new'], [Layers3, 'Check approved facts', '/brand-kit'], [Radar, 'Explore Gap Radar', '/gap-radar'], [History, 'Inspect audit trail', '/audit']].map(([Icon, label, href]) => <Link key={String(href)} href={String(href)} className="flex items-center gap-3 rounded-2xl border border-border bg-background/35 p-4 text-sm font-semibold transition hover:-translate-y-1 hover:bg-white/5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-300/10 text-teal-600 dark:text-teal-200"><Icon size={16} /></span>{String(label)}<ArrowRight size={14} className="ml-auto text-muted-foreground" /></Link>)}</div><p className="mt-4 text-[10px] text-muted-foreground">Numbers shown here are returned by the API; no performance statistics are estimated.</p></Glass>
        </div>}
        <Glass className="mt-4 flex items-center gap-4 p-4 sm:p-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-300/15 text-amber-600 dark:text-amber-200"><ShieldCheck size={18} /></span><div><b className="text-sm">AI suggests, humans decide.</b><p className="mt-1 text-xs text-muted-foreground">Review every source, especially when numbers, names, or dates are involved.</p></div></Glass>
      </div>;
}

// BrandKitPage is imported from @/pages/brand-kit


        function DraftsPage() {
  const {data, isLoading, isError, error, refetch} = useDrafts();
        const [search, setSearch] = useState('');
        const [filter, setFilter] = useState('All');
        const [docxOpen, setDocxOpen] = useState(false);
        const [, setPath] = useLocation();
  const draftsList = useMemo(() => (Array.isArray(data) ? data : []).filter((draft) => draft.title.toLowerCase().includes(search.toLowerCase()) && (filter === 'All' || draft.status === filter)), [data, search, filter]);
        return <div className="page-enter">
          <DocxUploadModal open={docxOpen} onClose={() => setDocxOpen(false)} onCreated={(id) => setPath(`/drafts/${id}`)} />
          <PageHead eyebrow="Content workspace" title="Drafts" sub="Search the work in progress. Every version can be traced back to a decision." action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDocxOpen(true)} className="px-4 py-3 text-xs"><Upload size={14} />Upload document (.docx / .md)</Button><Link href="/drafts/new" className="inline-flex items-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:-translate-y-1"><Plus size={15} />New draft</Link></div>} />
          <Glass className="mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-border bg-background/45 px-3 sm:w-80"><Search size={15} className="text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search drafts…" className="min-w-0 flex-1 bg-transparent text-xs outline-none" data-testid="input-draft-search" /></label><div className="flex gap-1 overflow-x-auto">{['All', 'Draft', 'In review', 'Changes requested', 'Approved'].map((s) => <button key={s} onClick={() => setFilter(s)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-bold ${filter === s ? 'bg-teal-300 text-slate-950' : 'text-muted-foreground hover:bg-white/5'}`}>{s}</button>)}</div></Glass>
          {isLoading ? <LoadingCards /> : isError ? <ApiFailure error={error} retry={() => refetch()} /> : draftsList.length ? <div className="grid gap-3">{draftsList.map((draft) => <DraftRow key={draft.id} draft={draft} />)}</div> : <Glass className="p-9 text-center"><FileText className="mx-auto text-violet-500" size={24} /><h2 className="display mt-3 text-xl font-bold">{search ? 'No matching drafts' : filter === 'Approved' ? 'No approved drafts yet' : 'A blank page, with a source.'}</h2><p className="mt-2 text-sm text-muted-foreground">{filter === 'Approved' ? 'Once a reviewer approves a submitted draft in the Review Queue, the locked version appears here.' : 'Start with a title and the words you want checked.'}</p><Link href="/drafts/new" className="mt-5 inline-flex rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-bold text-slate-950">Create a draft</Link></Glass>}
        </div>;
}
        function DraftRow({draft}: {draft: Draft }) {
  const tone = draft.status === 'Approved' ? 'teal' : draft.status === 'In review' ? 'violet' : draft.status === 'Changes requested' ? 'amber' : 'neutral';
        return <Link href={`/drafts/${draft.id}`} className="glass glass-hover grid gap-4 rounded-[1.4rem] p-5 sm:grid-cols-[1fr_auto] sm:items-center" data-testid={`card-draft-${draft.id}`}><div className="flex min-w-0 items-center gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-300/10 text-violet-600 dark:text-violet-200"><FileText size={18} /></span><div className="min-w-0"><h3 className="truncate font-bold">{draft.title}</h3><p className="mt-1 text-[10px] text-muted-foreground">DRAFT v{draft.version} <span className="mx-2">·</span> Updated {time(draft.updated_at)}</p></div></div><div className="flex items-center gap-3 pl-[60px] sm:pl-0"><Tag tone={tone}>{draft.status}</Tag><span className="rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-[10px] text-muted-foreground">{draft.findings_count ?? 0} {(draft.findings_count ?? 0) === 1 ? 'finding' : 'findings'}</span><ArrowRight size={15} className="text-muted-foreground" /></div></Link>;
}

        function NewDraftPage() {
  const [, setPath] = useLocation();
        const createDraft = useCreateDraft();
        const form = useForm<{ title: string; text: string; acknowledge: boolean }>({resolver: zodResolver(draftSchema), defaultValues: {title: '', text: '', acknowledge: false } });
  const loadFile = async (file?: File) => {
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'doc') {
      toast.error('Legacy .doc format is not supported. Please save or export your document as a modern .docx file.');
      return;
    }
    if (extension === 'docx') {
      try {
        toast('Extracting text, tables, and headers from .docx…');
        const parsed = await api.parseDocx(file);
        form.setValue('title', parsed.filename, { shouldValidate: true });
        form.setValue('text', parsed.text, { shouldValidate: true });
        form.setValue('acknowledge', true, { shouldValidate: true });
        toast.success(`Extracted ${parsed.word_count} words from ${file.name}`);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to extract .docx content');
      }
      return;
    }
    if (!['md', 'txt'].includes(extension || '')) {
      toast.error('Choose a .docx, .md, or .txt file.');
      return;
    }
    try {
      const text = await file.text();
      if (!text.trim()) {
        toast.error('Uploaded file is empty (0 bytes).');
        return;
      }
      form.setValue('title', file.name, { shouldValidate: true });
      form.setValue('text', text.trim(), { shouldValidate: true });
      form.setValue('acknowledge', true, { shouldValidate: true });
      const words = text.split(/\s+/).filter(Boolean).length;
      toast.success(`${file.name} loaded (${words} words)`);
    } catch (err: any) {
      toast.error(err?.message || 'Could not read file text.');
    }
  };
        const submit = form.handleSubmit(async ({title, text}) => {
    try { const created = await createDraft.mutateAsync({title, text}); toast.success('Draft created'); setPath(`/drafts/${created.id}`); }
        catch (e) {
      const fields = (e as {fields ?: Record<string, string>}).fields;
      if (fields) Object.entries(fields).forEach(([name, message]) => form.setError(name as 'title' | 'text', {message}));
        toast.error(e instanceof Error ? e.message : 'Could not create draft');
    }
  });
        return <div className="page-enter mx-auto max-w-4xl"><button onClick={() => setPath('/drafts')} className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft size={14} />Back to drafts</button><PageHead eyebrow="New content" title="Start with the actual words." sub="Add the draft as it will appear. CiteCheck checks specific excerpts against the Lumen Pay brand kit." />
          <Glass className="mb-4 flex gap-3 border-amber-300/20 bg-amber-300/[.06] p-4 sm:p-5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-300/15 text-amber-600 dark:text-amber-200"><ShieldAlert size={17} /></span><div><b className="text-sm">Draft text goes to an external AI service.</b><p className="mt-1 text-xs leading-5 text-muted-foreground">Only draft text and relevant clauses are sent. Review the content before continuing.</p></div></Glass>
          <Glass className="p-5 sm:p-7"><form onSubmit={submit} className="grid gap-5" noValidate><Field label="Draft name" placeholder="e.g. app-store-listing.md" {...form.register('title')} error={form.formState.errors.title?.message} data-testid="input-new-draft-title" /><div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-muted-foreground">Draft text</span><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-[10px] font-bold hover:bg-white/5"><Upload size={13} />Choose .md / .txt<input type="file" accept=".md,.txt,.docx" className="sr-only" onClick={(e) => { (e.target as HTMLInputElement).value = ""; }} onChange={(e) => loadFile(e.target.files?.[0])} data-testid="input-draft-file" /></label></div><div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void loadFile(event.dataTransfer.files[0]); }} className="rounded-2xl transition hover:ring-1 hover:ring-teal-300/30" data-testid="drop-draft-text"><TextArea label="" rows={12} placeholder="Paste or drop a .md / .txt file here…" {...form.register('text')} error={form.formState.errors.text?.message} data-testid="input-new-draft-text" /><div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>Markdown (.md), Word (.docx), and plain text accepted · Up to 50,000 words</span><span>{((form.watch('text') || '').trim().split(/\s+/).filter(Boolean).length).toLocaleString()} words (50k limit)</span></div></div></div><label className={`flex items-start gap-3 rounded-xl border p-4 text-xs leading-5 ${form.formState.errors.acknowledge ? 'border-rose-400' : 'border-border'}`}><input type="checkbox" className="mt-1 accent-teal-400" {...form.register('acknowledge')} data-testid="checkbox-ai-acknowledgement" /><span><b>Required acknowledgement:</b> I understand that the draft text and relevant clauses are sent to an external AI service for review. My team makes every final decision.</span></label>{form.formState.errors.acknowledge && <span className="-mt-4 text-xs text-rose-500">{form.formState.errors.acknowledge.message}</span>}<div className="flex flex-wrap justify-end gap-2"><Button variant="outline" type="button" onClick={() => setPath('/drafts')}>Cancel</Button><Button disabled={createDraft.isPending} type="submit"><Sparkles size={15} />{createDraft.isPending ? 'Creating…' : 'Create draft'}</Button></div></form></Glass>
        </div>;
}

        function HighlightedEditor({value, onChange, readOnly}: {value: string; onChange: (value: string) => void; readOnly?: boolean }) {
  const overlay = useRef<HTMLDivElement>(null);
          const terms = ['most trusted wallet', 'zero fees forever', 'up to 15%', 'military-grade', 'UPI transaction'];
          const pattern = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
          const sections = value.split(pattern);
          return <div className="relative">
            <div ref={overlay} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-[13px] leading-8 text-foreground">{sections.map((part, index) => terms.some((term) => term.toLowerCase() === part.toLowerCase()) ? <mark key={index} className={part.toLowerCase().includes('trusted') || part.toLowerCase().includes('military') ? 'rounded bg-rose-300/25 text-foreground' : 'rounded bg-amber-300/25 text-foreground'}>{part}</mark> : <span key={index}>{part}</span>)}</div>
            <textarea value={value} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} onScroll={(event) => { if (overlay.current) { overlay.current.scrollTop = event.currentTarget.scrollTop; overlay.current.scrollLeft = event.currentTarget.scrollLeft; } }} className={`relative min-h-[280px] w-full resize-y bg-transparent p-5 font-mono text-[13px] leading-8 caret-teal-400 outline-none selection:bg-teal-300/30 sm:min-h-[360px] ${readOnly ? 'text-foreground' : 'text-transparent'}`} style={readOnly ? undefined : { textShadow: '0 0 0 transparent' }} data-testid="textarea-draft-editor" aria-label="Draft content editor" />
            <div className="pointer-events-none absolute bottom-4 right-4 rounded-lg border border-border bg-background/80 px-2 py-1 text-[9px] text-muted-foreground">Excerpt matches glow behind text</div>
          </div>;
}

          function DraftEditorPage({id}: {id: string }) {
  const [mobileTab, setMobileTab] = useState<'editor' | 'findings'>('editor');
          const [findingFilter, setFindingFilter] = useState('All');
          const [subtab, setSubtab] = useState('Versions');
          const [diffView, setDiffView] = useState<{ before: string; after: string } | null>(null);
          const [text, setText] = useState('');
          const [initialized, setInitialized] = useState(false);
          const draftQuery = useDraft(id);
          const findingsQuery = useFindings(id);
          const versionsQuery = useVersions(id);
          const commentsQuery = useComments(id);
          const runReview = useReviewRun(id);
          const addComment = useAddComment(id);
          const createVersion = useCreateVersion(id);
          const client = useQueryClient();
  const user = useSession((s) => s.user);
          const canEdit = user?.role === 'creator';
          const findingList = Array.isArray(findingsQuery.data) ? findingsQuery.data : [];
  const activeFindings = findingList.filter((f) => f.status === 'open');
  const brandKitQuery = useBrandKit();
  const facts = brandKitQuery.data?.facts || [];
  const draftExpiredFinding = findingList.find((f) => {
    if (f.status !== 'open') return false;
    const citedFact = facts.find((k) => k.id === f.source_ref_id);
    const exp = citedFact ? getFactExpiry(citedFact.review_date) : null;
    return f.verification_status === 'blocked_expired_fact' || Boolean(exp?.isExpired);
  });
  const draftHasExpiredFact = Boolean(draftExpiredFinding);
  useEffect(() => { if (draftQuery.data && !initialized) {setText(draftQuery.data.text); setInitialized(true); } }, [draftQuery.data, initialized]);
          const commentForm = useForm<{ text: string }>({resolver: zodResolver(commentSchema), defaultValues: {text: '' } });
          const submitComment = commentForm.handleSubmit(async ({text: comment }) => { try {await addComment.mutateAsync({ text: comment }); commentForm.reset(); toast.success('Comment added'); } catch (e) {toast.error(e instanceof Error ? e.message : 'Comment failed'); } });
  const saveVersion = async () => { try {await createVersion.mutateAsync({ text }); toast.success('Version submitted for review'); } catch (e) {toast.error(e instanceof Error ? e.message : 'Could not submit version'); } };
          const current = draftQuery.data;
          if (draftQuery.isLoading) return <LoadingCards />;
          if (draftQuery.isError) return <ApiFailure error={draftQuery.error} retry={() => draftQuery.refetch()} />;
          if (!current) return <Glass className="p-8">Draft not found. <Link href="/drafts" className="text-teal-600">Back to drafts</Link></Glass>;
  const filtered = findingList.filter((f) => findingFilter === 'All' || findingFilter === 'Rules' && f.source === 'rules' || findingFilter === 'AI-assisted' && f.source === 'ai' || findingFilter === 'Needs human review' && (f.confidence < .8 || f.fix_needs_human) || findingFilter === 'Resolved' && f.status !== 'open');
          return <div className="page-enter"><button onClick={() => history.back()} className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft size={14} />Back</button><PageHead eyebrow="Draft review room" title={current.title} sub={`DRAFT v${current.version} · ${current.status}`} action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { runReview.mutate(); toast('Running five-gate review…'); }} disabled={runReview.isPending} data-testid="button-run-review"><RefreshCw size={14} className={runReview.isPending ? 'animate-spin' : ''} />{runReview.isPending ? 'Reviewing…' : 'Run review'}</Button>{user?.role === 'reviewer' && current.status.toLowerCase() === 'in review' && (<Button disabled={draftHasExpiredFact} title={draftHasExpiredFact ? `Blocked by Gate 5: ${draftExpiredFinding?.source_ref_id} is expired. Renew fact to unblock publication.` : undefined} onClick={async () => { try { await api.approve(id); await client.invalidateQueries({ queryKey: keys.draft(id) }); await client.invalidateQueries({ queryKey: keys.drafts }); await client.invalidateQueries({ queryKey: keys.audit }); toast.success(`Draft "${current.title}" approved and locked`); } catch (e: any) { toast.error(e?.message || 'Approval failed'); } }} className="bg-teal-300 font-bold text-slate-950 hover:bg-teal-200"><LockKeyhole size={14} />Approve & lock version</Button>)}<Button onClick={saveVersion} data-testid="button-submit-review"><Send size={14} />Submit for review</Button></div>} />
            <div className="mb-3 flex gap-1 rounded-xl border border-border bg-card/45 p-1 lg:hidden">{(['editor', 'findings'] as const).map((tab) => <button key={tab} onClick={() => setMobileTab(tab)} className={`flex-1 rounded-lg py-2 text-xs font-bold capitalize ${mobileTab === tab ? 'bg-teal-300 text-slate-950' : 'text-muted-foreground'}`}>{tab === 'findings' ? `Findings · ${findingList.length}` : tab}</button>)}</div>
            {!canEdit && <Glass className="mb-4 p-4"><div className="flex items-center gap-2 text-xs font-bold"><LockKeyhole size={14} />Read-only draft view</div><p className="mt-1 text-[10px] text-muted-foreground">Creator-only edits and finding decisions are disabled for this role.</p></Glass>}
            <div className="grid gap-4 lg:grid-cols-[1.02fr_.98fr]">
              <div className={`${mobileTab === 'findings' ? 'hidden lg:block' : ''} grid min-w-0 gap-4 content-start`}>
                <Glass className="overflow-hidden"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div className="flex items-center gap-2"><FileText size={15} className="text-violet-500" /><span className="mono text-[10px] uppercase tracking-wider">Draft text · {text.length} chars</span></div><Tag tone="violet">v{current.version}</Tag></div><ErrorBoundary FallbackComponent={ErrorFallback} resetKey={id}><div className="relative"><div className="pointer-events-none absolute inset-0 soft-grid opacity-30" /><div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-300/[.04] to-transparent" /><HighlightedEditor value={text} onChange={setText} readOnly={!canEdit} /></div></ErrorBoundary></Glass>
                <Glass className="p-4 sm:p-5"><div className="flex items-center justify-between"><div><Eyebrow>Version history</Eyebrow><h3 className="display mt-1 font-bold">Saved checkpoints</h3></div><GitCompareArrows size={17} className="text-violet-500" /></div><div className="mt-4 flex flex-wrap gap-2">{(Array.isArray(versionsQuery.data) ? versionsQuery.data : []).map((v) => <div key={v.id} className="rounded-xl border border-border bg-background/45 px-3 py-2 text-left"><span className="mono block text-[10px]">v{v.version}</span><span className="mt-1 block text-[9px] text-muted-foreground">{time(v.created_at)}</span></div>)}{!(Array.isArray(versionsQuery.data) && versionsQuery.data.length) && <span className="text-xs text-muted-foreground">Versions will appear here after submission.</span>}</div><button onClick={async () => { const versions = Array.isArray(versionsQuery.data) ? versionsQuery.data : []; if (versions.length < 2) { toast('At least two saved versions are needed to compare.'); return; } try { const result = await api.diff(id, versions[versions.length - 2].version, versions[versions.length - 1].version); setDiffView({ before: result.before ?? versions[versions.length - 2].text, after: result.after ?? versions[versions.length - 1].text }); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load the diff'); } }} className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 dark:text-teal-200"><GitCompareArrows size={13} />Compare latest versions</button>{diffView && <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2"><div className="rounded-xl border border-rose-300/15 bg-rose-300/[.04] p-3"><Eyebrow>Previous</Eyebrow><p className="mt-2 whitespace-pre-wrap font-mono text-[10px] leading-5">{diffView.before}</p></div><div className="rounded-xl border border-teal-300/15 bg-teal-300/[.04] p-3"><Eyebrow>Current</Eyebrow><p className="mt-2 whitespace-pre-wrap font-mono text-[10px] leading-5">{diffView.after}</p></div></div>}</Glass>
                <Glass className="p-4 sm:p-5"><div className="flex gap-2">{['Versions', 'Comments', 'Activity'].map((t) => <button key={t} onClick={() => setSubtab(t)} className={`rounded-lg px-3 py-2 text-[10px] font-bold ${subtab === t ? 'bg-violet-300/15 text-violet-700 dark:text-violet-200' : 'text-muted-foreground hover:bg-white/5'}`}>{t}</button>)}</div>{subtab === 'Comments' ? <><div className="mt-3 grid gap-2">{(Array.isArray(commentsQuery.data) ? commentsQuery.data : []).map((comment) => <div key={comment.id} className="rounded-xl bg-background/45 p-3"><div className="flex justify-between text-[10px] font-bold"><span>{comment.author}</span><span className="text-muted-foreground">{time(comment.created_at)}</span></div><p className="mt-2 text-xs">{comment.text}</p></div>)}</div><form onSubmit={submitComment} className="mt-3 flex gap-2"><input {...commentForm.register('text')} placeholder="Add a review comment…" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background/50 px-3 text-xs" data-testid="input-comment" /><Button type="submit" className="px-3" aria-label="Send comment" data-testid="button-send-comment"><Send size={14} /></Button></form>{commentForm.formState.errors.text && <span className="text-[10px] text-rose-500">{commentForm.formState.errors.text.message}</span>}</> : <p className="mt-3 text-xs leading-5 text-muted-foreground">{subtab === 'Versions' ? 'New versions preserve each submitted draft and its review history.' : 'Actions and human decisions are added to the audit log.'}</p>}</Glass>
              </div>
              <div className={`${mobileTab === 'editor' ? 'hidden lg:block' : ''} grid min-w-0 content-start gap-4`}>
                <Glass className="p-4"><div className="flex items-center justify-between"><div><Eyebrow>Findings · {findingList.length}</Eyebrow><h3 className="display mt-1 font-bold">Evidence to review</h3></div><PanelRight size={17} className="text-muted-foreground" /></div><div className="mt-3 flex gap-1 overflow-x-auto pb-1">{['All', 'Rules', 'AI-assisted', 'Needs human review', 'Resolved'].map((f) => <button key={f} onClick={() => setFindingFilter(f)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[9px] font-bold ${findingFilter === f ? 'bg-violet-300/20 text-violet-700 dark:text-violet-200' : 'border border-border text-muted-foreground'}`}>{f}</button>)}</div></Glass>
                {findingsQuery.isLoading ? <LoadingCards /> : findingsQuery.isError ? <ApiFailure error={findingsQuery.error} retry={() => findingsQuery.refetch()} /> : filtered.length ? <div className="grid gap-3">{filtered.map((finding, index) => <FindingCard key={finding.id} finding={finding} draftId={id} index={index} canResolve={canEdit} />)}</div> : <Glass className="p-7 text-center"><BadgeCheck className="mx-auto text-teal-500" /><h3 className="display mt-2 font-bold">Nothing in this view</h3><p className="mt-1 text-xs text-muted-foreground">Try a different filter or run a review.</p></Glass>}
                <VerifierFunnel summary={runReview.data?.summary} dropped={Array.isArray(runReview.data?.dropped) ? runReview.data.dropped : []} findingsCount={findingList.length} />
                <Glass className="flex flex-wrap items-center justify-between gap-3 p-4 border-teal-300/20 bg-teal-300/[.04]">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-300/15 text-teal-600 dark:text-teal-200">
                      <ShieldCheck size={17} />
                    </span>
                    <div>
                      <b className="text-xs text-foreground">AI suggests; humans decide.</b>
                      <p className="text-[10px] leading-4 text-muted-foreground">
                        Every finding is cited, verified against Brand Kit ground truth, and human-approved.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mono text-[9px] text-muted-foreground">
                    <span className="rounded-md border border-teal-300/30 bg-teal-300/10 px-2 py-0.5 text-teal-600 dark:text-teal-300 font-bold">
                      Five-Gate Engine: Online
                    </span>
                    <span>Audit ref: rev-{id}</span>
                  </div>
                </Glass>
              </div>
            </div>
          </div>;
}

          function ReviewQueuePage() {
  const { data, isLoading, isError, error, refetch } = useDrafts();
  const user = useSession((s) => s.user);
  const demoRole = useSession((s) => s.demoRole);
  const draftsList = Array.isArray(data) ? data : [];
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [justApproved, setJustApproved] = useState<{ id: string; title: string; version: number } | null>(null);
  const client = useQueryClient();
  const pending = draftsList.filter((draft) => draft.status.toLowerCase() === 'in review');
  useEffect(() => {
    if (pending.length && (!selected || !pending.some((d) => d.id === selected))) {
      setSelected(pending[0].id);
    } else if (!pending.length) {
      setSelected(null);
    }
  }, [selected, pending]);
  const draft = pending.find((item) => item.id === selected);
  const reviewDecision = useReviewDecision(selected || '');
  const reviewerComment = useAddComment(selected || '');
  const decisionForm = useForm<{ reason: string }>({ resolver: zodResolver(changesSchema), defaultValues: { reason: '' } });

  const versionsQuery = useVersions(draft?.id || '');
  const versionsList = Array.isArray(versionsQuery.data) ? versionsQuery.data : [];
  const prevVersion = versionsList.find((v) => v.version === (draft?.version || 1) - 1) || (versionsList.length > 1 ? versionsList[versionsList.length - 2] : null);
  const prevText = prevVersion?.text || (draft?.id === 'draft-2' ? "Join Lumen Pay today and get guaranteed unlimited cashback on every payment this year." : "Initial draft snapshot");

  const findingsQuery = useFindings(draft?.id || '');
  const allFindings = Array.isArray(findingsQuery.data) ? findingsQuery.data : [];
  const openFindings = allFindings.filter((f) => f.status === 'open');
  const resolvedFindings = allFindings.filter((f) => f.status !== 'open');
  const brandKitQuery = useBrandKit();
  const facts = brandKitQuery.data?.facts || [];
  const expiredFinding = allFindings.find((item) => {
    if (item.status !== 'open') return false;
    const citedFact = facts.find((f: any) => f.id === item.source_ref_id || f.fact_code === item.source_ref_id);
    const exp = citedFact ? getFactExpiry(citedFact.expires_on || citedFact.review_date) : null;
    return item.verification_status === 'blocked_expired_fact' || Boolean(exp?.isExpired);
  });
  const hasExpiredFact = Boolean(expiredFinding);
  const expiredFact = facts.find((f) => f.id === expiredFinding?.source_ref_id);

  const saveReviewerNote = async () => {
    if (!draft || !note.trim()) return;
    await reviewerComment.mutateAsync({ text: note.trim() });
  };
  const approve = async () => {
    if (user?.role !== 'reviewer') {
      toast.error('Only reviewers can approve a draft. Click "Switch to Nisha (Reviewer)" above.');
      return;
    }
    if (!draft) return;
    try {
      if (note.trim()) {
        await saveReviewerNote();
      }
      const approvedDraft = { id: draft.id, title: draft.title, version: draft.version };
      await reviewDecision.approve.mutateAsync();
      setJustApproved(approvedDraft);
      await client.invalidateQueries({ queryKey: keys.drafts });
      await client.invalidateQueries({ queryKey: keys.audit });
      await client.invalidateQueries({ queryKey: keys.comments(draft.id) });
      toast.success(`Draft "${approvedDraft.title}" approved and locked (v${approvedDraft.version})`);
      setNote('');
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : 'Approval failed');
    }
  };
  const request = decisionForm.handleSubmit(async ({ reason }) => {
    if (!draft) return;
    try {
      await saveReviewerNote();
      await reviewDecision.requestChanges.mutateAsync({ reason });
      await client.invalidateQueries({ queryKey: keys.comments(draft.id) });
      toast.success('Changes requested');
      setRequestOpen(false);
      decisionForm.reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not request changes');
    }
  });

  return (
    <div className="page-enter">
      <PageHead
        eyebrow="Reviewer desk"
        title="Review with full provenance."
        sub="Compare submitted diffs, verify brand kit evidence, leave sign-off context, and lock approved releases."
      />

      {user?.role !== 'reviewer' && (
        <Glass className="mb-5 border-amber-300/25 bg-amber-300/[.07] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400/20 text-amber-600 dark:text-amber-200">
              <LockKeyhole size={16} />
            </span>
            <div>
              <b className="text-xs text-foreground">Reviewer desk is locked for {roleName(user?.role)}</b>
              <p className="text-[11px] text-muted-foreground">Approval actions and change requests require a Reviewer session.</p>
            </div>
          </div>
          <Button
            onClick={() => { demoRole('reviewer'); toast.success('Switched to Nisha Rao (Reviewer)'); }}
            className="px-3.5 py-2 text-xs font-bold"
          >
            <UserCheck size={14} /> Switch to Nisha (Reviewer)
          </Button>
        </Glass>
      )}

      {isLoading ? (
        <LoadingCards />
      ) : isError ? (
        <ApiFailure error={error} retry={() => refetch()} />
      ) : pending.length ? (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Glass className="p-4">
            <Eyebrow>Queue · {pending.length}</Eyebrow>
            <div className="mt-3 grid gap-2">
              {pending.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelected(item.id)}
                  className={`rounded-xl border p-3 text-left transition ${selected === item.id ? 'border-teal-300/35 bg-teal-300/[.08]' : 'border-border hover:bg-white/5'}`}
                >
                  <b className="block truncate text-xs">{item.title}</b>
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    v{item.version} · {item.findings_count ?? 0} {(item.findings_count ?? 0) === 1 ? 'finding' : 'findings'}
                  </span>
                </button>
              ))}
            </div>
          </Glass>

          {draft ? (
            <div className="grid content-start gap-4">
              <Glass className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Eyebrow>Submitted version · v{draft.version}</Eyebrow>
                    <h2 className="display mt-1 text-xl font-bold">{draft.title}</h2>
                  </div>
                  <Tag tone="violet">In review</Tag>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background/35 p-4">
                    <div className="flex items-center justify-between">
                      <Eyebrow>Previous snapshot · v{(draft.version || 2) - 1}</Eyebrow>
                      <Tag tone="neutral">Before</Tag>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap font-mono text-xs leading-6 text-muted-foreground border-l-2 border-rose-400/40 pl-3 bg-rose-400/[.03] py-2 rounded-r-lg">
                      {prevText}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-teal-300/20 bg-teal-300/[.04] p-4">
                    <div className="flex items-center justify-between">
                      <Eyebrow>Submitted draft · v{draft.version}</Eyebrow>
                      <Tag tone="teal">After (Submitted)</Tag>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap font-mono text-xs leading-6 text-foreground border-l-2 border-teal-400 pl-3 bg-teal-400/[.05] py-2 rounded-r-lg">
                      {draft.text}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <GitCompareArrows size={14} className="text-teal-500" />
                  Red/green version diff generated from previous iteration. Confirm all claims before final approval.
                </div>
              </Glass>

              <Glass className="p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Eyebrow>Finding context</Eyebrow>
                    <h3 className="display mt-1 text-lg font-bold">
                      {openFindings.length} open {openFindings.length === 1 ? 'finding' : 'findings'}
                      {resolvedFindings.length > 0 && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          ({resolvedFindings.length} resolved)
                        </span>
                      )}
                    </h3>
                  </div>
                  <Link href={`/drafts/${draft.id}`} className="text-xs font-bold text-teal-600 dark:text-teal-200 hover:underline">
                    Open full review <ArrowUpRight size={13} className="inline" />
                  </Link>
                </div>

                <div className="mt-4 grid gap-3">
                  {allFindings.map((item) => {
                    const citedFact = facts.find((f) => f.id === item.source_ref_id);
                    const exp = citedFact ? getFactExpiry(citedFact.review_date) : null;
                    const isExpired = item.verification_status === 'blocked_expired_fact' || Boolean(exp?.isExpired);
                    return (
                      <div key={item.id} className="rounded-2xl border border-border bg-background/35 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Tag tone={item.severity === 'high' ? 'rose' : 'amber'}>{item.severity}</Tag>
                            {item.status !== 'open' ? <Tag tone="teal">Resolved</Tag> : <Tag tone="neutral">Open</Tag>}
                            {isExpired && <Tag tone="rose">⚠️ Source Expired ({exp ? `${exp.days}d ago` : 'Expired'}) · Gate 5 Lock</Tag>}
                          </div>
                          <span className="mono text-xs font-bold text-violet-600 dark:text-violet-200">{item.source_ref_id}</span>
                        </div>
                        <p className="mt-3 font-mono text-xs font-semibold text-foreground">“{item.excerpt}”</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.reason}</p>
                        {item.suggested_fix && (
                          <div className="mt-3 rounded-xl bg-white/[.04] p-2.5 text-xs">
                            <span className="text-muted-foreground">Suggested fix: </span>
                            <span className="font-semibold text-teal-600 dark:text-teal-200">{item.suggested_fix}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!allFindings.length && (
                    <p className="text-xs text-muted-foreground">All findings on this draft have been verified and resolved.</p>
                  )}
                </div>
              </Glass>

              <Glass className="p-5 sm:p-6">
                <Eyebrow>Reviewer note</Eyebrow>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Leave governance context for this decision (logged to audit trail)…"
                  className="mt-3 w-full rounded-xl border border-border bg-background/40 p-3 text-xs outline-none focus:border-teal-400"
                  data-testid="input-review-note"
                />
                {hasExpiredFact && (
                  <div className="mt-3 rounded-xl border border-rose-300/30 bg-rose-400/10 p-3 text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2.5">
                    <ShieldAlert size={16} className="shrink-0 text-rose-500" />
                    <span>
                      <b>Blocked by Gate 5:</b> Fact {expiredFinding?.source_ref_id} expired on {expiredFact?.review_date || 'review date'}. Renew the fact in Brand Kit to unblock publication.
                    </span>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap justify-end gap-2.5">
                  <Button variant="outline" onClick={() => setRequestOpen(true)} disabled={user?.role !== 'reviewer'} data-testid="button-request-changes">
                    Request changes
                  </Button>
                  <Button
                    onClick={approve}
                    disabled={user?.role !== 'reviewer' || hasExpiredFact}
                    title={hasExpiredFact ? `Blocked by Gate 5: ${expiredFinding?.source_ref_id} expired on ${expiredFact?.review_date}. Renew fact to unblock publication.` : undefined}
                    data-testid="button-approve"
                  >
                    <LockKeyhole size={14} /> Approve & lock version
                  </Button>
                </div>
                {requestOpen && (
                  <form onSubmit={request} className="mt-4 grid gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[.05] p-4">
                    <TextArea label="What should the creator change? (10 characters minimum)" rows={3} {...decisionForm.register('reason')} error={decisionForm.formState.errors.reason?.message} data-testid="input-change-reason" />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setRequestOpen(false)}>Cancel</Button>
                      <Button type="submit">Send changes request</Button>
                    </div>
                  </form>
                )}
              </Glass>
            </div>
          ) : (
            <Glass className="p-9 text-center border-teal-300/30 bg-teal-300/[.05]">
              <BadgeCheck className="mx-auto h-12 w-12 text-teal-500" />
              <h2 className="display mt-3 text-xl font-bold">Release locked and approved!</h2>
              {justApproved ? (
                <p className="mt-1 text-sm text-foreground">
                  <b>{justApproved.title} (v{justApproved.version})</b> has been signed off and recorded in the permanent audit trail.
                </p>
              ) : (
                <p className="mt-1 text-sm text-foreground">All submitted drafts have been verified and locked.</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Reviewer sign-off complete. All open findings verified against approved Brand Kit facts.</p>
              <div className="mt-5 flex justify-center gap-3">
                <Link href="/audit" className="inline-flex items-center gap-2 rounded-xl bg-teal-300 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-teal-200">
                  <History size={14} /> View in Audit log
                </Link>
                <Link href="/drafts" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-bold hover:bg-white/5">
                  <FileText size={14} /> View all drafts
                </Link>
              </div>
            </Glass>
          )}
        </div>
      ) : (
        <Glass className="p-9 text-center">
          <BadgeCheck className="mx-auto text-teal-500" />
          <h2 className="display mt-3 text-xl font-bold">Queue is clear.</h2>
          <p className="mt-2 text-sm text-muted-foreground">No drafts currently in review. Submit a draft from the drafts workspace.</p>
        </Glass>
      )}
      <Glass className="mt-4 flex items-center gap-3 p-4">
        <LockKeyhole className="text-teal-500" size={17} />
        <p className="text-xs text-muted-foreground">Approved versions are locked and tamper-evident. Every reviewer decision becomes part of the permanent audit trail.</p>
      </Glass>
    </div>
  );
}

// GapRadarPage is imported from @/pages/gap-radar

// AuditPage is imported from @/pages/audit

const workflow = [
          ['01', 'Brand kit', 'A Brand Manager loads guidelines, approved facts with a source and review date, and terminology.', 'Brand Manager'],
          ['02', 'Draft', 'A creator pastes copy or uploads plain text. An external-AI notice explains what is sent.', 'Creator'],
          ['03', 'Review', 'Rules and an AI reviewer propose issues; a verifier drops anything without a valid source and real excerpt.', 'CiteCheck'],
          ['04', 'Resolve', 'The creator sees the reason, source, and before/after fix. Accept, edit, or dismiss with a reason.', 'HUMAN CHECKPOINT'],
          ['05', 'Submit', 'A new version is saved with a diff and an audit trail.', 'Creator'],
          ['06', 'Decide', 'A reviewer comments, approves, or requests changes. Approved versions are locked.', 'HUMAN CHECKPOINT'],
          ['07', 'Learn', 'Dismissals feed the Gap Radar so unclear rules can be improved.', 'Brand Manager'],
          ];
          function HowItWorksPage() {
  const gates = [
    { num: 'Gate 1', title: 'Strict JSON Schema', desc: 'Validates field types, ranges, enums, and required properties. Rejects unparseable candidate outputs immediately.' },
    { num: 'Gate 2', title: 'Source Existence ("No source, no finding")', desc: 'Checks that cited fact_code (FACT-XX) or guideline_code actually exists in the active Brand Kit database. Hallucinated codes are dropped.' },
    { num: 'Gate 3', title: 'Verbatim Exact Quote', desc: 'Normalizes whitespace and smart quotes, then verifies that the exact excerpt exists verbatim in the draft. Hallucinated quotes are dropped.' },
    { num: 'Gate 4', title: 'Fix Guardrails (Tamper Guard)', desc: 'Extracts numbers, percentages, currency, and dates from excerpt vs fix. Unauthorized metric alterations flag mandatory human review.' },
    { num: 'Gate 5', title: 'Freshness & Confidence Routing', desc: 'Blocks publication for claims citing expired facts (e.g. FACT-11). Routes low-confidence findings (<0.80) to human reviewers.' },
  ];

  return (
    <div className="page-enter">
      <PageHead
        eyebrow="Architectural Transparency"
        title="AI suggests. Humans decide."
        sub="Seven explicit steps, two mandatory human checkpoints, and evidence-grounded verification."
      />

      <Glass className="mb-6 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Eyebrow>Governance Pipeline</Eyebrow>
            <h2 className="display mt-1 text-xl font-bold">The 5 Pipeline Stages</h2>
          </div>
          <Tag tone="teal">5 pipeline stages</Tag>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {['Draft text (.docx / .md)', 'Deterministic rules', 'LLM reviewer', 'Five-gate verifier', 'Verified findings UI'].map((name, index) => (
            <div key={name} className="relative rounded-2xl border border-border bg-background/50 p-4">
              <span className="mono text-[10px] text-teal-600 dark:text-teal-300 font-bold">STAGE 0{index + 1}</span>
              <div className="mt-2 text-xs font-bold text-foreground">{name}</div>
              {index < 4 && (
                <ArrowRight size={14} className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 text-muted-foreground sm:block" />
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-6 text-muted-foreground">
          Every candidate finding produced by the dual analysis engine must pass through the automated Five-Gate Evidence Verifier before reaching human eyes.
        </p>
      </Glass>

      <Glass className="mb-8 border-violet-300/30 bg-violet-300/[.06] p-5 sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <Eyebrow>Evidence-Grounded Verification</Eyebrow>
            <h2 className="display mt-1 text-xl font-bold">The Five Automated Evidence Gates</h2>
          </div>
          <Tag tone="violet">Evidence verifier</Tag>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-5">
          {gates.map((g) => (
            <div key={g.num} className="rounded-2xl border border-border/80 bg-background/60 p-4">
              <span className="mono text-[10px] font-bold text-violet-600 dark:text-violet-300 uppercase">{g.num}</span>
              <h4 className="mt-1.5 text-xs font-bold text-foreground">{g.title}</h4>
              <p className="mt-2 text-[10px] leading-5 text-muted-foreground">{g.desc}</p>
            </div>
          ))}
        </div>
      </Glass>

      <div className="relative ml-2 grid gap-3 border-l border-teal-300/25 pl-6 sm:ml-6 sm:pl-9">
        {workflow.map(([n, title, desc, owner]) => (
          <div key={n} className="relative">
            <span className="absolute -left-[31px] top-5 grid h-8 w-8 place-items-center rounded-xl border border-teal-300/25 bg-background text-[10px] font-bold text-teal-600 dark:text-teal-200 sm:-left-[44px]">
              {n}
            </span>
            <Glass className={`glass-hover grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5 ${owner.includes('CHECKPOINT') ? 'border-amber-300/25' : ''}`}>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="display text-lg font-bold">{title}</h3>
                  {owner.includes('CHECKPOINT') && <Tag tone="amber">Human checkpoint</Tag>}
                </div>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">{desc}</p>
              </div>
              <span className={`mono text-[9px] uppercase tracking-wider ${owner.includes('CHECKPOINT') ? 'text-amber-600 dark:text-amber-200' : 'text-muted-foreground'}`}>
                {owner}
              </span>
            </Glass>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[['Creator', 'Catch issues in the copy. Preserve intent. Resolve evidence.'], ['Brand Manager', 'Keep facts current. Manage expiration dates. Inspect Gap Radar.'], ['Reviewer', 'Compare version diffs. Review notes. Lock approved releases.']].map(([role, desc]) => (
          <Glass key={role} className="p-5">
            <Eyebrow>Role Contract · {role}</Eyebrow>
            <p className="display mt-2 text-base font-bold text-foreground">{desc}</p>
          </Glass>
        ))}
      </div>
    </div>
  );
}

function SettingsPage() {
  const theme = useSession((s) => s.theme);
  const setTheme = useSession((s) => s.setTheme);
  const reduced = useSession((s) => s.reducedMotion);
  const setReduced = useSession((s) => s.setReducedMotion);
  const demoRole = useSession((s) => s.demoRole);
  const user = useSession((s) => s.user);
  const [explode, setExplode] = useState(false);

  return (
    <div className="page-enter">
      <PageHead eyebrow="Your workspace" title="Settings" sub="Manage display atmosphere, role permissions, and governance safeguards." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Glass className="p-5 sm:p-7">
          <Eyebrow>Appearance</Eyebrow>
          <h2 className="display mt-2 text-xl font-bold">Choose your atmosphere.</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ['dark', 'Aurora Night', Moon],
              ['light', 'Frosted Day', Sun],
            ].map(([t, label, Icon]) => (
              <button
                key={String(t)}
                onClick={() => setTheme(t as 'dark' | 'light')}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left cursor-pointer transition ${theme === t ? 'border-teal-300/35 bg-teal-300/[.08]' : 'border-border hover:bg-white/5'}`}
              >
                <Icon size={17} className="text-teal-500" />
                <span>
                  <b className="block text-sm">{String(label)}</b>
                  <span className="text-[10px] text-muted-foreground">Theme</span>
                </span>
                {theme === t && <Check size={15} className="ml-auto text-teal-500" />}
              </button>
            ))}
          </div>
          <label className="mt-5 flex items-center justify-between rounded-xl border border-border p-4">
            <span>
              <b className="block text-sm">Reduced motion</b>
              <span className="text-[10px] text-muted-foreground">Minimize transitions and ambient movement</span>
            </span>
            <input
              type="checkbox"
              checked={reduced}
              onChange={(e) => {
                setReduced(e.target.checked);
                document.documentElement.classList.toggle('reduce-motion', e.target.checked);
              }}
              className="h-4 w-4 accent-teal-400"
              data-testid="toggle-reduced-motion"
            />
          </label>
        </Glass>

        <Glass className="p-5 sm:p-7">
          <Eyebrow>Responsible AI</Eyebrow>
          <h2 className="display mt-2 text-xl font-bold">What leaves this room.</h2>
          <div className="mt-5 grid gap-3">
            {[
              ['External AI notice', 'Draft text and relevant brand rules are processed with zero retention.'],
              ['Synthetic demo content', 'Lumen Pay examples are fictional. No real customer PII is ever used.'],
              ['Role-based access', 'Creator, Reviewer, and Brand Manager boundaries are enforced.'],
              ['Decision audit', 'Accept, edit, dismiss, and approvals are logged permanently.'],
              ['Human decision', 'AI suggestions do not publish, edit, or approve content without human sign-off.'],
            ].map(([title, desc]) => (
              <div key={title} className="flex gap-3 rounded-xl bg-background/40 p-3">
                <CheckCheck size={15} className="mt-0.5 shrink-0 text-teal-500" />
                <div>
                  <b className="text-xs">{title}</b>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Glass>

        <details className="lg:col-span-2 group rounded-2xl border border-border bg-card/40 p-4 transition">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center justify-between">
            <span>Developer & Diagnostics (Advanced)</span>
            <ChevronDown size={15} className="group-open:rotate-180 transition-transform text-muted-foreground" />
          </summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-2 pt-3 border-t border-border/60">
            <div className="rounded-xl border border-border/70 bg-background/35 p-4">
              <Eyebrow>Connection</Eyebrow>
              <h3 className="text-sm font-bold mt-1">API Endpoint</h3>
              <input value={API_BASE_URL} readOnly className="mt-3 h-9 w-full rounded-lg border border-border bg-background/50 px-3 font-mono text-xs text-foreground" />
              <p className="mt-2 text-[10px] text-muted-foreground">Connected to serverless backend runtime.</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/35 p-4">
              <Eyebrow>Recovery Diagnostic</Eyebrow>
              <h3 className="text-sm font-bold mt-1">Simulate View Interruption</h3>
              <Button variant="outline" className="mt-3 text-xs" onClick={() => setExplode(true)} data-testid="button-simulate-error">
                Trigger Graceful Fallback
              </Button>
              {explode && (
                <ErrorBoundary key="simulated" FallbackComponent={({ error, resetError }) => (
                  <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-xs">
                    <b>Simulated recovery active:</b> {error.message}
                    <Button className="mt-2 text-xs" onClick={() => { resetError(); setExplode(false); }}>Reset</Button>
                  </div>
                )}>
                  <DeveloperCrash />
                </ErrorBoundary>
              )}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
          function DeveloperCrash(): ReactNode { throw new Error('Simulated developer preview error. Your work is still safe.'); }

          function NotFoundPage() { return <div className="mx-auto max-w-xl py-16 text-center"><Glass className="p-10"><span className="display text-6xl font-bold text-teal-500">404</span><h1 className="display mt-4 text-2xl font-bold">This page needs a source.</h1><p className="mt-2 text-sm text-muted-foreground">We couldn't find the destination you requested.</p><Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-bold text-slate-950">Return to workspace</Link></Glass></div>; }

function RoutedPages() {
  const [location, setPath] = useLocation();
  const user = useSession((s) => s.user);
  const setSession = useSession((s) => s.setSession);
  const theme = useSession((s) => s.theme);
  const editorMatch = location.match(/^\/drafts\/([^/]+)$/);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Handle Supabase OAuth return (hash fragments like #access_token=... or code=...)
  useEffect(() => {
    let mounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    (async () => {
      const sb = await initSupabase();
      if (!sb || !mounted) return;

      // 1. Check existing Supabase session (from OAuth redirect or stored session)
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (session && session.user && !useSession.getState().user) {
          const email = session.user.email || '';
          const rawRole = (session.user.user_metadata?.role as Role) || (localStorage.getItem('citecheck_oauth_role') as Role) || 'creator';
          const role: Role = ['creator', 'brand_manager', 'reviewer'].includes(rawRole) ? rawRole : 'creator';
          const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split('@')[0] || 'Google User';

          setSession(session.access_token, {
            id: session.user.id,
            name,
            role,
          });
          toast.success(`Welcome, ${name}`);
          if (location === '/' || location === '/login') {
            setPath('/dashboard');
          }
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }
      } catch (err) {
        console.warn('Error reading initial session:', err);
      }

      // 2. Listen for auth state changes (OAuth callbacks, token refreshes, signouts)
      const { data: authListener } = sb.auth.onAuthStateChange(async (event, newSession) => {
        if (!mounted) return;
        if (event === 'SIGNED_IN' && newSession?.user) {
          const email = newSession.user.email || '';
          const rawRole = (newSession.user.user_metadata?.role as Role) || (localStorage.getItem('citecheck_oauth_role') as Role) || 'creator';
          const role: Role = ['creator', 'brand_manager', 'reviewer'].includes(rawRole) ? rawRole : 'creator';
          const name = newSession.user.user_metadata?.full_name || newSession.user.user_metadata?.name || email.split('@')[0] || 'Google User';

          const currentUser = useSession.getState().user;
          // Only re-set session and redirect if user identity changed or not yet set
          if (!currentUser || currentUser.id !== newSession.user.id) {
            setSession(newSession.access_token, {
              id: newSession.user.id,
              name,
              role,
            });
            toast.success(`Welcome, ${name}`);
            setPath('/dashboard');
            if (window.location.hash) {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          try {
            localStorage.removeItem('citecheck_token');
            localStorage.removeItem('citecheck_user');
            localStorage.removeItem('citecheck_oauth_role');
            sessionStorage.clear();
          } catch {}
          if (useSession.getState().user || useSession.getState().token) {
            useSession.setState({ token: null, user: null, selectedFinding: null });
          }
        }
      });

      authSubscription = authListener?.subscription;
    })();

    return () => {
      mounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  // When not logged in, keep ONLY the clean login view and hide everything else (no header, no sidebar, no dock)
  if (!user) {
    return (
      <div className="app-atmosphere min-h-[100dvh] flex items-center justify-center p-4 sm:p-8 relative">
        <div className="aurora-orb orb-teal" />
        <div className="aurora-orb orb-violet" />
        <div className="aurora-orb orb-amber" />
        <div className="w-full max-w-5xl relative z-10">
          <ErrorBoundary resetKey={location} FallbackComponent={ErrorFallback}>
            <LoginPage />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  // Once user successfully logs in, show the complete workspace with AppShell (header, sidebar, workspace)
  return (
    <AppShell>
      <ErrorBoundary resetKey={location} FallbackComponent={ErrorFallback}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/login" component={Dashboard} />
          <Route path="/brand-kit" component={BrandKitPage} />
          <Route path="/drafts" component={DraftsPage} />
          <Route path="/drafts/new" component={NewDraftPage} />
          {editorMatch && <Route path="/drafts/:id"><DraftEditorPage id={editorMatch[1]} /></Route>}
          <Route path="/review" component={ReviewQueuePage} />
          <Route path="/verifier-lab" component={VerifierLabPage} />
          <Route path="/gap-radar" component={GapRadarPage} />
          <Route path="/audit" component={AuditPage} />
          <Route path="/how-it-works" component={HowItWorksPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFoundPage} />
        </Switch>
      </ErrorBoundary>
    </AppShell>
  );
}

          function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RoutedPages /></WouterRouter><Toaster /></QueryClientProvider>;
}

          export default App;
