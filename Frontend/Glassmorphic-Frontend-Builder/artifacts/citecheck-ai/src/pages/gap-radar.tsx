import React, { useState } from 'react';
import { Link } from 'wouter';
import {
  Radar,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  ArrowUpRight,
  UserCheck,
  History,
  Archive,
  Info,
  X,
  MessageSquare,
  Sparkles,
  Sliders,
  FileCheck,
} from 'lucide-react';
import { useSession } from '@/store/session';
import { useGapRadar, useGapRadarAction } from '@/hooks/use-product-data';
import { Glass, Eyebrow, Tag, Button, PageHead, LoadingCards, ApiFailure, roleName, time } from '@/components/ui-atoms';
import {
  EmptyState,
  LoadingState,
  ErrorState,
  PermissionDenied,
} from '@/components/states';
import { toast } from 'sonner';

interface DismissalEvent {
  id: string;
  rule_or_fact_id: string;
  draft_id: string;
  finding_id?: string;
  reason: string;
  theme?: string;
  user_name: string;
  user_role: string;
  created_at?: string;
}

interface RadarItem {
  rule: string;
  guideline_id: string;
  guideline_code: string;
  category: string;
  text?: string;
  severity?: string;
  is_active?: boolean;
  flagged: number;
  accepted: number;
  dismissed: number;
  dismissal_rate: number;
  status: string;
  reasons: string[];
  events?: DismissalEvent[];
  themes?: Record<string, number>;
  revisions?: any[];
  recommendation?: string;
}

