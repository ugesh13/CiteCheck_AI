import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  History,
  RotateCw,
  Archive,
  Check,
  AlertTriangle,
  X,
  Layers3,
  Settings2,
  ShieldAlert,
  ChevronDown,
  User,
} from 'lucide-react';
import { api } from '@/lib/api/endpoints';
import { useFactHistory, useFactsHealth } from '@/hooks/use-product-data';
import type { Fact } from '@/lib/api/types';
import { Button, Glass, Eyebrow, Tag, getFactExpiry } from '@/components/ui-atoms';

interface BrandKitFactsProps {
  facts: Fact[];
  canEdit: boolean;
  onEditFact: (id: string, item: any) => void;
  onRemoveFact: (id: string) => void;
}

export function BrandKitFacts({ facts, canEdit, onEditFact, onRemoveFact }: BrandKitFactsProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'expired' | 'archived'>('all');
  const [renewFactId, setRenewFactId] = useState<string | null>(null);
  const [historyFactId, setHistoryFactId] = useState<string | null>(null);
  const [renewalDays, setRenewalDays] = useState(90);

  const client = useQueryClient();
  const healthQuery = useFactsHealth();
  const historyQuery = useFactHistory(historyFactId || '');

  // Live computed counts
  const computedStats = useMemo(() => {
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let archived = 0;

    facts.forEach((f) => {
      if (f.status_override === 'archived') {
        archived++;
        return;
      }
      const exp = getFactExpiry(f.review_date);
      if (exp.isExpired) expired++;
      else if (exp.isExpiringSoon) expiring++;
      else active++;
    });

    return { total: facts.length, active, expiring, expired, archived };
  }, [facts]);

  // Sort by review_date ascending (expired first) by default
  const sortedAndFilteredFacts = useMemo(() => {
    let list = [...facts];

    // Filter
    if (filter === 'active') {
      list = list.filter((f) => f.status_override !== 'archived' && !getFactExpiry(f.review_date).isExpired && !getFactExpiry(f.review_date).isExpiringSoon);
    } else if (filter === 'expiring') {
      list = list.filter((f) => f.status_override !== 'archived' && getFactExpiry(f.review_date).isExpiringSoon);
    } else if (filter === 'expired') {
      list = list.filter((f) => f.status_override !== 'archived' && getFactExpiry(f.review_date).isExpired);
    } else if (filter === 'archived') {
      list = list.filter((f) => f.status_override === 'archived');
    }

    // Sort ascending by review_date
    list.sort((a, b) => {
      const dateA = new Date(a.review_date || '9999-12-31').getTime();
      const dateB = new Date(b.review_date || '9999-12-31').getTime();
      return dateA - dateB;
    });

    return list;
  }, [facts, filter]);

  const handleRenew = async () => {
    if (!renewFactId) return;
    try {
      await api.renewFact(renewFactId, renewalDays);
      await client.invalidateQueries({ queryKey: ['brand-kit'] });
      await client.invalidateQueries({ queryKey: ['facts-health'] });
      await client.invalidateQueries({ queryKey: ['fact-history', renewFactId] });
      toast.success(`Fact ${renewFactId} renewed for +${renewalDays} days`);
      setRenewFactId(null);
    } catch (e: any) {
      toast.error(e?.message || 'Renewal failed');
    }
  };

  const handleArchive = async (factId: string) => {
    if (!confirm(`Archive ${factId}? It will no longer be considered an approved source for claims.`)) return;
    try {
      await api.archiveFact(factId);
      await client.invalidateQueries({ queryKey: ['brand-kit'] });
      await client.invalidateQueries({ queryKey: ['facts-health'] });
      toast.success(`Fact ${factId} archived`);
    } catch (e: any) {
      toast.error(e?.message || 'Archive failed');
    }
  };

  const handleToggleAI = async (factId: string, currentVal: boolean) => {
    const fact = facts.find((f) => f.id === factId);
    if (!fact) return;
    try {
      await api.saveKitItem('facts', { ...fact, allow_ai: !currentVal }, factId);
      await client.invalidateQueries({ queryKey: ['brand-kit'] });
      toast.success(`AI use permission updated for ${factId}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update AI flag');
    }
  };

  return (
    <div className="space-y-4">
      {/* Live Health Strip (Computed from Real Fact Review Dates) */}
      <Glass className="flex flex-wrap items-center justify-between gap-3 border-teal-300/25 bg-teal-300/[.05] p-3.5 sm:p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-300/20 text-teal-600 dark:text-teal-200">
            <Layers3 size={18} />
          </span>
          <div>
            <b className="text-xs text-foreground">
              {computedStats.total} Approved Brand Kit Facts · Dynamic Expiry Engine
            </b>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {computedStats.active} Active · {computedStats.expired} Expired · {computedStats.expiring} Expiring soon (≤30d). Claims citing expired facts pause publication.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Tag tone="teal">{computedStats.active} Active</Tag>
          {computedStats.expired > 0 && <Tag tone="rose">{computedStats.expired} Expired</Tag>}
          {computedStats.expiring > 0 && <Tag tone="amber">{computedStats.expiring} Expiring soon</Tag>}
          {computedStats.archived > 0 && <Tag tone="neutral">{computedStats.archived} Archived</Tag>}
        </div>
      </Glass>

      {/* Filter and Sorting Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-border bg-background/50 p-1">
          {(
            [
              { id: 'all', label: `All (${computedStats.total})` },
              { id: 'expired', label: `Expired (${computedStats.expired})` },
              { id: 'expiring', label: `Expiring Soon (${computedStats.expiring})` },
              { id: 'active', label: `Active (${computedStats.active})` },
              { id: 'archived', label: `Archived (${computedStats.archived})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                filter === t.id
                  ? 'bg-teal-300 text-slate-950 shadow-sm'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <span className="mono text-[10px] text-muted-foreground">
          Sorted by review date (expired first)
        </span>
      </div>

      {/* Facts Cards List */}
      <div className="grid gap-3">
        {sortedAndFilteredFacts.map((item) => {
          const exp = getFactExpiry(item.review_date);
          const isArchived = item.status_override === 'archived';

          return (
            <Glass
              key={item.id}
              className={`glass-hover grid gap-4 p-5 md:grid-cols-[140px_1fr_auto] md:items-center ${
                isArchived ? 'opacity-50' : exp.isExpired ? 'border-rose-400/30' : exp.isExpiringSoon ? 'border-amber-400/30' : ''
              }`}
              data-testid={`card-fact-${item.id}`}
            >
              <div>
                <span className="mono text-xs font-bold text-violet-500 dark:text-violet-200">
                  {item.id}
                </span>
                <div className="mt-2">
                  {isArchived ? (
                    <Tag tone="neutral">Archived</Tag>
                  ) : (
                    <Tag tone={exp.tone}>{exp.label}</Tag>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold leading-6 text-foreground">{item.text}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Source: <b className="text-foreground">{item.source}</b></span>
                  <span>·</span>
                  <span>
                    Review date:{' '}
                    <b
                      className={
                        exp.isExpired
                          ? 'text-rose-500'
                          : exp.isExpiringSoon
                          ? 'text-amber-500'
                          : 'text-teal-600 dark:text-teal-300'
                      }
                    >
                      {item.review_date}
                    </b>
                  </span>
                  {item.owner_name && (
                    <>
                      <span>·</span>
                      <span>Owner: <b className="text-foreground">{item.owner_name}</b></span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.allow_ai}
                    disabled={!canEdit || isArchived}
                    onChange={() => handleToggleAI(item.id, item.allow_ai)}
                    className="accent-teal-400"
                    data-testid={`toggle-fact-ai-${item.id}`}
                  />
                  Allow AI
                </label>

                {/* History Button */}
                <button
                  type="button"
                  onClick={() => setHistoryFactId(item.id)}
                  title="View Fact Renewal History"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground transition"
                >
                  <History size={15} />
                </button>

                {canEdit && (
                  <>
                    {/* Renew Shortcut Button */}
                    <button
                      type="button"
                      onClick={() => setRenewFactId(item.id)}
                      title="Renew Fact Review Date"
                      className="rounded-lg p-2 text-teal-600 hover:bg-teal-400/10 dark:text-teal-300 transition"
                    >
                      <RotateCw size={15} />
                    </button>

                    {/* Archive Button */}
                    {!isArchived && (
                      <button
                        type="button"
                        onClick={() => handleArchive(item.id)}
                        title="Archive Fact"
                        className="rounded-lg p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground transition"
                      >
                        <Archive size={15} />
                      </button>
                    )}

                    {/* Edit Fact Modal */}
                    <button
                      type="button"
                      onClick={() => onEditFact(item.id, item)}
                      title={`Edit ${item.id}`}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-teal-400/10 hover:text-teal-500 transition"
                    >
                      <Settings2 size={15} />
                    </button>

                    {/* Delete Fact */}
                    <button
                      type="button"
                      onClick={() => onRemoveFact(item.id)}
                      title={`Delete ${item.id}`}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-rose-400/10 hover:text-rose-500 transition"
                    >
                      <X size={15} />
                    </button>
                  </>
                )}
              </div>
            </Glass>
          );
        })}

        {sortedAndFilteredFacts.length === 0 && (
          <Glass className="p-8 text-center">
            <Layers3 className="mx-auto text-muted-foreground" size={28} />
            <h3 className="display mt-3 font-bold text-foreground">No facts in this view</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try switching filters or add a new approved fact.
            </p>
          </Glass>
        )}
      </div>

      {/* RENEW MODAL */}
      {renewFactId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setRenewFactId(null)}
        >
          <div
            className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <Eyebrow>Brand Governance Renewal</Eyebrow>
                <h3 className="display mt-1 text-lg font-bold text-foreground">
                  Renew {renewFactId} Review Date
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRenewFactId(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <p className="mt-3 text-xs text-muted-foreground leading-5">
              Extending the review expiration date confirms this fact remains active and valid for public marketing claims.
            </p>

            <div className="mt-4 space-y-3">
              <label className="mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Choose Renewal Period:
              </label>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { days: 90, label: '+90 Days (1 Qtr)' },
                  { days: 180, label: '+180 Days (6 Mos)' },
                  { days: 365, label: '+365 Days (1 Yr)' },
                ].map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => setRenewalDays(opt.days)}
                    className={`rounded-xl border p-2.5 text-xs font-bold transition ${
                      renewalDays === opt.days
                        ? 'border-teal-400 bg-teal-400/10 text-teal-600 dark:text-teal-300'
                        : 'border-border bg-background/50 text-muted-foreground hover:bg-white/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenewFactId(null)}>
                Cancel
              </Button>
              <Button onClick={handleRenew}>
                <Check size={14} /> Confirm Renewal (+{renewalDays}d)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FACT HISTORY MODAL */}
      {historyFactId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setHistoryFactId(null)}
        >
          <div
            className="glass w-full max-w-lg rounded-2xl p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <Eyebrow>Provenance Audit Trail</Eyebrow>
                <h3 className="display mt-1 text-lg font-bold text-foreground">
                  History for {historyFactId}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryFactId(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 max-h-[360px] overflow-y-auto space-y-2.5 pr-1">
              {historyQuery.isLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Loading history...</div>
              ) : !historyQuery.data || historyQuery.data.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No historical renewals logged yet for {historyFactId}.
                </div>
              ) : (
                historyQuery.data.map((h: any, idx: number) => (
                  <div
                    key={h.id || idx}
                    className="rounded-xl border border-border/70 bg-background/50 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground capitalize">{h.action || 'Updated'}</span>
                      <span className="mono text-[10px] text-muted-foreground">
                        {h.at ? new Date(h.at).toLocaleString() : 'Recent'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{h.reason}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Actor: <b className="text-foreground">{h.actor}</b></span>
                      {h.new_expires_on && (
                        <span>
                          Expires: <b className="text-teal-600 dark:text-teal-300">{h.new_expires_on}</b>
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <Button variant="outline" onClick={() => setHistoryFactId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

