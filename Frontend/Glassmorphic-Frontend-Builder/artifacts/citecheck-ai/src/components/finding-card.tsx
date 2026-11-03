import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import type { Finding } from '@/lib/api/types';
import { useBrandKit, useDecision } from '@/hooks/use-product-data';
import { useSession } from '@/store/session';
import { editSchema } from '@/lib/schemas';
import { Button, Glass, Eyebrow, Tag, TextArea, getFactExpiry } from '@/components/ui-atoms';
import { VerificationTrace } from '@/components/verification-trace';

const DISMISSAL_REASON_OPTIONS = [
  'Pre-approved campaign exception by Legal Counsel',
  'Customer testimonial quote, not company assertion',
  'Descriptive benefit, not an absolute claim',
  'Technical banking protocol spec (not marketing claim)',
  'Date format specified by platform app store guideline',
  'Quarterly promotional fee lock confused with lifetime guarantee',
  'Context was standard security control, not marketing hype',
  'Other reason (provide context below)',
];

export function FindingCard({
  finding,
  draftId,
  index,
  canResolve,
}: {
  finding: Finding;
  draftId: string;
  index: number;
  canResolve: boolean;
}) {
  const decision = useDecision(draftId);
  const brandKitQuery = useBrandKit();
  const [editOpen, setEditOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissCategory, setDismissCategory] = useState(DISMISSAL_REASON_OPTIONS[0]);
  const [dismissDetails, setDismissDetails] = useState('');
  const [sourceModalOpen, setSourceModalOpen] = useState(false);

  const form = useForm<{ edited_fix: string }>({
    resolver: zodResolver(editSchema),
    defaultValues: { edited_fix: finding.suggested_fix },
  });

  const submitEdit = form.handleSubmit(async (values) => {
    try {
      await decision.mutateAsync({ id: finding.id, action: 'edit', edited_fix: values.edited_fix });
      toast.success('Edit saved to the decision log');
      setEditOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save edit');
    }
  });

  const selected = useSession((s) => s.selectedFinding);
  const setSelected = useSession((s) => s.setSelectedFinding);

  const act = async (action: 'accept' | 'dismiss', reason?: string) => {
    try {
      await decision.mutateAsync({ id: finding.id, action, ...(action === 'dismiss' ? { reason } : {}) });
      toast.success(action === 'accept' ? 'Suggested fix accepted' : 'Finding dismissed with reason');
      setDismissOpen(false);
      setDismissDetails('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Decision failed');
    }
  };

  const handleConfirmDismiss = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = dismissDetails.trim() ? `${dismissCategory}: ${dismissDetails.trim()}` : dismissCategory;
    act('dismiss', finalReason);
  };

  const resolved = finding.status !== 'open';
  const tone = finding.severity === 'high' ? 'rose' : finding.severity === 'medium' ? 'amber' : 'teal';

  // Real ground truth lookup from Brand Kit
  const citedFact = brandKitQuery.data?.facts?.find((f) => f.id === finding.source_ref_id);
  const citedGuideline = brandKitQuery.data?.guidelines?.find((g) => g.id === finding.source_ref_id);
  const citedTerm = brandKitQuery.data?.terms?.find((t) => t.id === finding.source_ref_id);
  const factExpiry = citedFact ? getFactExpiry(citedFact.review_date) : null;
  const isFactExpired = finding.verification_status === 'blocked_expired_fact' || Boolean(factExpiry?.isExpired);

  const statusChip = isFactExpired ? (
    <Tag tone="rose">Blocked: Expired Fact</Tag>
  ) : (finding.confidence < 0.8 || finding.fix_needs_human || finding.verification_status === 'human_review_required') ? (
    <Tag tone="amber">Human Review Required</Tag>
  ) : (
    <Tag tone="teal">Verified Finding</Tag>
  );

  return (
    <Glass
      tabIndex={0}
      onClick={() => setSelected(finding.id)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || resolved || !canResolve) return;
        const key = event.key.toLowerCase();
        if (key === 'a') void act('accept');
        if (key === 'e') setEditOpen(true);
        if (key === 'd') setDismissOpen(true);
      }}
      className={`p-4 transition ${resolved ? 'opacity-65' : ''} ${selected === finding.id ? 'ring-1 ring-teal-300/45' : ''}`}
      data-testid={`card-finding-${finding.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="mono grid h-7 w-7 place-items-center rounded-lg bg-violet-300/10 text-[10px] text-violet-600 dark:text-violet-200">
            {index + 1}
          </span>
          <span className="text-sm font-bold">{finding.type}</span>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {statusChip}
          <Tag tone={tone}>{finding.severity}</Tag>
          <Tag tone={finding.source === 'ai' || finding.source === 'llm' ? 'violet' : 'teal'}>
            {finding.source === 'ai' || finding.source === 'llm' ? 'AI-assisted' : 'Rule-based'}
          </Tag>
        </div>
      </div>

      <div className="mt-4">
        <Eyebrow>Exact excerpt</Eyebrow>
        <p className={`mt-2 rounded-xl border px-3 py-2.5 font-mono text-xs ${finding.severity === 'high' ? 'border-rose-300/15 bg-rose-300/[.07]' : 'border-amber-300/15 bg-amber-300/[.06]'}`}>
          “{finding.excerpt}”
        </p>
      </div>

      <div className="mt-4">
        <Eyebrow>Reason & source</Eyebrow>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{finding.reason}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSourceModalOpen(true);
            }}
            className="inline-flex cursor-pointer transition hover:opacity-80 active:scale-95"
            title="Inspect source ground truth in Brand Kit"
          >
            <Tag tone="violet">{finding.source_ref_id} ↗</Tag>
          </button>
          {finding.confidence < 0.8 && <Tag tone="amber">Needs human review</Tag>}
          {finding.fix_needs_human && <Tag tone="amber">Numbers guarded</Tag>}
          {isFactExpired && <Tag tone="rose">Source overdue re-verification</Tag>}
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-background/45 p-3">
        <Eyebrow>Intent-preserving fix</Eyebrow>
        <p className="mt-2 text-xs">
          <span className="text-muted-foreground line-through">{finding.excerpt}</span>
          <span className="mx-2">→</span>
          <span className="font-semibold text-teal-600 dark:text-teal-200">{finding.suggested_fix}</span>
        </p>
        {finding.fix_needs_human && <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-200">Numbers and names are guarded; changes go to a human.</p>}
      </div>

      {/* 5-Gate Evidence Verifier Trace */}
      <VerificationTrace finding={finding} />

      {/* Source Provenance Dialog */}
      {sourceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setSourceModalOpen(false);
          }}
        >
          <div
            className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Eyebrow>Ground Truth Provenance</Eyebrow>
                <h3 className="display mt-1 text-lg font-bold">
                  {finding.source_ref_id}: {citedFact ? 'Approved Fact' : citedGuideline ? 'Brand Guideline' : citedTerm ? 'Brand Term' : 'Brand Kit Reference'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSourceModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              {citedFact && (
                <>
                  <div className="rounded-xl border border-border bg-background/60 p-3">
                    <span className="mono text-[9px] text-muted-foreground uppercase block">Fact Statement</span>
                    <p className="mt-1 font-semibold text-foreground">{citedFact.text}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-border bg-background/40 p-2.5">
                      <span className="mono text-[9px] text-muted-foreground uppercase block">Source Document</span>
                      <span className="font-semibold text-foreground truncate block">{citedFact.source}</span>
                    </div>
                    <div className="rounded-xl border border-border bg-background/40 p-2.5">
                      <span className="mono text-[9px] text-muted-foreground uppercase block">Review Date</span>
                      <span className={`font-semibold block ${factExpiry?.isExpired ? 'text-rose-500' : 'text-foreground'}`}>
                        {citedFact.review_date} {factExpiry?.isExpired ? '(Expired)' : '(Active)'}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {citedGuideline && (
                <>
                  <div className="rounded-xl border border-border bg-background/60 p-3">
                    <span className="mono text-[9px] text-muted-foreground uppercase block">Guideline Title</span>
                    <p className="mt-1 font-bold text-foreground">{citedGuideline.title}</p>
                    <p className="mt-1 text-muted-foreground">{citedGuideline.text}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-2.5">
                    <span className="mono text-[9px] text-muted-foreground uppercase block">Category</span>
                    <span className="font-semibold capitalize text-foreground">{citedGuideline.category || 'General'}</span>
                  </div>
                </>
              )}

              {citedTerm && (
                <div className="rounded-xl border border-border bg-background/60 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="mono text-[9px] text-rose-500 uppercase block">Banned Term</span>
                      <span className="font-semibold line-through text-rose-500">{citedTerm.banned}</span>
                    </div>
                    <div>
                      <span className="mono text-[9px] text-teal-600 dark:text-teal-300 uppercase block">Preferred Term</span>
                      <span className="font-semibold text-teal-600 dark:text-teal-300">{citedTerm.preferred}</span>
                    </div>
                  </div>
                </div>
              )}

              {!citedFact && !citedGuideline && !citedTerm && (
                <div className="rounded-xl border border-rose-400/20 bg-rose-400/[.05] p-3 text-rose-500">
                  Source code <b>{finding.source_ref_id}</b> is not found in the current Brand Kit baseline.
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <Button variant="outline" className="text-xs py-2 px-3" onClick={() => setSourceModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {resolved ? (
        <div className="mt-4 rounded-lg bg-teal-300/10 px-3 py-2 text-xs font-bold text-teal-700 dark:text-teal-200">
          {finding.status === 'dismissed' ? 'Dismissed with reason' : 'Decision recorded'}
        </div>
      ) : (
        <div className="mt-4">
          <Eyebrow>Human decision</Eyebrow>
          {!canResolve && (
            <p className="mt-2 text-[10px] text-muted-foreground">Creator-only decision. Switch to a Creator role to resolve findings.</p>
          )}

          {editOpen ? (
            <form onSubmit={submitEdit} className="mt-3 grid gap-2">
              <TextArea label="Edit the proposed fix" rows={2} {...form.register('edited_fix')} error={form.formState.errors.edited_fix?.message} data-testid={`input-edit-fix-${finding.id}`} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={decision.isPending}>Save edit</Button>
              </div>
            </form>
          ) : dismissOpen ? (
            <form onSubmit={handleConfirmDismiss} className="mt-3 grid gap-3 rounded-2xl border border-rose-300/20 bg-rose-300/[.04] p-4">
              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                Dismissal Reason (feeds Guideline Gap Radar)
                <select
                  value={dismissCategory}
                  onChange={(e) => setDismissCategory(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-teal-400"
                >
                  {DISMISSAL_REASON_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                Additional context / rationale (optional)
                <textarea
                  value={dismissDetails}
                  onChange={(e) => setDismissDetails(e.target.value)}
                  placeholder="Provide context for the Brand Manager to inspect on Gap Radar..."
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground outline-none focus:border-teal-400"
                />
              </label>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setDismissOpen(false)}>Cancel</Button>
                <Button type="submit" variant="danger">Confirm Dismiss</Button>
              </div>
            </form>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => act('accept')} disabled={decision.isPending || !canResolve} className="px-3 py-2 text-[10px]" data-testid={`button-accept-${finding.id}`}>
                <Check size={13} /> Accept
              </Button>
              <Button variant="quiet" onClick={() => setEditOpen(true)} disabled={!canResolve} className="px-3 py-2 text-[10px]" data-testid={`button-edit-${finding.id}`}>
                Edit
              </Button>
              <Button variant="quiet" onClick={() => setDismissOpen(true)} disabled={!canResolve} className="px-3 py-2 text-[10px]" data-testid={`button-dismiss-${finding.id}`}>
                Dismiss (reason)
              </Button>
              <span className="ml-auto self-center text-[9px] text-muted-foreground">A · E · D</span>
            </div>
          )}
        </div>
      )}
    </Glass>
  );
}