export function GapRadarPage() {
  const user = useSession((s) => s.user);
  const demoRole = useSession((s) => s.demoRole);
  const { data, isLoading, isError, error, refetch } = useGapRadar();
  const [tableView, setTableView] = useState(false);
  const [selectedRule, setSelectedRule] = useState<RadarItem | null>(null);
  const [actionModal, setActionModal] = useState<{
    item: RadarItem;
    type: 'edit_text' | 'exempt_context' | 'clarify_thresholds' | 'archive';
  } | null>(null);

  const radarItems: RadarItem[] = Array.isArray(data) ? data : [];

  // Summary counts
  const totalPolicies = radarItems.length;
  const unclearCount = radarItems.filter((r) => r.status === 'Unclear Policy' || r.dismissal_rate >= 50).length;
  const reviewCount = radarItems.filter((r) => r.status === 'Review Recommended' || (r.dismissal_rate >= 20 && r.dismissal_rate < 50)).length;
  const healthyCount = radarItems.filter((r) => r.status === 'Healthy' || r.dismissal_rate < 20).length;

  return (
    <div className="page-enter">
      <PageHead
        eyebrow="Brand governance · pattern review"
        title="Guideline Gap Radar"
        sub="Signals from creator dismissals highlight ambiguous brand policies. Fix the rule, not the person."
        action={
          <button
            onClick={() => setTableView(!tableView)}
            className="rounded-xl border border-border bg-card/50 px-4 py-2.5 text-xs font-bold hover:bg-card cursor-pointer transition"
          >
            {tableView ? 'Card view' : 'Table view'}
          </button>
        }
      />

      {/* Role Notice */}
      {user?.role !== 'brand_manager' && (
        <div className="mb-4">
          <PermissionDenied
            requiredRole="brand_manager"
            actionName="remediate guideline friction and add contextual exemptions"
            onSwitchRole={() => {
              demoRole('brand_manager');
              toast.success('Switched to Brand Manager role');
            }}
          />
        </div>
      )}

      {/* Metric Health Strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Glass className="p-4">
          <Eyebrow>Monitored Policies</Eyebrow>
          <div className="display mt-1 text-2xl font-bold">{totalPolicies}</div>
          <span className="text-[10px] text-muted-foreground">Active Brand Rules</span>
        </Glass>
        <Glass className="border-rose-300/30 bg-rose-300/[.05] p-4">
          <Eyebrow>Unclear (Friction Gap)</Eyebrow>
          <div className="display mt-1 text-2xl font-bold text-rose-500">{unclearCount}</div>
          <span className="text-[10px] text-rose-600 dark:text-rose-300">Rate ≥ 50% & Flags ≥ 4</span>
        </Glass>
        <Glass className="border-amber-300/30 bg-amber-300/[.05] p-4">
          <Eyebrow>Review Recommended</Eyebrow>
          <div className="display mt-1 text-2xl font-bold text-amber-500">{reviewCount}</div>
          <span className="text-[10px] text-amber-600 dark:text-amber-300">20% ≤ Rate &lt; 50%</span>
        </Glass>
        <Glass className="border-teal-300/30 bg-teal-300/[.05] p-4">
          <Eyebrow>Healthy / Aligned</Eyebrow>
          <div className="display mt-1 text-2xl font-bold text-teal-600 dark:text-teal-300">{healthyCount}</div>
          <span className="text-[10px] text-teal-600 dark:text-teal-300">High Adherence (&lt; 20%)</span>
        </Glass>
      </div>

      {isLoading ? (
        <LoadingState variant="cards" />
      ) : isError ? (
        <ErrorState error={error} retry={() => refetch()} />
      ) : radarItems.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="Zero guideline gaps detected"
          description="Signals from creator dismissals highlight ambiguous brand policies. As team members dismiss findings with reasons, friction clusters will automatically appear here."
          actionText="Inspect Brand Kit"
          actionHref="/brand-kit"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left Column: Cards or Table */}
          <Glass className="p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <Eyebrow>Policy Health & Friction</Eyebrow>
                <h2 className="display mt-1 text-xl font-bold">
                  {tableView ? 'Rule Comparison Table' : 'Ranked by Human Dismissal Rate'}
                </h2>
              </div>
              <Radar size={19} className="text-violet-500" />
            </div>

            {tableView ? (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="mono text-[10px] uppercase text-muted-foreground">
                    <tr>
                      <th className="pb-3">Rule Code & Title</th>
                      <th className="pb-3">Flagged</th>
                      <th className="pb-3">Dismissed</th>
                      <th className="pb-3">Rate</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {radarItems.map((r) => (
                      <tr key={r.guideline_id || r.rule} className="border-t border-border">
                        <td className="py-3 pr-2 font-semibold">
                          <span className="mono mr-1.5 text-[10px] text-violet-500">{r.guideline_code}</span>
                          {r.rule}
                        </td>
                        <td>{r.flagged}</td>
                        <td>{r.dismissed}</td>
                        <td className="font-mono font-bold">{r.dismissal_rate}%</td>
                        <td>
                          <Tag tone={r.status === 'Unclear Policy' ? 'amber' : r.status === 'Review Recommended' ? 'neutral' : 'teal'}>
                            {r.status}
                          </Tag>
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => setSelectedRule(r)}
                            className="text-xs text-teal-600 dark:text-teal-200 font-semibold hover:underline cursor-pointer"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {radarItems.map((r) => {
                  const isUnclear = r.status === 'Unclear Policy' || r.dismissal_rate >= 50;
                  const isReview = r.status === 'Review Recommended' || (r.dismissal_rate >= 20 && r.dismissal_rate < 50);

                  return (
                    <div
                      key={r.guideline_id || r.rule}
                      className={`rounded-2xl border p-4 transition ${
                        isUnclear
                          ? 'border-rose-400/30 bg-rose-400/[.03]'
                          : isReview
                          ? 'border-amber-400/20 bg-amber-400/[.02]'
                          : 'border-border bg-background/35'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="mono text-[10px] font-bold text-violet-500">{r.guideline_code}</span>
                          <h3 className="text-sm font-bold">{r.rule}</h3>
                        </div>
                        <Tag tone={isUnclear ? 'amber' : isReview ? 'neutral' : 'teal'}>
                          {r.status}
                        </Tag>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Dismissal Rate</span>
                          <span className={`font-mono font-bold ${isUnclear ? 'text-rose-500' : isReview ? 'text-amber-500' : 'text-teal-600'}`}>
                            {r.dismissed} / {r.flagged} ({r.dismissal_rate}%)
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-background/60">
                          <div
                            className={`h-full rounded-full ${
                              isUnclear
                                ? 'bg-gradient-to-r from-amber-400 to-rose-400'
                                : isReview
                                ? 'bg-gradient-to-r from-teal-400 to-amber-400'
                                : 'bg-gradient-to-r from-teal-400 to-emerald-400'
                            }`}
                            style={{ width: `${Math.min(100, r.dismissal_rate)}%` }}
                          />
                        </div>
                      </div>

                      {/* Theme Badges */}
                      {r.themes && Object.keys(r.themes).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                          <span className="text-[10px] text-muted-foreground mr-1">Friction themes:</span>
                          {Object.entries(r.themes).map(([theme, cnt]) => (
                            <span key={theme} className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                              {theme} ({cnt})
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                        <button
                          onClick={() => setSelectedRule(r)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-600 dark:text-teal-200 hover:underline cursor-pointer"
                        >
                          <MessageSquare size={13} /> Why is this rule causing friction? ({r.dismissed} comments)
                        </button>

                        {user?.role === 'brand_manager' && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setActionModal({ item: r, type: 'edit_text' })}
                              className="px-2.5 py-1 text-[11px]"
                            >
                              <Edit3 size={12} /> Edit
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setActionModal({ item: r, type: 'exempt_context' })}
                              className="px-2.5 py-1 text-[11px]"
                            >
                              <Sliders size={12} /> Exempt
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setActionModal({ item: r, type: 'clarify_thresholds' })}
                              className="px-2.5 py-1 text-[11px]"
                            >
                              <FileCheck size={12} /> Clarify
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Glass>

          {/* Right Column: Friction Inspector & Real Dismissal Comments */}
          <Glass className="p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <Eyebrow>Human Dismissal Inspector</Eyebrow>
                <h2 className="display mt-1 text-xl font-bold">
                  {selectedRule ? `${selectedRule.guideline_code}: ${selectedRule.rule}` : 'Select a Rule to Inspect'}
                </h2>
              </div>
              <Info size={18} className="text-teal-500" />
            </div>

            {selectedRule ? (
              <div className="mt-4 grid gap-4">
                {/* Rule Current Text */}
                <div className="rounded-xl border border-border bg-background/40 p-3.5">
                  <span className="mono text-[10px] font-bold uppercase text-muted-foreground">Current Rule Policy:</span>
                  <p className="mt-1 text-xs leading-5 text-foreground">
                    {selectedRule.text || 'No description provided.'}
                  </p>
                </div>

                {/* Recommendation */}
                {selectedRule.recommendation && (
                  <div className="rounded-xl border border-amber-300/30 bg-amber-300/[.06] p-3 text-xs leading-5">
                    <b className="text-amber-600 dark:text-amber-200 flex items-center gap-1.5">
                      <Sparkles size={14} /> Diagnostic Recommendation:
                    </b>
                    <p className="mt-0.5 text-muted-foreground">{selectedRule.recommendation}</p>
                  </div>
                )}

                {/* Real Dismissal Comments List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Eyebrow>Real Creator Dismissal Comments ({selectedRule.events?.length || selectedRule.dismissed})</Eyebrow>
                    <span className="text-[10px] text-muted-foreground">Direct from drafts</span>
                  </div>

                  {selectedRule.events && selectedRule.events.length > 0 ? (
                    <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                      {selectedRule.events.map((ev, idx) => (
                        <div key={ev.id || idx} className="rounded-xl border border-border/80 bg-white/[.02] p-3 text-xs">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                            <span className="font-semibold text-foreground">{ev.user_name} ({ev.user_role})</span>
                            <span>{time(ev.created_at)}</span>
                          </div>
                          <p className="text-foreground leading-snug">"{ev.reason}"</p>
                          {ev.theme && (
                            <span className="mt-2 inline-block rounded bg-teal-400/10 px-1.5 py-0.5 text-[9px] font-mono text-teal-600 dark:text-teal-300">
                              Theme: {ev.theme}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                      No recorded human dismissals for this policy. Guideline adherence is 100%.
                    </div>
                  )}
                </div>

                {/* Brand Manager Quick Actions */}
                {user?.role === 'brand_manager' && (
                  <div className="border-t border-border pt-4">
                    <Eyebrow>Brand Manager Remediation Actions</Eyebrow>
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setActionModal({ item: selectedRule, type: 'edit_text' })}
                        className="text-xs"
                      >
                        <Edit3 size={13} /> Edit Rule Text
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActionModal({ item: selectedRule, type: 'exempt_context' })}
                        className="text-xs"
                      >
                        <Sliders size={13} /> Exempt in Context
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActionModal({ item: selectedRule, type: 'clarify_thresholds' })}
                        className="text-xs"
                      >
                        <FileCheck size={13} /> Clarify Thresholds
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActionModal({ item: selectedRule, type: 'archive' })}
                        className="text-xs text-rose-500 hover:text-rose-600"
                      >
                        <Archive size={13} /> Archive Rule
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-12 text-center text-muted-foreground">
                <Radar className="mx-auto text-teal-400/50" size={36} />
                <p className="mt-3 text-sm font-semibold text-foreground">Click "Why is this rule causing friction?"</p>
                <p className="mt-1 text-xs">
                  Inspect the verbatim reasons recorded by creators whenever they dismissed a gate finding on any draft.
                </p>
              </div>
            )}
          </Glass>
        </div>
      )}

      {/* Remediation Modal */}
      {actionModal && (
        <RemediationModal
          item={actionModal.item}
          type={actionModal.type}
          onClose={() => setActionModal(null)}
          onSuccess={() => {
            setActionModal(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function RemediationModal({
  item,
  type,
  onClose,
  onSuccess,
}: {
  item: RadarItem;
  type: 'edit_text' | 'exempt_context' | 'clarify_thresholds' | 'archive';
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [text, setText] = useState(item.text || '');
  const [reason, setReason] = useState(
    type === 'exempt_context'
      ? 'Permitted when cited from executive press releases or audited third-party benchmark reports'
      : type === 'clarify_thresholds'
      ? 'Apply length limits only to prose sentences, excluding bulleted requirement lists'
      : type === 'archive'
      ? 'Retired rule due to high false positive rate and updated brand standards'
      : ''
  );
  const [details, setDetails] = useState('');
  const actionMutation = useGapRadarAction();

  const titleMap = {
    edit_text: `Edit Rule Text: ${item.guideline_code}`,
    exempt_context: `Add Contextual Exemption: ${item.guideline_code}`,
    clarify_thresholds: `Clarify Thresholds: ${item.guideline_code}`,
    archive: `Archive Rule Policy: ${item.guideline_code}`,
  };

  const handleSave = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a governance reason for this audit change.');
      return;
    }

    try {
      await actionMutation.mutateAsync({
        guidelineId: item.guideline_id,
        action: type,
        new_text: type === 'edit_text' ? text : undefined,
        reason: reason.trim(),
        details: details.trim() || undefined,
      });

      toast.success(`Rule ${item.guideline_code} updated successfully. Audit log entry created.`);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update rule');
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <Glass className="w-full max-w-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <Eyebrow>Brand Governance Action</Eyebrow>
            <h2 className="display mt-1 text-xl font-bold">{titleMap[type]}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Every policy remediation writes an immutable entry into the tamper-evident SHA-256 audit log.
        </p>

        <div className="mt-4 grid gap-3">
          {type === 'edit_text' && (
            <div>
              <label className="text-xs font-semibold text-foreground">Rule Wording</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-xl border border-border bg-background/50 p-3 text-xs leading-5 outline-none focus:border-teal-400"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-foreground">
              {type === 'exempt_context'
                ? 'Exemption Specification & Permitted Scenarios'
                : type === 'clarify_thresholds'
                ? 'Threshold Clarification & Scope'
                : 'Governance Reason (required for audit trail)'}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Permitted in partner joint announcements..."
              className="mt-1 w-full rounded-xl border border-border bg-background/50 p-3 text-xs leading-5 outline-none focus:border-teal-400"
            />
          </div>

          {(type === 'exempt_context' || type === 'clarify_thresholds') && (
            <div>
              <label className="text-xs font-semibold text-foreground">Optional Condition / Filter Keywords</label>
              <input
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="e.g. partner_deck, b2b_brief, security_whitepaper"
                className="mt-1 w-full rounded-xl border border-border bg-background/50 p-2.5 text-xs outline-none focus:border-teal-400"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={actionMutation.isPending}
              className={type === 'archive' ? 'bg-rose-500 hover:bg-rose-600 text-white' : ''}
            >
              {actionMutation.isPending ? 'Saving...' : type === 'archive' ? 'Archive Rule' : 'Save & Audit'}
            </Button>
          </div>
        </div>
      </Glass>
    </div>
  );
}
