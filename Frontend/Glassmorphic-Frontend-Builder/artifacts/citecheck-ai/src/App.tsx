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
  Sun, Moon, Upload, X,
} from 'lucide-react';
import { api, API_BASE_URL } from '@/lib/api/endpoints';
import { sampleText } from '@/lib/api/fixtures';
import type { Draft, Finding, Role } from '@/lib/api/types';
import { useSession } from '@/store/session';
import { useAddComment, useAuditLog, useBrandKit, useComments, useCreateDraft, useCreateVersion, useDecision, useDraft, useDrafts, useFindings, useGapRadar, useReviewDecision, useReviewRun, useVersions, keys } from '@/hooks/use-product-data';
import { changesSchema, commentSchema, dismissSchema, draftSchema, editSchema, kitItemSchema, loginSchema } from '@/lib/schemas';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true }, mutations: { retry: 0 } } });
const nav = [
  { href: '/dashboard', label: 'Overview', icon: Home },
  { href: '/drafts', label: 'Drafts', icon: FileText },
  { href: '/brand-kit', label: 'Brand kit', icon: Layers3 },
  { href: '/review', label: 'Review queue', icon: CheckCheck, roles: ['reviewer'] },
  { href: '/gap-radar', label: 'Gap Radar', icon: Radar, roles: ['brand_manager'] },
  { href: '/audit', label: 'Audit log', icon: History },
];
const roleName = (role?: Role) => role === 'brand_manager' ? 'Brand Manager' : role === 'reviewer' ? 'Reviewer' : 'Creator';
const time = (value?: string) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

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

