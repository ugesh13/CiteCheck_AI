import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, ChevronDown, Filter, AlertCircle, ArrowRight } from 'lucide-react';
import type { Dropped, ReviewSummary } from '@/lib/api/types';

interface VerifierFunnelProps {
  summary?: ReviewSummary;
  dropped?: Dropped[];
  findingsCount: number;
}

export function VerifierFunnel({ summary, dropped = [], findingsCount }: VerifierFunnelProps) {
  const [showDropped, setShowDropped] = useState(true);

  // Derive counts from live summary if available, otherwise compute from findings and dropped
  const total = summary ? summary.total_candidates : findingsCount + dropped.length;
  const p1 = summary ? summary.passed_gate_1 : total;
  const p2 = summary ? summary.passed_gate_2 : total - dropped.filter((d) => d.failed_gate === 1 || d.failed_gate === 2).length;
  const p3 = summary ? summary.passed_gate_3 : p2 - dropped.filter((d) => d.failed_gate === 3).length;
  const p4 = summary ? summary.passed_gate_4 : p3 - dropped.filter((d) => d.failed_gate === 4).length;
  const p5 = summary ? summary.passed_gate_5 : p4 - dropped.filter((d) => d.failed_gate === 5).length;
  const shown = summary ? summary.returned_findings : findingsCount;
  const blockedCount = summary ? summary.dropped_count : dropped.length;

  return (
    <div className="space-y-4">
      {/* Funnel Pipeline Bar */}
      <div className="rounded-2xl border border-teal-300/20 bg-teal-300/[.04] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-400/20 text-teal-600 dark:text-teal-300">
              <Filter size={15} />
            </span>
            <div>
              <span className="mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-300">
                Five-Gate Verifier Funnel
              </span>
              <h4 className="text-xs font-bold text-foreground">Evidence Verification Pipeline</h4>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mono text-[10px] font-bold text-muted-foreground">
            <span className="text-teal-600 dark:text-teal-300">{shown} Active</span>
            <span>·</span>
            <span className={blockedCount > 0 ? 'text-rose-500 font-bold' : ''}>
              {blockedCount} Blocked
            </span>
          </div>
        </div>

        {/* Funnel Steps */}
        <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-6 text-center">
          <div className="rounded-xl border border-border/80 bg-background/50 p-2">
            <span className="mono text-[9px] text-muted-foreground block">CANDIDATES</span>
            <span className="text-sm font-extrabold text-foreground">{total}</span>
            <span className="block text-[8px] text-muted-foreground mt-0.5">Dual engine</span>
          </div>

          <div className="rounded-xl border border-border/80 bg-background/50 p-2">
            <span className="mono text-[9px] text-muted-foreground block">G1 SCHEMA</span>
            <span className="text-sm font-extrabold text-teal-600 dark:text-teal-300">{p1}</span>
            <span className="block text-[8px] text-muted-foreground mt-0.5">Strict JSON</span>
          </div>

          <div className="rounded-xl border border-border/80 bg-background/50 p-2">
            <span className="mono text-[9px] text-muted-foreground block">G2 SOURCE</span>
            <span className="text-sm font-extrabold text-teal-600 dark:text-teal-300">{p2}</span>
            <span className="block text-[8px] text-muted-foreground mt-0.5">Active fact</span>
          </div>

          <div className="rounded-xl border border-border/80 bg-background/50 p-2">
            <span className="mono text-[9px] text-muted-foreground block">G3 QUOTE</span>
            <span className="text-sm font-extrabold text-teal-600 dark:text-teal-300">{p3}</span>
            <span className="block text-[8px] text-muted-foreground mt-0.5">Verbatim quote</span>
          </div>

          <div className="rounded-xl border border-border/80 bg-background/50 p-2">
            <span className="mono text-[9px] text-muted-foreground block">G4 GUARD</span>
            <span className="text-sm font-extrabold text-teal-600 dark:text-teal-300">{p4}</span>
            <span className="block text-[8px] text-muted-foreground mt-0.5">Metrics safe</span>
          </div>

          <div className="rounded-xl border border-teal-300/30 bg-teal-300/[.08] p-2 ring-1 ring-teal-400/20">
            <span className="mono text-[9px] text-teal-600 dark:text-teal-300 font-bold block">G5 PASS</span>
            <span className="text-sm font-extrabold text-teal-600 dark:text-teal-200">{shown}</span>
            <span className="block text-[8px] text-teal-600/80 dark:text-teal-300/80 mt-0.5">Shown to human</span>
          </div>
        </div>

        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
          {total} candidates evaluated → {shown} verified findings presented. Unsound candidates dropped before reaching human reviewers.
        </p>
      </div>

      {/* Blocked by the Verifier Section */}
      {dropped.length > 0 && (
        <div className="rounded-2xl border border-rose-300/25 bg-rose-400/[.04] p-4">
          <button
            type="button"
            onClick={() => setShowDropped(!showDropped)}
            className="flex w-full items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-rose-400/20 text-rose-500">
                <ShieldAlert size={14} />
              </span>
              <div>
                <span className="mono text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-300">
                  Blocked by the Verifier ({dropped.length})
                </span>
                <span className="block text-xs font-bold text-foreground">
                  Hallucinated or invalid candidates prevented from publication
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <span>{showDropped ? 'Hide blocked' : 'Show blocked'}</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${showDropped ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {showDropped && (
            <div className="mt-3.5 space-y-2.5 border-t border-rose-300/20 pt-3">
              {dropped.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-rose-300/20 bg-background/60 p-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full border border-rose-400/30 bg-rose-400/15 px-2 py-0.5 mono text-[9px] font-bold text-rose-700 dark:text-rose-300 uppercase">
                      Gate {item.failed_gate} Blocked
                    </span>
                    <span className="mono text-[10px] text-muted-foreground">Candidate #{idx + 1}</span>
                  </div>
                  <p className="mt-2 font-mono text-[11px] font-semibold text-foreground bg-rose-400/[.07] p-2 rounded-lg border border-rose-400/10">
                    {item.candidate}
                  </p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    <b className="text-foreground">Why blocked:</b> {item.why || item.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
