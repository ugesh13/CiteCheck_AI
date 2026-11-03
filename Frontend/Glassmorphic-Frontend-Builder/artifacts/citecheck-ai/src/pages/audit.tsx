import React, { useState } from 'react';
import {
  History,
  ShieldCheck,
  ShieldAlert,
  Search,
  Download,
  CheckCircle2,
  Lock,
  RefreshCw,
  Hash,
  ExternalLink,
} from 'lucide-react';
import { useAuditLog } from '@/hooks/use-product-data';
import { api } from '@/lib/api/endpoints';
import { Glass, Eyebrow, Tag, Button, PageHead, LoadingCards, ApiFailure, roleName, time } from '@/components/ui-atoms';
import {
  EmptyState,
  LoadingState,
  ErrorState,
  NoResults,
} from '@/components/states';
import { toast } from 'sonner';

interface VerificationResult {
  valid: boolean;
  total_records: number;
  broken_index?: number | null;
  genesis_hash?: string;
  latest_hash?: string;
}

export function AuditPage() {
  const { data, isLoading, isError, error, refetch } = useAuditLog();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const auditList = Array.isArray(data) ? data : [];

  const rows = auditList.filter((entry) => {
    const matchesSearch = `${entry.who} ${entry.role} ${entry.action} ${entry.target} ${entry.reason || ''} ${entry.details || ''}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesRole = roleFilter === 'All' || entry.role === roleFilter;
    const actionLower = entry.action.toLowerCase();
    const matchesAction =
      actionFilter === 'All'
        ? true
        : actionFilter === 'Decisions'
        ? actionLower.includes('dismiss') || actionLower.includes('accept') || actionLower.includes('edit')
        : actionFilter === 'Approvals'
        ? actionLower.includes('approv') || actionLower.includes('request')
        : actionFilter === 'Submissions'
        ? actionLower.includes('submit') || actionLower.includes('executed') || actionLower.includes('version')
        : actionFilter === 'Brand Kit'
        ? actionLower.includes('brand') || actionLower.includes('fact') || actionLower.includes('guideline') || actionLower.includes('remediation')
        : true;
    return matchesSearch && matchesRole && matchesAction;
  });

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    try {
      const res = await api.verifyAuditLog();
      setVerificationResult(res as unknown as VerificationResult);
      if (res.valid) {
        toast.success(`Cryptographic integrity verified: ${res.total_records} audit entries linked.`);
      } else {
        toast.error(`Audit hash chain broken at record index ${res.broken_index}!`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to verify chain integrity');
    } finally {
      setVerifying(false);
    }
  };

  const exportCSV = () => {
    const csv = [
      ['who', 'role', 'action', 'target', 'reason', 'details', 'timestamp'],
      ...rows.map((r) => [r.who, r.role, r.action, r.target, r.reason || '', r.details || '', r.timestamp]),
    ]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = `citecheck-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="page-enter">
      <PageHead
        eyebrow="Tamper-evident governance"
        title="Immutable Audit Trail"
        sub="Every human decision, AI review trace, brand kit renewal, and reviewer sign-off is cryptographically chained."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleVerifyIntegrity}
              disabled={verifying}
              className="border-teal-400/30 text-teal-600 dark:text-teal-200 hover:bg-teal-300/10 cursor-pointer text-xs"
            >
              <ShieldCheck size={14} className={verifying ? 'animate-spin' : ''} />
              {verifying ? 'Verifying Hashes…' : 'Verify Log Integrity'}
            </Button>
            <Button variant="outline" onClick={exportCSV} disabled={!rows.length} className="text-xs">
              <Download size={14} /> Export CSV
            </Button>
          </div>
        }
      />

      {/* Cryptographic Verification Banner */}
      {verificationResult && (
        <Glass
          className={`mb-4 border p-4 transition-all ${
            verificationResult.valid
              ? 'border-teal-400/40 bg-teal-400/[.06]'
              : 'border-rose-400/40 bg-rose-400/[.06]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                  verificationResult.valid
                    ? 'bg-teal-400/20 text-teal-600 dark:text-teal-200'
                    : 'bg-rose-400/20 text-rose-500'
                }`}
              >
                {verificationResult.valid ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
              </span>
              <div>
                <b className="text-xs text-foreground flex items-center gap-2">
                  {verificationResult.valid
                    ? `Cryptographic Integrity Verified: ${verificationResult.total_records} events linked`
                    : `Tamper Detected: Chain broken at event #${verificationResult.broken_index}`}
                  <Tag tone={verificationResult.valid ? 'teal' : 'amber'}>SHA-256 Chain</Tag>
                </b>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Each record includes a cryptographic SHA-256 hash of its contents concatenated with the previous block hash.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mono text-[10px] text-muted-foreground">
              {verificationResult.genesis_hash && (
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">Genesis Block:</span>
                  <span className="font-semibold text-foreground">{verificationResult.genesis_hash.slice(0, 10)}…</span>
                </div>
              )}
              {verificationResult.latest_hash && (
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">Latest Block:</span>
                  <span className="font-semibold text-foreground">{verificationResult.latest_hash.slice(0, 10)}…</span>
                </div>
              )}
            </div>
          </div>
        </Glass>
      )}

      {/* Filter Bar */}
      <Glass className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-border bg-background/45 px-3 sm:w-72">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit trail…"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            data-testid="input-audit-filter"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Role:</span>
            <div className="flex gap-1">
              {[
                ['All', 'All'],
                ['creator', 'Creator'],
                ['reviewer', 'Reviewer'],
                ['brand_manager', 'Brand Manager'],
              ].map(([r, label]) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    roleFilter === r
                      ? 'bg-teal-300 text-slate-950 font-bold'
                      : 'text-muted-foreground hover:bg-white/5'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Action:</span>
            <div className="flex gap-1">
              {['All', 'Decisions', 'Approvals', 'Submissions', 'Brand Kit'].map((act) => (
                <button
                  key={act}
                  onClick={() => setActionFilter(act)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    actionFilter === act
                      ? 'bg-teal-300 text-slate-950 font-bold'
                      : 'text-muted-foreground hover:bg-white/5'
                  }`}
                >
                  {act}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Glass>

      {/* Audit Log Table */}
      {isLoading ? (
        <LoadingState variant="table" />
      ) : isError ? (
        <ErrorState error={error} retry={() => refetch()} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-3xl border border-border bg-card/40 md:block">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[.04] text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-4 font-bold">Actor</th>
                  <th className="px-4 py-4 font-bold">Role</th>
                  <th className="px-4 py-4 font-bold">Action Taken</th>
                  <th className="px-4 py-4 font-bold">Target & Scope</th>
                  <th className="px-4 py-4 font-bold">Reason & Governance Context</th>
                  <th className="px-4 py-4 font-bold">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border/70 hover:bg-white/[.025]" data-testid={`row-audit-${row.id}`}>
                    <td className="px-4 py-4 font-bold text-foreground">{row.who}</td>
                    <td className="px-4 py-4">
                      <Tag tone={row.role === 'brand_manager' ? 'teal' : row.role === 'reviewer' ? 'violet' : 'neutral'}>
                        {roleName(row.role)}
                      </Tag>
                    </td>
                    <td className="px-4 py-4 font-medium">{row.action}</td>
                    <td className="px-4 py-4 mono text-[11px] text-muted-foreground">{row.target}</td>
                    <td className="px-4 py-4 max-w-sm">
                      <b className="block text-foreground text-xs leading-5">{row.reason || '—'}</b>
                      {row.details && (
                        <span className="mt-0.5 block text-[11px] text-muted-foreground leading-4">{row.details}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">{time(row.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {rows.map((row) => (
              <Glass key={row.id} className="p-4">
                <div className="flex items-center justify-between">
                  <b className="text-sm">{row.who}</b>
                  <Tag tone={row.role === 'brand_manager' ? 'teal' : row.role === 'reviewer' ? 'violet' : 'neutral'}>
                    {roleName(row.role)}
                  </Tag>
                </div>
                <p className="mt-2 text-xs font-semibold">{row.action}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{row.target}</p>
                {row.reason && (
                  <div className="mt-2 rounded-lg bg-white/[.03] p-2 text-xs">
                    <span className="font-bold text-foreground">Reason: </span>
                    <span className="text-muted-foreground">{row.reason}</span>
                  </div>
                )}
                <p className="mono mt-2.5 text-[10px] text-muted-foreground">{time(row.timestamp)}</p>
              </Glass>
            ))}
          </div>

          {!rows.length && (
            search || roleFilter !== 'All' || actionFilter !== 'All' ? (
              <NoResults
                query={search || `${roleFilter !== 'All' ? `Role: ${roleFilter}` : ''} ${actionFilter !== 'All' ? `Action: ${actionFilter}` : ''}`.trim()}
                onClear={() => {
                  setSearch('');
                  setRoleFilter('All');
                  setActionFilter('All');
                }}
              />
            ) : (
              <EmptyState
                icon={History}
                title="No audit entries recorded"
                description="Every human decision, fact renewal, and review action will create a permanent SHA-256 block here."
              />
            )
          )}
        </>
      )}
    </div>
  );
}

