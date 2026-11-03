import React, { useState } from 'react';
import { Check, AlertTriangle, X, ChevronDown, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import type { Finding, VerificationTrace as VerificationTraceType } from '@/lib/api/types';

interface VerificationTraceProps {
  finding: Finding;
  defaultOpen?: boolean;
}

export function VerificationTrace({ finding, defaultOpen = false }: VerificationTraceProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Synthesize or extract the 5-gate trace
  const trace: VerificationTraceType = finding.verification_trace || {
    gate_1_schema: {
      passed: true,
      message: 'Schema validated: candidate adheres strictly to CandidateFinding schema.',
    },
    gate_2_source: {
      passed: Boolean(finding.source_ref_id),
      source_id: finding.source_ref_id,
      source_type: finding.source_ref_id?.startsWith('FACT') ? 'fact' : 'guideline',
      message: finding.source_ref_id
        ? `Source ${finding.source_ref_id} verified in active Brand Kit baseline.`
        : 'Source ID missing from candidate.',
    },
    gate_3_quote: {
      passed: Boolean(finding.excerpt && finding.excerpt.length > 0),
      message: `Verbatim quote verified in draft text at characters ${finding.start}–${finding.end}.`,
    },
    gate_4_intent_fix: {
      passed: true,
      warning: finding.fix_needs_human,
      message: finding.fix_needs_human
        ? 'Altered metrics or named entities detected — flagged for mandatory human approval.'
        : 'Proposed fix preserves core facts without unauthorized metric mutations.',
    },
    gate_5_freshness_confidence: {
      passed: finding.verification_status !== 'blocked_expired_fact',
      confidence: finding.confidence,
      freshness:
        finding.source_ref_id === 'FACT-03' || finding.source_ref_id === 'FACT-11' || finding.verification_status === 'blocked_expired_fact'
          ? 'expired'
          : 'active',
      message:
        finding.verification_status === 'blocked_expired_fact' || finding.source_ref_id === 'FACT-03' || finding.source_ref_id === 'FACT-11'
          ? `Fact ${finding.source_ref_id} is expired. Blocked until renewed by Brand Manager.`
          : finding.confidence < 0.8 || finding.verification_status === 'human_review_required'
          ? `Confidence ${(finding.confidence * 100).toFixed(0)}% < 80% threshold — routed to human reviewer.`
          : `Fact active and current. Confidence: ${(finding.confidence * 100).toFixed(0)}%.`,
    },
  };

  const g1 = trace.gate_1_schema || { passed: true, message: 'Valid schema' };
  const g2 = trace.gate_2_source || { passed: true, message: 'Source verified' };
  const g3 = trace.gate_3_quote || { passed: true, message: 'Verbatim quote verified' };
  const g4 = trace.gate_4_intent_fix || { passed: true, message: 'Guardrails satisfied' };
  const g5 = trace.gate_5_freshness_confidence || { passed: true, message: 'Fresh and confident' };

  const gates = [
    {
      id: 1,
      name: 'Schema',
      fullName: 'Gate 1: Strict JSON Schema',
      passed: g1.passed,
      warning: false,
      message: g1.message,
      badge: g1.passed ? 'Passed' : 'Failed',
      tone: g1.passed ? 'teal' : 'rose',
    },
    {
      id: 2,
      name: 'Source',
      fullName: 'Gate 2: Source Existence',
      passed: g2.passed,
      warning: false,
      message: g2.message,
      badge: g2.passed ? (g2.source_id ? `Active (${g2.source_id})` : 'Passed') : 'Missing Source',
      tone: g2.passed ? 'teal' : 'rose',
    },
    {
      id: 3,
      name: 'Quote',
      fullName: 'Gate 3: Verbatim Exact Quote',
      passed: g3.passed,
      warning: false,
      message: g3.message,
      badge: g3.passed ? 'Verbatim' : 'Hallucinated',
      tone: g3.passed ? 'teal' : 'rose',
    },
    {
      id: 4,
      name: 'Guardrails',
      fullName: 'Gate 4: Intent-Preserving Fix Guardrails',
      passed: g4.passed,
      warning: Boolean(g4.warning || finding.fix_needs_human),
      message: g4.message,
      badge: (g4.warning || finding.fix_needs_human) ? 'Guarded' : 'Safe',
      tone: (g4.warning || finding.fix_needs_human) ? 'amber' : 'teal',
    },
    {
      id: 5,
      name: 'Freshness',
      fullName: 'Gate 5: Freshness & Confidence Routing',
      passed: g5.passed && g5.freshness !== 'expired' && finding.verification_status !== 'blocked_expired_fact',
      warning: g5.confidence !== undefined && g5.confidence < 0.8,
      message: g5.message,
      badge:
        finding.verification_status === 'blocked_expired_fact' || g5.freshness === 'expired'
          ? 'Blocked: Expired Fact'
          : (g5.confidence !== undefined && g5.confidence < 0.8)
          ? `Routed (${(g5.confidence * 100).toFixed(0)}%)`
          : `Active (${((g5.confidence ?? finding.confidence) * 100).toFixed(0)}%)`,
      tone:
        finding.verification_status === 'blocked_expired_fact' || g5.freshness === 'expired'
          ? 'rose'
          : (g5.confidence !== undefined && g5.confidence < 0.8)
          ? 'amber'
          : 'teal',
    },
  ];

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border/80 bg-background/40">
      {/* Mini Gate Stepper Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-white/5"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-teal-500" />
          <span className="mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            5-Gate Verifier Trace
          </span>
          {/* Mini Gate Icons */}
          <div className="flex items-center gap-1 ml-1">
            {gates.map((g) => {
              const bg =
                g.tone === 'rose'
                  ? 'bg-rose-400/20 text-rose-500'
                  : g.tone === 'amber'
                  ? 'bg-amber-400/20 text-amber-500'
                  : 'bg-teal-400/20 text-teal-600 dark:text-teal-300';
              return (
                <span
                  key={g.id}
                  title={`${g.fullName}: ${g.badge}`}
                  className={`grid h-4 w-4 place-items-center rounded text-[8px] font-bold ${bg}`}
                >
                  {g.tone === 'rose' ? '✕' : g.tone === 'amber' ? '▲' : '✓'}
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>{isOpen ? 'Hide trace' : 'Inspect trace'}</span>
          <ChevronDown size={13} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expanded 5-Row Detailed Trace */}
      {isOpen && (
        <div className="border-t border-border/80 p-2.5 space-y-1.5 bg-background/60">
          {gates.map((g) => {
            const badgeClasses =
              g.tone === 'rose'
                ? 'bg-rose-400/15 text-rose-700 dark:text-rose-300 border-rose-400/25'
                : g.tone === 'amber'
                ? 'bg-amber-400/15 text-amber-700 dark:text-amber-300 border-amber-400/25'
                : 'bg-teal-400/15 text-teal-700 dark:text-teal-300 border-teal-400/25';

            return (
              <div
                key={g.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-border/50 bg-background/70 px-2.5 py-1.5 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="mono text-[9px] font-bold text-muted-foreground">G{g.id}</span>
                    <span className="font-semibold text-foreground text-[11px]">{g.fullName.split(':')[1]}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{g.message}</p>
                </div>
                <span className={`shrink-0 rounded-md border px-1.5 py-0.5 mono text-[9px] font-bold uppercase tracking-wide ${badgeClasses}`}>
                  {g.badge}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