function AppShell({ children }: { children: ReactNode }) {
  const [path, setPath] = useLocation();
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  const theme = useSession((s) => s.theme);
  const setTheme = useSession((s) => s.setTheme);
  const { data: commandDraftsRaw } = useDrafts();
  const commandDrafts = Array.isArray(commandDraftsRaw) ? commandDraftsRaw : [];
  const [palette, setPalette] = useState(false);
  const [more, setMore] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPalette((v) => !v); }
      if (event.key === 'Escape') { setPalette(false); setMore(false); }
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
          {user ? <button onClick={() => { logout(); toast.success('Signed out'); go('/login'); }} className="flex items-center gap-2 rounded-xl border border-border bg-card/50 px-3 py-2 text-left text-xs hover:bg-card" data-testid="button-logout"><span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-300/15 font-bold text-violet-600 dark:text-violet-200">{user.name.split(' ').map((v) => v[0]).join('')}</span><span><b className="block text-foreground">{user.name}</b><span className="text-muted-foreground">{roleName(user.role)}</span></span></button> : <Link href="/login" className="rounded-xl bg-teal-300 px-4 py-2 text-xs font-bold text-slate-950">Sign in</Link>}
        </div>
        <div className="flex items-center gap-2 md:hidden"><button onClick={() => setPalette(true)} aria-label="Search" className="rounded-xl border border-border p-2"><Search size={16} /></button><button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme" className="rounded-xl border border-border p-2">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button></div>
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
      <main className="min-w-0 flex-1 px-4 pb-32 pt-7 sm:px-7 lg:px-8 lg:pb-32">{children}</main>
    </div>
    {user && <nav aria-label="Quick navigation" className="dock-shell fixed bottom-5 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-1 rounded-[1.35rem] border border-white/15 bg-slate-950/80 p-2 text-white backdrop-blur-2xl lg:flex">{visibleNav.slice(0, 5).map(({ href, label, icon: Icon }) => <Link key={href} href={href} title={label} aria-label={label} className={`group grid h-12 w-12 place-items-center rounded-2xl transition duration-200 hover:-translate-y-2 hover:scale-[1.18] hover:bg-white/10 ${path === href ? 'bg-teal-300 text-slate-950 shadow-lg shadow-teal-300/15' : 'text-white/70'}`}><Icon size={19} /></Link>)}<Link href="/settings" title="Settings" aria-label="Settings" className="grid h-12 w-12 place-items-center rounded-2xl text-white/70 transition hover:-translate-y-2 hover:scale-[1.18] hover:bg-white/10"><Settings2 size={19} /></Link></nav>}
    {user && <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border/70 bg-background/85 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-2xl lg:hidden">{visibleNav.slice(0, 4).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`grid justify-items-center gap-1 py-1 text-[9px] font-bold ${path === href ? 'text-teal-600 dark:text-teal-200' : 'text-muted-foreground'}`}><Icon size={19} /><span>{label.split(' ')[0]}</span></Link>)}<button onClick={() => setMore(true)} className="grid justify-items-center gap-1 py-1 text-[9px] font-bold text-muted-foreground"><MoreHorizontal size={19} />More</button></nav>}
  { more && <div className="fixed inset-0 z-50 flex items-end bg-slate-950/55 p-3 backdrop-blur-sm lg:hidden" onClick={() => setMore(false)}><div className="glass w-full rounded-[1.7rem] p-5" onClick={(e) => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h3 className="display text-lg font-bold">More in workspace</h3><button onClick={() => setMore(false)} aria-label="Close menu"><X /></button></div><div className="grid grid-cols-2 gap-2">{[...visibleNav.slice(4), { href: '/how-it-works', label: 'How it works', icon: BookOpen }, { href: '/settings', label: 'Settings', icon: Settings2 }, { href: '/login', label: 'Switch role', icon: LogIn }].map(({ href, label, icon: Icon }) => <button key={href} onClick={() => go(href)} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3 text-left text-sm"><Icon size={16} />{label}</button>)}</div></div></div> }
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

function LoginPage() {
  const [, setPath] = useLocation();
  const setSession = useSession((s) => s.setSession);
  const demoRole = useSession((s) => s.demoRole);
  const form = useForm<{ email: string; password: string; role: Role }>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'meera@lumenpay.example', password: 'demo-pass', role: 'creator' }
  });
  const [busy, setBusy] = useState(false);

  const choose = (role: Role) => {
    form.setValue('role', role);
    const email = role === 'creator' ? 'meera@lumenpay.example' : role === 'reviewer' ? 'nisha@lumenpay.example' : 'arjun@lumenpay.example';
    form.setValue('email', email);
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
          <Button disabled={busy} type="submit" className="mt-2 w-full bg-teal-400 text-slate-950 font-bold hover:bg-teal-300 py-3.5 text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer" data-testid="button-login">
            {busy ? "Connecting..." : "Continue"} <ArrowRight size={16} />
          </Button>
        </form>

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
  const draftsList = Array.isArray(data) ? data : [];
  const openFindingCount = draftsList.reduce((sum, item) => sum + (item.findings_count || 0), 0);
  const statusCount = (status: string) => draftsList.filter((d) => d.status.toLowerCase() === status.toLowerCase()).length;
  const user = useSession((s) => s.user);
      return <div className="page-enter"><PageHead eyebrow={`${roleName(user?.role)} workspace`} title="Good work starts with a source." sub="A live view of drafts, decisions, and what's waiting for a human." action={<Link href="/drafts/new" className="inline-flex items-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:-translate-y-1"><Plus size={16} />New draft</Link>} />
        {isLoading ? <LoadingCards /> : isError ? <ApiFailure error={error} retry={() => refetch()} /> : <div className="grid gap-4 md:grid-cols-4">
          <Glass className="glass-hover col-span-2 p-5 sm:p-6"><div className="flex items-center justify-between"><Eyebrow>Draft pulse</Eyebrow><Link href="/drafts" className="text-xs font-bold text-teal-600 dark:text-teal-200">All drafts <ArrowUpRight size={14} className="inline" /></Link></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Draft', statusCount('Draft'), 'text-muted-foreground'], ['In review', statusCount('In review'), 'text-violet-500'], ['Changes requested', statusCount('Changes requested'), 'text-amber-600'], ['Approved', statusCount('Approved'), 'text-teal-600']].map(([label, value, color]) => <div key={String(label)} className="rounded-2xl border border-border/70 bg-background/35 p-3"><div className={`display text-3xl font-bold ${color}`}>{isLoading ? '—' : value}</div><div className="mt-1 text-[10px] leading-4 text-muted-foreground">{label}</div></div>)}</div><div className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-teal-300" />Counts reflect the connected API response.</div></Glass>
          <Glass className="glass-hover p-5 sm:p-6"><div className="flex items-center justify-between"><Eyebrow>Open findings</Eyebrow><Flag size={16} className="text-amber-500" /></div><div className="display mt-4 text-4xl font-bold">{openFindingCount}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Findings reported across loaded drafts. Check each excerpt before you decide.</p><Link href="/drafts" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-200">Review drafts <ArrowRight size={13} /></Link></Glass>
          <Glass className="glass-hover p-5 sm:p-6"><div className="flex items-center justify-between"><Eyebrow>Human review</Eyebrow><Sparkles size={16} className="text-violet-500" /></div><div className="display mt-4 text-4xl font-bold">{draftsList.filter((d) => d.status.toLowerCase() === 'in review').length}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Submitted items waiting for a reviewer decision.</p><Link href="/review" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-200">Open queue <ArrowRight size={13} /></Link></Glass>
          <Glass className="col-span-2 p-5 sm:p-6"><div className="flex items-center justify-between"><div><Eyebrow>Recent work</Eyebrow><h2 className="display mt-1 text-xl font-bold">Drafts in motion</h2></div><Activity size={17} className="text-teal-500" /></div><div className="mt-4 divide-y divide-border/60">{draftsList.slice(0, 4).map((draft) => <Link key={draft.id} href={`/drafts/${draft.id}`} className="flex items-center gap-3 py-3 hover:text-teal-600 dark:hover:text-teal-200" data-testid={`row-recent-draft-${draft.id}`}><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-300/10 text-violet-600 dark:text-violet-200"><FileText size={16} /></span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{draft.title}</b><span className="text-[10px] text-muted-foreground">v{draft.version} · Updated {time(draft.updated_at)}</span></span><Tag tone={draft.status === 'Approved' ? 'teal' : draft.status === 'In review' ? 'violet' : draft.status === 'Changes requested' ? 'amber' : 'neutral'}>{draft.status}</Tag><ArrowRight size={14} className="hidden text-muted-foreground sm:block" /></Link>)}</div>{draftsList.length === 0 && <p className="mt-5 text-sm text-muted-foreground">No drafts yet. Start with a claim you want to verify.</p>}</Glass>
          <Glass className="col-span-2 p-5 sm:p-6"><div className="flex items-center justify-between"><div><Eyebrow>Quick actions</Eyebrow><h2 className="display mt-1 text-xl font-bold">Pick up where you are.</h2></div><ArrowUpRight size={17} className="text-muted-foreground" /></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{[[FilePlus2, 'Create a draft', '/drafts/new'], [Layers3, 'Check approved facts', '/brand-kit'], [Radar, 'Explore Gap Radar', '/gap-radar'], [History, 'Inspect audit trail', '/audit']].map(([Icon, label, href]) => <Link key={String(href)} href={String(href)} className="flex items-center gap-3 rounded-2xl border border-border bg-background/35 p-4 text-sm font-semibold transition hover:-translate-y-1 hover:bg-white/5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-300/10 text-teal-600 dark:text-teal-200"><Icon size={16} /></span>{String(label)}<ArrowRight size={14} className="ml-auto text-muted-foreground" /></Link>)}</div><p className="mt-4 text-[10px] text-muted-foreground">Numbers shown here are returned by the API; no performance statistics are estimated.</p></Glass>
        </div>}
        <Glass className="mt-4 flex items-center gap-4 p-4 sm:p-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-300/15 text-amber-600 dark:text-amber-200"><ShieldCheck size={18} /></span><div><b className="text-sm">AI suggests, humans decide.</b><p className="mt-1 text-xs text-muted-foreground">Review every source, especially when numbers, names, or dates are involved.</p></div></Glass>
      </div>;
}

      function BrandKitPage() {
  const {data, isLoading, isError, error, refetch} = useBrandKit();
  const user = useSession((s) => s.user);
      const client = useQueryClient();
      const [tab, setTab] = useState<'guidelines' | 'facts' | 'terms'>('guidelines');
      const [addOpen, setAddOpen] = useState(false);
      const [editingId, setEditingId] = useState<string | null>(null);
      const kitForm = useForm<any>({resolver: zodResolver(kitItemSchema), defaultValues: {kind: tab, title: '', text: '', source: '', review_date: '', banned: '', preferred: '', allow_ai: true } });
        const canEdit = user?.role === 'brand_manager';
        const kit = data || {guidelines: [], facts: [], terms: [] };
  const add = kitForm.handleSubmit(async (values) => {
    const {kind: _kind, ...payload } = values;
        try {await api.saveKitItem(tab, payload, editingId || undefined); await client.invalidateQueries({queryKey: keys.kit }); setAddOpen(false); setEditingId(null); kitForm.reset({kind: tab, title: '', text: '', source: '', review_date: '', banned: '', preferred: '', allow_ai: true }); toast.success(editingId ? 'Brand kit entry updated' : 'Brand kit entry saved'); }
        catch (e) {toast.error(e instanceof Error ? e.message : 'Could not save item'); }
  });
  const editItem = (id: string, item: any) => {
          setEditingId(id);
        kitForm.reset({
          kind: tab, title: item.title || '', text: item.text || '', source: item.source || '',
        review_date: item.review_date || '', banned: item.banned || '', preferred: item.preferred || '',
        allow_ai: item.allow_ai ?? true,
    });
        setAddOpen(true);
  };
  const toggleAI = async (id: string, value: boolean) => {
    if (tab !== 'facts') return;
    const old = kit.facts.find((f) => f.id === id);
        if (!old) return;
        client.setQueryData(keys.kit, {...kit, facts: kit.facts.map((f) => f.id === id ? {...f, allow_ai: value } : f) });
        try {await api.saveKitItem('facts', { ...old, allow_ai: value }, id); toast.success('AI use permission updated'); }
        catch (e) {client.setQueryData(keys.kit, kit); toast.error(e instanceof Error ? e.message : 'Could not update fact'); }
  };
  const remove = async (id: string) => { if (!confirm(`Delete ${id} from the brand kit?`)) return; try {await api.deleteKitItem(tab, id); await client.invalidateQueries({queryKey: keys.kit }); toast.success('Entry deleted'); } catch (e) {toast.error(e instanceof Error ? e.message : 'Delete failed'); } };
        return <div className="page-enter"><PageHead eyebrow="Lumen Pay · Synthetic brand data" title="Brand kit" sub="The approved ground truth behind every finding. Managers own changes; everyone else can read." action={canEdit ? <Button onClick={() => { kitForm.reset({ kind: tab, title: '', text: '', source: '', review_date: '', banned: '', preferred: '', allow_ai: true }); setAddOpen(true); }} data-testid="button-add-kit-item"><Plus size={15} />Add {tab === 'facts' ? 'fact' : tab === 'terms' ? 'term' : 'guideline'}</Button> : <Tag>Read only · {roleName(user?.role)}</Tag>} />
          <Glass className="mb-5 flex flex-wrap items-center justify-between gap-4 p-3 sm:p-4"><div className="flex rounded-xl bg-background/45 p-1">{(['guidelines', 'facts', 'terms'] as const).map((t) => <button onClick={() => setTab(t)} key={t} className={`rounded-lg px-4 py-2 text-xs font-bold capitalize transition ${tab === t ? 'bg-teal-300 text-slate-950 shadow' : 'text-muted-foreground hover:text-foreground'}`} data-testid={`tab-${t}`}>{t}{` · ${kit[t].length}`}</button>)}</div><div className="flex items-center gap-2 text-[10px] text-muted-foreground"><span className="h-2 w-2 rounded-full bg-violet-400" />Synthetic data for preview only</div></Glass>
          {isLoading ? <LoadingCards /> : isError ? <ApiFailure error={error} retry={() => refetch()} /> : <div className="grid gap-3">{tab === 'guidelines' && kit.guidelines.map((item) => <Glass key={item.id} className="glass-hover flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center" data-testid={`card-guideline-${item.id}`}><div className="flex items-start gap-4"><span className="mono mt-1 text-[10px] text-violet-500">{item.id}</span><div><h3 className="font-bold">{item.title}</h3><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{item.text}</p></div></div><div className="flex items-center gap-2">{canEdit ? <><Button variant="quiet" onClick={() => editItem(item.id, item)} className="px-3 py-2 text-xs">Edit</Button><Button variant="quiet" onClick={() => remove(item.id)} className="px-3 py-2 text-xs">Remove</Button></> : <Tag>Manager owned</Tag>}</div></Glass>)}
            {tab === 'facts' && kit.facts.map((item) => { const daysLeft = (new Date(item.review_date).getTime() - Date.now()) / 86_400_000; const outdated = daysLeft < 0; const reviewDue = !outdated && daysLeft < 45; const statusLabel = outdated ? 'Outdated' : reviewDue ? 'Review due' : 'Current'; return <Glass key={item.id} className="glass-hover grid gap-4 p-5 md:grid-cols-[110px_1fr_auto] md:items-center" data-testid={`card-fact-${item.id}`}><div><span className="mono text-xs font-medium text-violet-500 dark:text-violet-200">{item.id}</span><div className="mt-2"><Tag tone={outdated ? 'rose' : reviewDue ? 'amber' : 'teal'}>{statusLabel}</Tag></div></div><div><p className="text-sm font-semibold leading-6">{item.text}</p><p className="mt-1 text-xs text-muted-foreground">Source: {item.source} <span className="mx-1">·</span> Review date: <span className={outdated ? 'text-rose-500' : ''}>{time(item.review_date)}</span></p></div><div className="flex items-center justify-between gap-3 md:justify-end"><label className="flex items-center gap-2 text-[10px] text-muted-foreground"><input type="checkbox" checked={item.allow_ai} disabled={!canEdit} onChange={(e) => toggleAI(item.id, e.target.checked)} className="accent-teal-400" data-testid={`toggle-fact-ai-${item.id}`} />Allow AI to use</label>{canEdit && <><button onClick={() => editItem(item.id, item)} aria-label={`Edit ${item.id}`} className="rounded-lg p-2 text-muted-foreground hover:bg-teal-400/10 hover:text-teal-500"><Settings2 size={14} /></button><button onClick={() => remove(item.id)} aria-label={`Delete ${item.id}`} className="rounded-lg p-2 text-muted-foreground hover:bg-rose-400/10 hover:text-rose-500"><X size={15} /></button></>}</div></Glass>; })}
            {tab === 'terms' && kit.terms.map((item) => <Glass key={item.id} className="glass-hover grid gap-4 p-5 sm:grid-cols-[1fr_auto_1fr_auto_auto] sm:items-center" data-testid={`card-term-${item.id}`}><div><Eyebrow>Don't say</Eyebrow><p className="mt-1 font-bold text-rose-500">{item.banned}</p></div><ArrowRight size={17} className="hidden text-muted-foreground sm:block" /><div><Eyebrow>Say instead</Eyebrow><p className="mt-1 font-bold text-teal-600 dark:text-teal-200">{item.preferred}</p></div>{canEdit && <><button onClick={() => editItem(item.id, item)} aria-label={`Edit ${item.id}`} className="justify-self-end rounded-lg p-2 text-muted-foreground hover:bg-teal-400/10 hover:text-teal-500"><Settings2 size={14} /></button><button onClick={() => remove(item.id)} aria-label={`Delete ${item.id}`} className="justify-self-end rounded-lg p-2 text-muted-foreground hover:bg-rose-400/10 hover:text-rose-500"><X size={15} /></button></>}</Glass>)}
            {!kit[tab].length && <Glass className="p-8 text-center"><Layers3 className="mx-auto text-muted-foreground" /><h3 className="display mt-3 font-bold">No entries in this section yet</h3><p className="mt-1 text-sm text-muted-foreground">A manager can add approved material here.</p></Glass>}
          </div>}
          {addOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => { setAddOpen(false); setEditingId(null); }}><Glass className="w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between"><h2 className="display text-xl font-bold">{editingId ? 'Edit' : 'Add'} {tab === 'facts' ? 'approved fact' : tab === 'terms' ? 'term pair' : 'guideline'}</h2><button onClick={() => { setAddOpen(false); setEditingId(null); }} aria-label="Close"><X size={18} /></button></div><form onSubmit={add} className="mt-5 grid gap-3" noValidate>{tab === 'guidelines' && <Field label="Title" {...kitForm.register('title')} error={kitForm.formState.errors.title?.message as string} />}{tab === 'terms' ? <><Field label="Banned wording" {...kitForm.register('banned')} error={kitForm.formState.errors.banned?.message as string} /><Field label="Preferred wording" {...kitForm.register('preferred')} error={kitForm.formState.errors.preferred?.message as string} /></> : <TextArea label={tab === 'facts' ? 'Approved fact' : 'Guideline text'} rows={3} {...kitForm.register('text')} error={kitForm.formState.errors.text?.message as string} />}{tab === 'facts' && <><Field label="Source" {...kitForm.register('source')} error={kitForm.formState.errors.source?.message as string} /><Field label="Review date" type="date" {...kitForm.register('review_date')} error={kitForm.formState.errors.review_date?.message as string} /><label className="flex gap-2 text-xs"><input type="checkbox" {...kitForm.register('allow_ai')} className="accent-teal-400" />Allow AI to use</label></>}<div className="mt-2 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setAddOpen(false); setEditingId(null); }}>Cancel</Button><Button type="submit">{editingId ? 'Save changes' : 'Save to brand kit'}</Button></div></form></Glass></div>}
        </div>;
}

        function DraftsPage() {
  const {data, isLoading, isError, error, refetch} = useDrafts();
        const [search, setSearch] = useState('');
        const [filter, setFilter] = useState('All');
  const draftsList = useMemo(() => (Array.isArray(data) ? data : []).filter((draft) => draft.title.toLowerCase().includes(search.toLowerCase()) && (filter === 'All' || draft.status === filter)), [data, search, filter]);
        return <div className="page-enter"><PageHead eyebrow="Content workspace" title="Drafts" sub="Search the work in progress. Every version can be traced back to a decision." action={<Link href="/drafts/new" className="inline-flex items-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:-translate-y-1"><Plus size={15} />New draft</Link>} />
          <Glass className="mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-border bg-background/45 px-3 sm:w-80"><Search size={15} className="text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search drafts…" className="min-w-0 flex-1 bg-transparent text-xs outline-none" data-testid="input-draft-search" /></label><div className="flex gap-1 overflow-x-auto">{['All', 'Draft', 'In review', 'Changes requested', 'Approved'].map((s) => <button key={s} onClick={() => setFilter(s)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-bold ${filter === s ? 'bg-teal-300 text-slate-950' : 'text-muted-foreground hover:bg-white/5'}`}>{s}</button>)}</div></Glass>
          {isLoading ? <LoadingCards /> : isError ? <ApiFailure error={error} retry={() => refetch()} /> : draftsList.length ? <div className="grid gap-3">{draftsList.map((draft) => <DraftRow key={draft.id} draft={draft} />)}</div> : <Glass className="p-9 text-center"><FileText className="mx-auto text-violet-500" size={24} /><h2 className="display mt-3 text-xl font-bold">{search ? 'No matching drafts' : 'A blank page, with a source.'}</h2><p className="mt-2 text-sm text-muted-foreground">Start with a title and the words you want checked.</p><Link href="/drafts/new" className="mt-5 inline-flex rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-bold text-slate-950">Create a draft</Link></Glass>}
        </div>;
}
        function DraftRow({draft}: {draft: Draft }) {
  const tone = draft.status === 'Approved' ? 'teal' : draft.status === 'In review' ? 'violet' : draft.status === 'Changes requested' ? 'amber' : 'neutral';
        return <Link href={`/drafts/${draft.id}`} className="glass glass-hover grid gap-4 rounded-[1.4rem] p-5 sm:grid-cols-[1fr_auto] sm:items-center" data-testid={`card-draft-${draft.id}`}><div className="flex min-w-0 items-center gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-300/10 text-violet-600 dark:text-violet-200"><FileText size={18} /></span><div className="min-w-0"><h3 className="truncate font-bold">{draft.title}</h3><p className="mt-1 text-[10px] text-muted-foreground">DRAFT v{draft.version} <span className="mx-2">·</span> Updated {time(draft.updated_at)}</p></div></div><div className="flex items-center gap-3 pl-[60px] sm:pl-0"><Tag tone={tone}>{draft.status}</Tag><span className="rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-[10px] text-muted-foreground">{draft.findings_count ?? 0} findings</span><ArrowRight size={15} className="text-muted-foreground" /></div></Link>;
}

        function NewDraftPage() {
  const [, setPath] = useLocation();
        const createDraft = useCreateDraft();
        const form = useForm<{ title: string; text: string; acknowledge: boolean }>({resolver: zodResolver(draftSchema), defaultValues: {title: '', text: '', acknowledge: false } });
  const loadFile = async (file?: File) => {
    if (!file) return;
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension === 'docx') {toast('DOCX upload is planned for Round 3. Paste text or use a .md/.txt file for now.'); return; }
        if (!['md', 'txt'].includes(extension || '')) {toast.error('Choose a .md or .txt file.'); return; }
        const text = await file.text();
        form.setValue('title', file.name, {shouldValidate: true }); form.setValue('text', text, {shouldValidate: true });
        toast.success(`${file.name} loaded`);
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
          <Glass className="p-5 sm:p-7"><form onSubmit={submit} className="grid gap-5" noValidate><Field label="Draft name" placeholder="e.g. app-store-listing.md" {...form.register('title')} error={form.formState.errors.title?.message} data-testid="input-new-draft-title" /><div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-muted-foreground">Draft text</span><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-[10px] font-bold hover:bg-white/5"><Upload size={13} />Choose .md / .txt<input type="file" accept=".md,.txt,.docx" className="sr-only" onChange={(e) => loadFile(e.target.files?.[0])} data-testid="input-draft-file" /></label></div><div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void loadFile(event.dataTransfer.files[0]); }} className="rounded-2xl transition hover:ring-1 hover:ring-teal-300/30" data-testid="drop-draft-text"><TextArea label="" rows={12} placeholder="Paste or drop a .md / .txt file here…" {...form.register('text')} error={form.formState.errors.text?.message} data-testid="input-new-draft-text" /><div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>Markdown and plain text accepted · DOCX is Round 3</span><span>{form.watch('text')?.length || 0} / 20,000</span></div></div></div><label className={`flex items-start gap-3 rounded-xl border p-4 text-xs leading-5 ${form.formState.errors.acknowledge ? 'border-rose-400' : 'border-border'}`}><input type="checkbox" className="mt-1 accent-teal-400" {...form.register('acknowledge')} data-testid="checkbox-ai-acknowledgement" /><span><b>Required acknowledgement:</b> I understand that the draft text and relevant clauses are sent to an external AI service for review. My team makes every final decision.</span></label>{form.formState.errors.acknowledge && <span className="-mt-4 text-xs text-rose-500">{form.formState.errors.acknowledge.message}</span>}<div className="flex flex-wrap justify-end gap-2"><Button variant="outline" type="button" onClick={() => setPath('/drafts')}>Cancel</Button><Button disabled={createDraft.isPending} type="submit"><Sparkles size={15} />{createDraft.isPending ? 'Creating…' : 'Create draft'}</Button></div></form></Glass>
        </div>;
}

        function FindingCard({finding, draftId, index, canResolve}: {finding: Finding; draftId: string; index: number; canResolve: boolean }) {
  const decision = useDecision(draftId);
        const [editOpen, setEditOpen] = useState(false);
        const [dismissOpen, setDismissOpen] = useState(false);
        const form = useForm<{ edited_fix: string }>({resolver: zodResolver(editSchema), defaultValues: {edited_fix: finding.suggested_fix } });
        const dismissForm = useForm<{ reason: string }>({resolver: zodResolver(dismissSchema), defaultValues: {reason: '' } });
  const submitEdit = form.handleSubmit(async (values) => {
    try {await decision.mutateAsync({ id: finding.id, action: 'edit', edited_fix: values.edited_fix }); toast.success('Edit saved to the decision log'); setEditOpen(false); }
        catch (e) {toast.error(e instanceof Error ? e.message : 'Could not save edit'); }
  });
  const selected = useSession((s) => s.selectedFinding);
  const setSelected = useSession((s) => s.setSelectedFinding);
  const act = async (action: 'accept' | 'dismiss', reason?: string) => {
    try {await decision.mutateAsync({ id: finding.id, action, ...(action === 'dismiss' ? { reason } : {}) }); toast.success(action === 'accept' ? 'Suggested fix accepted' : 'Finding dismissed with reason'); setDismissOpen(false); dismissForm.reset(); }
        catch (e) {toast.error(e instanceof Error ? e.message : 'Decision failed'); }
  };
        const submitDismiss = dismissForm.handleSubmit(({reason}) => act('dismiss', reason));
        const resolved = finding.status !== 'open';
        const tone = finding.severity === 'high' ? 'rose' : finding.severity === 'medium' ? 'amber' : 'teal';
        return <Glass tabIndex={0} onClick={() => setSelected(finding.id)} onKeyDown={(event) => { if (event.target !== event.currentTarget || resolved || !canResolve) return; const key = event.key.toLowerCase(); if (key === 'a') void act('accept'); if (key === 'e') setEditOpen(true); if (key === 'd') setDismissOpen(true); }} className={`p-4 transition ${resolved ? 'opacity-65' : ''} ${selected === finding.id ? 'ring-1 ring-teal-300/45' : ''}`} data-testid={`card-finding-${finding.id}`}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="mono grid h-7 w-7 place-items-center rounded-lg bg-violet-300/10 text-[10px] text-violet-600 dark:text-violet-200">{index + 1}</span><span className="text-sm font-bold">{finding.type}</span></div><div className="flex flex-wrap justify-end gap-1.5"><Tag tone={tone}>{finding.severity}</Tag><Tag tone={finding.source === 'ai' ? 'violet' : 'teal'}>{finding.source === 'ai' ? 'AI-assisted' : 'Rule-based'}</Tag></div></div>
          <div className="mt-4"><Eyebrow>Exact excerpt</Eyebrow><p className={`mt-2 rounded-xl border px-3 py-2.5 font-mono text-xs ${finding.severity === 'high' ? 'border-rose-300/15 bg-rose-300/[.07]' : 'border-amber-300/15 bg-amber-300/[.06]'}`}>“{finding.excerpt}”</p></div>
          <div className="mt-4"><Eyebrow>Reason & source</Eyebrow><p className="mt-1 text-xs leading-5 text-muted-foreground">{finding.reason}</p><div className="mt-2 flex flex-wrap gap-2"><Tag tone="violet">{finding.source_ref_id}</Tag>{finding.confidence < .8 && <Tag tone="amber">Needs human review</Tag>}{finding.fix_needs_human && <Tag tone="amber">Numbers guarded</Tag>}{finding.source_ref_id === 'FACT-11' && <Tag tone="rose">Outdated fact</Tag>}</div></div>
          <div className="mt-4 rounded-xl bg-background/45 p-3"><Eyebrow>Intent-preserving fix</Eyebrow><p className="mt-2 text-xs"><span className="text-muted-foreground line-through">{finding.excerpt}</span><span className="mx-2">→</span><span className="font-semibold text-teal-600 dark:text-teal-200">{finding.suggested_fix}</span></p>{finding.fix_needs_human && <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-200">Numbers and names are guarded; changes go to a human.</p>}</div>
          {resolved ? <div className="mt-4 rounded-lg bg-teal-300/10 px-3 py-2 text-xs font-bold text-teal-700 dark:text-teal-200">{finding.status === 'dismissed' ? 'Dismissed with reason' : 'Decision recorded'}</div> : <div className="mt-4"><Eyebrow>Human decision</Eyebrow>{!canResolve && <p className="mt-2 text-[10px] text-muted-foreground">Creator-only decision. Switch to a Creator role to resolve findings.</p>}{editOpen ? <form onSubmit={submitEdit} className="mt-3 grid gap-2"><TextArea label="Edit the proposed fix" rows={2} {...form.register('edited_fix')} error={form.formState.errors.edited_fix?.message} data-testid={`input-edit-fix-${finding.id}`} /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={decision.isPending}>Save edit</Button></div></form> : dismissOpen ? <form onSubmit={submitDismiss} className="mt-3 grid gap-2"><TextArea label="Why is this finding not applicable? (10 characters minimum)" rows={2} {...dismissForm.register('reason')} error={dismissForm.formState.errors.reason?.message} data-testid={`input-dismiss-reason-${finding.id}`} /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDismissOpen(false)}>Cancel</Button><Button type="submit" variant="danger">Confirm dismiss</Button></div></form> : <div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => act('accept')} disabled={decision.isPending || !canResolve} className="px-3 py-2 text-[10px]" data-testid={`button-accept-${finding.id}`}><Check size={13} />Accept</Button><Button variant="quiet" onClick={() => setEditOpen(true)} disabled={!canResolve} className="px-3 py-2 text-[10px]" data-testid={`button-edit-${finding.id}`}>Edit</Button><Button variant="quiet" onClick={() => setDismissOpen(true)} disabled={!canResolve} className="px-3 py-2 text-[10px]" data-testid={`button-dismiss-${finding.id}`}>Dismiss</Button><span className="ml-auto self-center text-[9px] text-muted-foreground">A · E · D</span></div>}</div>}
        </Glass>;
}

        function GateStepper({dropped}: {dropped: {candidate: string; failed_gate: number; why: string }[] }) {
  const [open, setOpen] = useState(false);
        const gates = ['Strict JSON', 'Source exists', 'Quote appears', 'Human guardrails', 'Fail closed'];
        return <Glass className="p-4"><button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left"><div><Eyebrow>Verifier trace</Eyebrow><h3 className="display mt-1 font-bold">Five evidence gates</h3></div><ChevronDown className={`transition ${open ? 'rotate-180' : ''}`} size={17} /></button><div className="mt-4 grid grid-cols-5 gap-1">{gates.map((gate, i) => <div key={gate} className="text-center"><div className={`mx-auto grid h-8 w-8 place-items-center rounded-xl text-[10px] font-bold ${i === 1 && dropped.length ? 'bg-rose-400/15 text-rose-500' : 'bg-teal-300/10 text-teal-600 dark:text-teal-200'}`}>{i === 1 && dropped.length ? <X size={14} /> : <Check size={14} />}</div><div className="mt-2 text-[8px] leading-3 text-muted-foreground sm:text-[9px]">GATE {i + 1}<br />{gate}</div></div>)}</div>{open && <div className="mt-4 border-t border-border pt-4"><p className="text-[10px] leading-5 text-muted-foreground">A cited reference must exist, the quote must appear, and risky changes ask for a human. Invalid candidates are dropped.</p>{dropped.map((item, i) => <div key={i} className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/[.06] p-3"><Tag tone="rose">Gate {item.failed_gate} · dropped</Tag><p className="mt-2 text-xs font-semibold">{item.candidate}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.why}</p></div>)}</div>}<p className="mt-3 text-[9px] text-muted-foreground">This proves grounding, not real-world truth. Claims outside approved facts are labelled unverified.</p></Glass>;
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
          const findingList = findingsQuery.data || [];
  const activeFindings = findingList.filter((f) => f.status === 'open');
  useEffect(() => { if (draftQuery.data && !initialized) {setText(draftQuery.data.text); setInitialized(true); } }, [draftQuery.data, initialized]);
          const commentForm = useForm<{ text: string }>({resolver: zodResolver(commentSchema), defaultValues: {text: '' } });
          const submitComment = commentForm.handleSubmit(async ({text: comment }) => { try {await addComment.mutateAsync({ text: comment }); commentForm.reset(); toast.success('Comment added'); } catch (e) {toast.error(e instanceof Error ? e.message : 'Comment failed'); } });
  const saveVersion = async () => { try {await createVersion.mutateAsync({ text }); toast.success('Version submitted for review'); } catch (e) {toast.error(e instanceof Error ? e.message : 'Could not submit version'); } };
          const current = draftQuery.data;
          if (draftQuery.isLoading) return <LoadingCards />;
          if (draftQuery.isError) return <ApiFailure error={draftQuery.error} retry={() => draftQuery.refetch()} />;
          if (!current) return <Glass className="p-8">Draft not found. <Link href="/drafts" className="text-teal-600">Back to drafts</Link></Glass>;
  const filtered = findingList.filter((f) => findingFilter === 'All' || findingFilter === 'Rules' && f.source === 'rules' || findingFilter === 'AI-assisted' && f.source === 'ai' || findingFilter === 'Needs human review' && (f.confidence < .8 || f.fix_needs_human) || findingFilter === 'Resolved' && f.status !== 'open');
          return <div className="page-enter"><button onClick={() => history.back()} className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft size={14} />Back</button><PageHead eyebrow="Draft review room" title={current.title} sub={`DRAFT v${current.version} · ${current.status}`} action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { runReview.mutate(); toast('Running five-gate review…'); }} disabled={runReview.isPending} data-testid="button-run-review"><RefreshCw size={14} className={runReview.isPending ? 'animate-spin' : ''} />{runReview.isPending ? 'Reviewing…' : 'Run review'}</Button><Button onClick={saveVersion} data-testid="button-submit-review"><Send size={14} />Submit for review</Button></div>} />
            <div className="mb-3 flex gap-1 rounded-xl border border-border bg-card/45 p-1 lg:hidden">{(['editor', 'findings'] as const).map((tab) => <button key={tab} onClick={() => setMobileTab(tab)} className={`flex-1 rounded-lg py-2 text-xs font-bold capitalize ${mobileTab === tab ? 'bg-teal-300 text-slate-950' : 'text-muted-foreground'}`}>{tab === 'findings' ? `Findings · ${findingList.length}` : tab}</button>)}</div>
            {!canEdit && <Glass className="mb-4 p-4"><div className="flex items-center gap-2 text-xs font-bold"><LockKeyhole size={14} />Read-only draft view</div><p className="mt-1 text-[10px] text-muted-foreground">Creator-only edits and finding decisions are disabled for this role.</p></Glass>}
            <div className="grid gap-4 lg:grid-cols-[1.02fr_.98fr]">
              <div className={`${mobileTab === 'findings' ? 'hidden lg:block' : ''} grid min-w-0 gap-4 content-start`}>
                <Glass className="overflow-hidden"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div className="flex items-center gap-2"><FileText size={15} className="text-violet-500" /><span className="mono text-[10px] uppercase tracking-wider">Draft text · {text.length} chars</span></div><Tag tone="violet">v{current.version}</Tag></div><ErrorBoundary FallbackComponent={ErrorFallback} resetKey={id}><div className="relative"><div className="pointer-events-none absolute inset-0 soft-grid opacity-30" /><div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-300/[.04] to-transparent" /><HighlightedEditor value={text} onChange={setText} readOnly={!canEdit} /></div></ErrorBoundary></Glass>
                <Glass className="p-4 sm:p-5"><div className="flex items-center justify-between"><div><Eyebrow>Version history</Eyebrow><h3 className="display mt-1 font-bold">Saved checkpoints</h3></div><GitCompareArrows size={17} className="text-violet-500" /></div><div className="mt-4 flex flex-wrap gap-2">{(versionsQuery.data || []).map((v) => <div key={v.id} className="rounded-xl border border-border bg-background/45 px-3 py-2 text-left"><span className="mono block text-[10px]">v{v.version}</span><span className="mt-1 block text-[9px] text-muted-foreground">{time(v.created_at)}</span></div>)}{!versionsQuery.data?.length && <span className="text-xs text-muted-foreground">Versions will appear here after submission.</span>}</div><button onClick={async () => { const versions = versionsQuery.data || []; if (versions.length < 2) { toast('At least two saved versions are needed to compare.'); return; } try { const result = await api.diff(id, versions[versions.length - 2].version, versions[versions.length - 1].version); setDiffView({ before: result.before ?? versions[versions.length - 2].text, after: result.after ?? versions[versions.length - 1].text }); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load the diff'); } }} className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 dark:text-teal-200"><GitCompareArrows size={13} />Compare latest versions</button>{diffView && <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2"><div className="rounded-xl border border-rose-300/15 bg-rose-300/[.04] p-3"><Eyebrow>Previous</Eyebrow><p className="mt-2 whitespace-pre-wrap font-mono text-[10px] leading-5">{diffView.before}</p></div><div className="rounded-xl border border-teal-300/15 bg-teal-300/[.04] p-3"><Eyebrow>Current</Eyebrow><p className="mt-2 whitespace-pre-wrap font-mono text-[10px] leading-5">{diffView.after}</p></div></div>}</Glass>
                <Glass className="p-4 sm:p-5"><div className="flex gap-2">{['Versions', 'Comments', 'Activity'].map((t) => <button key={t} onClick={() => setSubtab(t)} className={`rounded-lg px-3 py-2 text-[10px] font-bold ${subtab === t ? 'bg-violet-300/15 text-violet-700 dark:text-violet-200' : 'text-muted-foreground hover:bg-white/5'}`}>{t}</button>)}</div>{subtab === 'Comments' ? <><div className="mt-3 grid gap-2">{(commentsQuery.data || []).map((comment) => <div key={comment.id} className="rounded-xl bg-background/45 p-3"><div className="flex justify-between text-[10px] font-bold"><span>{comment.author}</span><span className="text-muted-foreground">{time(comment.created_at)}</span></div><p className="mt-2 text-xs">{comment.text}</p></div>)}</div><form onSubmit={submitComment} className="mt-3 flex gap-2"><input {...commentForm.register('text')} placeholder="Add a review comment…" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background/50 px-3 text-xs" data-testid="input-comment" /><Button type="submit" className="px-3" aria-label="Send comment" data-testid="button-send-comment"><Send size={14} /></Button></form>{commentForm.formState.errors.text && <span className="text-[10px] text-rose-500">{commentForm.formState.errors.text.message}</span>}</> : <p className="mt-3 text-xs leading-5 text-muted-foreground">{subtab === 'Versions' ? 'New versions preserve each submitted draft and its review history.' : 'Actions and human decisions are added to the audit log.'}</p>}</Glass>
              </div>
              <div className={`${mobileTab === 'editor' ? 'hidden lg:block' : ''} grid min-w-0 content-start gap-4`}>
                <Glass className="p-4"><div className="flex items-center justify-between"><div><Eyebrow>Findings · {findingList.length}</Eyebrow><h3 className="display mt-1 font-bold">Evidence to review</h3></div><PanelRight size={17} className="text-muted-foreground" /></div><div className="mt-3 flex gap-1 overflow-x-auto pb-1">{['All', 'Rules', 'AI-assisted', 'Needs human review', 'Resolved'].map((f) => <button key={f} onClick={() => setFindingFilter(f)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[9px] font-bold ${findingFilter === f ? 'bg-violet-300/20 text-violet-700 dark:text-violet-200' : 'border border-border text-muted-foreground'}`}>{f}</button>)}</div></Glass>
                {findingsQuery.isLoading ? <LoadingCards /> : findingsQuery.isError ? <ApiFailure error={findingsQuery.error} retry={() => findingsQuery.refetch()} /> : filtered.length ? <div className="grid gap-3">{filtered.map((finding, index) => <FindingCard key={finding.id} finding={finding} draftId={id} index={index} canResolve={canEdit} />)}</div> : <Glass className="p-7 text-center"><BadgeCheck className="mx-auto text-teal-500" /><h3 className="display mt-2 font-bold">Nothing in this view</h3><p className="mt-1 text-xs text-muted-foreground">Try a different filter or run a review.</p></Glass>}
                <GateStepper dropped={runReview.data?.dropped || []} />
                <Glass className="flex items-center gap-3 p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-300/15 text-amber-600 dark:text-amber-200"><ShieldCheck size={17} /></span><p className="text-[10px] leading-5 text-muted-foreground">AI suggests, humans decide. Findings are evidence signals, not proof of real-world truth.</p></Glass>
              </div>
            </div>
          </div>;
}

          function ReviewQueuePage() {
  const {data: draftsListRaw, isLoading, isError, error, refetch } = useDrafts();
  const draftsList = Array.isArray(draftsListRaw) ? draftsListRaw : [];
  const user = useSession((s) => s.user);
          const [selected, setSelected] = useState<string | null>(null);
          const [note, setNote] = useState('');
          const [requestOpen, setRequestOpen] = useState(false);
          const client = useQueryClient();
  const pending = draftsList.filter((draft) => draft.status.toLowerCase() === 'in review');
  useEffect(() => { if (!selected && pending.length) setSelected(pending[0].id); }, [selected, pending]);
  const draft = pending.find((item) => item.id === selected);
          const reviewDecision = useReviewDecision(selected || '');
          const reviewerComment = useAddComment(selected || '');
          const decisionForm = useForm<{ reason: string }>({resolver: zodResolver(changesSchema), defaultValues: {reason: '' } });
  const saveReviewerNote = async () => {
    if (!draft || !note.trim()) return;
          await reviewerComment.mutateAsync({text: note.trim() });
  };
  const approve = async () => {
    if (user?.role !== 'reviewer') {toast.error('Only reviewers can approve a draft.'); return; }
          if (!draft) return;
          try {await saveReviewerNote(); await reviewDecision.approve.mutateAsync(); await client.invalidateQueries({queryKey: keys.comments(draft.id) }); toast.success('Approved version locked and logged'); }
          catch (e) {toast.error(e instanceof Error ? e.message : 'Approval failed'); }
  };
          const request = decisionForm.handleSubmit(async ({reason}) => {
    if (!draft) return;
          try {await saveReviewerNote(); await reviewDecision.requestChanges.mutateAsync({reason}); await client.invalidateQueries({queryKey: keys.comments(draft.id) }); toast.success('Changes requested'); setRequestOpen(false); decisionForm.reset(); }
          catch (e) {toast.error(e instanceof Error ? e.message : 'Could not request changes'); }
  });
          const findingsQuery = useFindings(draft?.id || '');
          return <div className="page-enter"><PageHead eyebrow="Reviewer desk" title="Review with the full context." sub="See the change, inspect the evidence, leave a note, and make the call." />
            {user?.role !== 'reviewer' && <Glass className="mb-4 border-amber-300/20 bg-amber-300/[.06] p-4"><div className="flex items-center gap-2 text-sm font-bold"><LockKeyhole size={16} />Reviewer actions are locked</div><p className="mt-1 text-xs text-muted-foreground">You are signed in as {roleName(user?.role)}. Switch to a reviewer account to approve or request changes.</p><Link href="/login" className="mt-2 inline-block text-xs font-bold text-teal-600">Switch role →</Link></Glass>}
            {isLoading ? <LoadingCards /> : isError ? <ApiFailure error={error} retry={() => refetch()} /> : pending.length ? <div className="grid gap-4 lg:grid-cols-[280px_1fr]"><Glass className="p-4"><Eyebrow>Queue · {pending.length}</Eyebrow><div className="mt-3 grid gap-2">{pending.map((item) => <button key={item.id} onClick={() => setSelected(item.id)} className={`rounded-xl border p-3 text-left ${selected === item.id ? 'border-teal-300/35 bg-teal-300/[.08]' : 'border-border hover:bg-white/5'}`}><b className="block truncate text-xs">{item.title}</b><span className="mt-1 block text-[10px] text-muted-foreground">v{item.version} · {item.findings_count ?? 0} findings</span></button>)}</div></Glass>
              {draft ? <div className="grid content-start gap-4"><Glass className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><Eyebrow>Submitted version · v{draft.version}</Eyebrow><h2 className="display mt-2 text-xl font-bold">{draft.title}</h2></div><Tag tone="violet">In review</Tag></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border bg-background/35 p-4"><Eyebrow>Previous snapshot</Eyebrow><p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">{(draft.text || '').slice(0, 180)}</p></div><div className="rounded-xl border border-teal-300/15 bg-teal-300/[.04] p-4"><Eyebrow>Submitted draft</Eyebrow><p className="mt-3 whitespace-pre-wrap text-xs leading-6">{draft.text}</p></div></div><div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground"><GitCompareArrows size={14} />Version diff shown from the submitted API version. Confirm changes before deciding.</div></Glass>
                <Glass className="p-5"><div className="flex items-center justify-between"><div><Eyebrow>Finding context</Eyebrow><h3 className="display mt-1 font-bold">{findingsQuery.data?.length || 0} reported findings</h3></div><Link href={`/drafts/${draft.id}`} className="text-xs font-bold text-teal-600 dark:text-teal-200">Open full review <ArrowUpRight size={13} className="inline" /></Link></div><div className="mt-3 grid gap-2">{(findingsQuery.data || []).map((item) => <div key={item.id} className="rounded-xl border border-border bg-background/35 p-3"><div className="flex flex-wrap justify-between gap-2"><Tag tone={item.severity === 'high' ? 'rose' : 'amber'}>{item.severity}</Tag><span className="mono text-[10px] text-violet-600 dark:text-violet-200">{item.source_ref_id}</span></div><p className="mt-2 font-mono text-xs">“{item.excerpt}”</p><p className="mt-1 text-[10px] leading-5 text-muted-foreground">{item.reason}</p></div>)}{!findingsQuery.data?.length && <p className="text-xs text-muted-foreground">No findings returned for this submission.</p>}</div></Glass>
                <Glass className="p-5"><Eyebrow>Reviewer note</Eyebrow><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Leave context for the decision…" className="mt-3 w-full rounded-xl border border-border bg-background/40 p-3 text-xs" data-testid="input-review-note" /><div className="mt-3 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setRequestOpen(true)} disabled={user?.role !== 'reviewer'} data-testid="button-request-changes">Request changes</Button><Button onClick={approve} disabled={user?.role !== 'reviewer'} data-testid="button-approve"><LockKeyhole size={14} />Approve & lock version</Button></div>{requestOpen && <form onSubmit={request} className="mt-4 grid gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[.05] p-4"><TextArea label="What should the creator change? (10 characters minimum)" rows={3} {...decisionForm.register('reason')} error={decisionForm.formState.errors.reason?.message} data-testid="input-change-reason" /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setRequestOpen(false)}>Cancel</Button><Button type="submit">Send changes request</Button></div></form>}</Glass>
              </div> : <Glass className="p-9 text-center"><BadgeCheck className="mx-auto text-teal-500" /><h2 className="display mt-3 text-xl font-bold">Queue is clear.</h2><p className="mt-2 text-sm text-muted-foreground">Submitted drafts will appear here for reviewer sign-off.</p></Glass>}</div> : <Glass className="p-9 text-center"><BadgeCheck className="mx-auto text-teal-500" /><h2 className="display mt-3 text-xl font-bold">Queue is clear.</h2></Glass>}
            <Glass className="mt-4 flex items-center gap-3 p-4"><LockKeyhole className="text-teal-500" size={17} /><p className="text-xs text-muted-foreground">Approved version is locked and logged. Every reviewer decision becomes part of the audit trail.</p></Glass>
          </div>;
}

          function GapRadarPage() {
  const user = useSession((s) => s.user);
          const {data, isLoading, isError, error, refetch} = useGapRadar();
          const [tableView, setTableView] = useState(false);
          if (user?.role !== 'brand_manager') return <Glass className="mx-auto max-w-2xl p-8 text-center"><LockKeyhole className="mx-auto text-amber-500" /><h1 className="display mt-3 text-2xl font-bold">Gap Radar is manager-only.</h1><p className="mt-2 text-sm text-muted-foreground">Repeated dismissals help a Brand Manager find rules that may need clearer wording.</p><Link href="/login" className="mt-5 inline-flex rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-bold text-slate-950">Switch role</Link></Glass>;
          return <div className="page-enter"><PageHead eyebrow="Brand governance · pattern review" title="Guideline Gap Radar" sub="Repeated dismissals can be a signal that a rule needs better examples. Fix the rule, not the person." action={<button onClick={() => setTableView(!tableView)} className="rounded-xl border border-border bg-card/50 px-4 py-2.5 text-xs font-bold hover:bg-card">{tableView ? 'Chart view' : 'Table view'}</button>} />
            {isLoading ? <LoadingCards /> : isError ? <ApiFailure error={error} retry={() => refetch()} /> : <div className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]"><Glass className="p-5 sm:p-7"><div className="flex items-center justify-between"><div><Eyebrow>Dismissal patterns</Eyebrow><h2 className="display mt-2 text-xl font-bold">{tableView ? 'Rule comparison' : 'Signals from real decisions'}</h2></div><Radar size={19} className="text-violet-500" /></div>{tableView ? <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="mono text-[9px] uppercase text-muted-foreground"><tr><th className="pb-3">Rule</th><th className="pb-3">Flagged</th><th className="pb-3">Dismissed</th></tr></thead><tbody>{(data || []).map((r: any) => <tr key={r.rule} className="border-t border-border"><td className="py-3 pr-2">{r.rule}</td><td>{r.flagged}</td><td>{r.dismissed}</td></tr>)}</tbody></table></div> : <div className="mt-6 grid gap-4">{(data || []).map((r: any) => <div key={r.rule}><div className="flex justify-between text-[10px]"><span className="font-bold">{r.rule}</span><span className="text-muted-foreground">{r.dismissed} / {r.flagged} dismissals</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-background/60"><div className="h-full rounded-full bg-gradient-to-r from-teal-300 via-violet-400 to-amber-300" style={{ width: `${Math.min(100, r.flagged ? r.dismissed / r.flagged * 100 : 0)}%` }} /></div></div>)}</div>}<div className="mt-7 flex gap-4 text-[9px] text-muted-foreground"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-violet-400" />Flagged</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-300" />Dismissal ratio</span></div></Glass>
              <Glass className="p-5 sm:p-7"><Eyebrow>Ranked rules</Eyebrow><div className="mt-4 grid gap-3">{(data || []).map((item: any) => <div key={item.rule} className="rounded-2xl border border-border bg-background/35 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">{item.rule}</h3><Tag tone={item.status === 'Possibly unclear' ? 'amber' : 'teal'}>{item.status}</Tag></div><div className="mt-3 flex flex-wrap gap-4 text-[10px] text-muted-foreground"><span>Flagged <b className="text-foreground">{item.flagged}</b></span><span>Dismissed <b className="text-foreground">{item.dismissed}</b></span></div>{item.reasons?.length > 0 && <p className="mt-3 text-[10px] leading-5 text-muted-foreground">Dismissal reasons: {item.reasons.join(' · ')}</p>}<Link href="/brand-kit" className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 dark:text-teal-200">Edit guideline <ArrowUpRight size={12} /></Link></div>)}</div></Glass></div>}
            <Glass className="mt-4 flex items-center gap-3 p-4"><Gauge className="text-amber-500" size={18} /><p className="text-xs text-muted-foreground">A repeated dismissal is a signal to inspect the guideline—not a score of an individual.</p></Glass>
          </div>;
}

          function AuditPage() {
  const {data, isLoading, isError, error, refetch} = useAuditLog();
          const [search, setSearch] = useState('');
  const rows = (data || []).filter((entry) => `${entry.who} ${entry.role} ${entry.action} ${entry.target}`.toLowerCase().includes(search.toLowerCase()));
  const exportCSV = () => {
    const csv = [['who','role','action','target','timestamp'], ...rows.map((r) => [r.who,r.role,r.action,r.target,r.timestamp])].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
          const href = URL.createObjectURL(new Blob([csv], {type: 'text/csv' })); const link = document.createElement('a'); link.href = href; link.download = 'citecheck-audit.csv'; link.click(); URL.revokeObjectURL(href);
  };
          return <div className="page-enter"><PageHead eyebrow="Traceability" title="Every decision is logged." sub="A filterable record of the people, roles, actions, and content behind each review." action={<Button variant="outline" onClick={exportCSV} disabled={!rows.length} data-testid="button-export-audit"><Download size={15} />Export CSV</Button>} />
            <Glass className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3"><label className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-border bg-background/45 px-3 sm:w-80"><Search size={14} className="text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter the audit log…" className="min-w-0 flex-1 bg-transparent text-xs outline-none" data-testid="input-audit-filter" /></label><span className="text-[10px] text-muted-foreground">Background refresh enabled</span></Glass>
            {isLoading ? <LoadingCards /> : isError ? <ApiFailure error={error} retry={() => refetch()} /> : <><div className="hidden overflow-hidden rounded-3xl border border-border bg-card/40 md:block"><table className="w-full text-left text-xs"><thead className="bg-white/[.04] text-[9px] uppercase tracking-widest text-muted-foreground"><tr>{['Who', 'Role', 'Action', 'Target', 'Timestamp'].map((h) => <th key={h} className="px-4 py-4 font-medium">{h}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border/70 hover:bg-white/[.025]" data-testid={`row-audit-${row.id}`}><td className="px-4 py-4 font-bold">{row.who}</td><td className="px-4 py-4"><Tag>{roleName(row.role)}</Tag></td><td className="px-4 py-4">{row.action}</td><td className="px-4 py-4 text-muted-foreground">{row.target}</td><td className="px-4 py-4 text-muted-foreground">{new Date(row.timestamp).toLocaleString()}</td></tr>)}</tbody></table></div><div className="grid gap-3 md:hidden">{rows.map((row) => <Glass key={row.id} className="p-4"><div className="flex items-center justify-between"><b className="text-sm">{row.who}</b><Tag>{roleName(row.role)}</Tag></div><p className="mt-2 text-xs">{row.action}</p><p className="mt-1 text-[10px] text-muted-foreground">{row.target}</p><p className="mono mt-3 text-[9px] text-muted-foreground">{new Date(row.timestamp).toLocaleString()}</p></Glass>)}</div>{!rows.length && <Glass className="mt-3 p-7 text-center text-sm text-muted-foreground">No audit entries match that filter.</Glass>}</>}
          </div>;
}

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
  return <div className="page-enter"><PageHead eyebrow="A transparent workflow" title="AI suggests. Humans decide." sub="Seven explicit steps, two human checkpoints, and evidence attached all the way through." />
            <Glass className="mb-5 p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><Eyebrow>Verification pipeline</Eyebrow><h2 className="display mt-2 text-xl font-bold">From draft text to verified findings</h2></div><Tag tone="violet">5 evidence gates</Tag></div><div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">{['Draft text', 'Rules engine', 'LLM reviewer', 'Verifier', 'Verified findings'].map((name, index) => <div key={name} className="relative rounded-xl border border-border bg-background/40 p-3"><span className="mono text-[9px] text-teal-600 dark:text-teal-200">0{index + 1}</span><div className="mt-2 text-xs font-bold">{name}</div>{index < 4 && <ArrowRight size={13} className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-muted-foreground sm:block" />}</div>)}</div><p className="mt-4 text-[10px] leading-5 text-muted-foreground">Draft text and only relevant clauses go to an external AI service. Candidate findings without supported provenance are dropped before people see them.</p></Glass>
            <div className="relative ml-2 grid gap-3 border-l border-teal-300/25 pl-6 sm:ml-6 sm:pl-9">{workflow.map(([n, title, desc, owner]) => <div key={n} className="relative"><span className="absolute -left-[31px] top-5 grid h-8 w-8 place-items-center rounded-xl border border-teal-300/25 bg-background text-[10px] font-bold text-teal-600 dark:text-teal-200 sm:-left-[44px]">{n}</span><Glass className={`glass-hover grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5 ${owner.includes('CHECKPOINT') ? 'border-amber-300/25' : ''}`}><div><div className="flex items-center gap-2"><h3 className="display text-lg font-bold">{title}</h3>{owner.includes('CHECKPOINT') && <Tag tone="amber">Human checkpoint</Tag>}</div><p className="mt-2 text-xs leading-6 text-muted-foreground">{desc}</p></div><span className={`mono text-[9px] uppercase tracking-wider ${owner.includes('CHECKPOINT') ? 'text-amber-600 dark:text-amber-200' : 'text-muted-foreground'}`}>{owner}</span></Glass></div>)}</div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">{[['Creator', 'Catch issues in the copy. Keep the intent.'], ['Brand Manager', 'Keep facts current and rules clear.'], ['Reviewer', 'Make the final call with context.']].map(([role, desc]) => <Glass key={role} className="p-5"><Eyebrow>For the {role}</Eyebrow><p className="display mt-2 text-lg font-bold">{desc}</p></Glass>)}</div>
            <Glass className="mt-5 grid gap-5 p-6 sm:grid-cols-3 sm:p-7"><div><Eyebrow>Round 2 core</Eyebrow><p className="mt-2 text-sm font-bold">Brand kit · draft review · human decisions · audit history</p></div><div><Eyebrow>Round 3</Eyebrow><p className="mt-2 text-sm font-bold">DOCX upload · Gap Radar · verifier hardening</p></div><div><Eyebrow>Future scope</Eyebrow><p className="mt-2 text-sm font-bold">Image and video review · SSO · CMS · multi-language · Google Docs · Slack</p></div></Glass>
            <Glass className="mt-5 border-violet-300/20 bg-violet-300/[.06] p-5"><Eyebrow>Illustrative example</Eyebrow><p className="mt-2 text-sm leading-6">A verifier drops a candidate citing FACT-42 because it does not exist in the kit. A cashback claim pointing to overdue FACT-11 pauses for a person. Unsupported claims remain explicitly unverified.</p></Glass>
          </div>;
}

          function SettingsPage() {
  const theme = useSession((s) => s.theme);
  const setTheme = useSession((s) => s.setTheme);
  const reduced = useSession((s) => s.reducedMotion);
  const setReduced = useSession((s) => s.setReducedMotion);
          const [explode, setExplode] = useState(false);
          return <div className="page-enter"><PageHead eyebrow="Your workspace" title="Settings" sub="A small set of choices to make this review room work for you." />
            <div className="grid gap-4 lg:grid-cols-2"><Glass className="p-5 sm:p-7"><Eyebrow>Appearance</Eyebrow><h2 className="display mt-2 text-xl font-bold">Choose your atmosphere.</h2><div className="mt-5 grid grid-cols-2 gap-3">{[['dark', 'Aurora Night', Moon], ['light', 'Frosted Day', Sun]].map(([t, label, Icon]) => <button key={String(t)} onClick={() => setTheme(t as 'dark' | 'light')} className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${theme === t ? 'border-teal-300/35 bg-teal-300/[.08]' : 'border-border hover:bg-white/5'}`}><Icon size={17} className="text-teal-500" /><span><b className="block text-sm">{String(label)}</b><span className="text-[10px] text-muted-foreground">Theme</span></span>{theme === t && <Check size={15} className="ml-auto text-teal-500" />}</button>)}</div><label className="mt-5 flex items-center justify-between rounded-xl border border-border p-4"><span><b className="block text-sm">Reduced motion</b><span className="text-[10px] text-muted-foreground">Minimize transitions and ambient movement</span></span><input type="checkbox" checked={reduced} onChange={(e) => { setReduced(e.target.checked); document.documentElement.classList.toggle('reduce-motion', e.target.checked); }} className="h-4 w-4 accent-teal-400" data-testid="toggle-reduced-motion" /></label></Glass>
              <Glass className="p-5 sm:p-7"><Eyebrow>Responsible AI</Eyebrow><h2 className="display mt-2 text-xl font-bold">What leaves this room.</h2><div className="mt-5 grid gap-3">{[['External AI notice', 'Draft text and relevant clauses are sent for review.'], ['Synthetic demo content', 'Lumen Pay examples are fictional. No real customer data.'], ['Role-based access', 'Brand kit, creator, and reviewer permissions are distinct.'], ['Decision audit', 'Accept, edit, dismiss, and approvals are logged by the API.'], ['Human decision', 'AI suggestions do not publish or approve content.']].map(([title, desc]) => <div key={title} className="flex gap-3 rounded-xl bg-background/40 p-3"><CheckCheck size={15} className="mt-0.5 shrink-0 text-teal-500" /><div><b className="text-xs">{title}</b><p className="mt-1 text-[10px] leading-5 text-muted-foreground">{desc}</p></div></div>)}</div></Glass>
              <Glass className="p-5 sm:p-7"><Eyebrow>Connection</Eyebrow><h2 className="display mt-2 text-xl font-bold">API configuration</h2><div className="mt-4 grid gap-3"><label className="grid gap-1 text-[10px] font-semibold text-muted-foreground">API base URL<input value={API_BASE_URL} readOnly className="h-10 rounded-xl border border-border bg-background/40 px-3 font-mono text-xs text-foreground" /></label><div className="rounded-xl border border-violet-300/15 bg-violet-300/[.05] p-3 text-[10px] leading-5 text-muted-foreground">Fixture preview is <b className="text-foreground">{import.meta.env.VITE_USE_FIXTURES === 'true' ? 'enabled' : 'disabled'}</b>. Toggle VITE_USE_FIXTURES only for an explicit synthetic preview; otherwise API failures remain visible.</div></div></Glass>
              <Glass className="p-5 sm:p-7"><Eyebrow>Developer</Eyebrow><h2 className="display mt-2 text-xl font-bold">Test a graceful fallback.</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">Simulate an error boundary to inspect the recovery state. This does not affect saved API data.</p><Button variant="outline" className="mt-4" onClick={() => setExplode(true)} data-testid="button-simulate-error">Simulate error</Button>{explode && <ErrorBoundary key="simulated" FallbackComponent={({ error, resetError }) => <Glass className="mt-4 p-4"><b className="text-sm">Simulated fallback</b><p className="mt-1 text-xs text-muted-foreground">{error.message}</p><Button className="mt-3" onClick={() => { resetError(); setExplode(false); }}>Try again</Button></Glass>}><DeveloperCrash /></ErrorBoundary>}</Glass></div>
          </div>;
}
          function DeveloperCrash(): ReactNode { throw new Error('Simulated developer preview error. Your work is still safe.'); }

          function NotFoundPage() { return <div className="mx-auto max-w-xl py-16 text-center"><Glass className="p-10"><span className="display text-6xl font-bold text-teal-500">404</span><h1 className="display mt-4 text-2xl font-bold">This page needs a source.</h1><p className="mt-2 text-sm text-muted-foreground">We couldn't find the destination you requested.</p><Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-bold text-slate-950">Return to workspace</Link></Glass></div>; }

function RoutedPages() {
  const [location] = useLocation();
  const user = useSession((s) => s.user);
  const theme = useSession((s) => s.theme);
  const editorMatch = location.match(/^\/drafts\/([^/]+)$/);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

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
          <Route path="/brand-kit" component={BrandKitPage} />
          <Route path="/drafts" component={DraftsPage} />
          <Route path="/drafts/new" component={NewDraftPage} />
          {editorMatch && <Route path="/drafts/:id"><DraftEditorPage id={editorMatch[1]} /></Route>}
          <Route path="/review" component={ReviewQueuePage} />
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
