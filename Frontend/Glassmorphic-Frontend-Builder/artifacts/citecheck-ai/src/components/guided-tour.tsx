import React, { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  UserCheck,
  ShieldCheck,
  FileText,
  Upload,
  Radar,
  LockKeyhole,
  CheckCircle2,
} from 'lucide-react';
import { useSession } from '@/store/session';
import { Glass, Eyebrow, Tag, Button, roleName } from '@/components/ui-atoms';
import { toast } from 'sonner';

export interface TourStep {
  step: number;
  role: 'creator' | 'reviewer' | 'brand_manager';
  title: string;
  subtitle: string;
  description: string;
  targetPath: string;
  actionText: string;
  badge: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    step: 1,
    role: 'creator',
    title: 'Document Ingestion: DOCX & Markdown',
    subtitle: 'Extract Hierarchy & Structured Tables',
    description:
      'Upload a real Microsoft Word document (.docx) or Markdown draft. The server-safe parser preserves headings, bullet lists, and tables without flattening.',
    targetPath: '/drafts/new',
    actionText: 'Open New Draft & Upload DOCX',
    badge: 'Ingestion Engine',
  },
  {
    step: 2,
    role: 'creator',
    title: 'Five-Gate Engine: Live Review',
    subtitle: 'Rules + LLM Verification Pipeline',
    description:
      'Run verification on a draft. Both deterministic rules and the honest LLM reviewer propose candidate findings, which are processed through Gates 1 to 5.',
    targetPath: '/drafts/draft-1',
    actionText: 'Review Draft & Run Pipeline',
    badge: '5-Gate Engine',
  },
  {
    step: 3,
    role: 'creator',
    title: 'Per-Finding 5-Gate Trace Inspection',
    subtitle: 'Schema · Source · Quote · Guardrails · Freshness',
    description:
      'Expand any finding card to view its cryptographic gate trace. Every pass, warning, or blocker is computed from real code paths—never hard-coded.',
    targetPath: '/verifier-lab',
    actionText: 'Explore Verifier Laboratory',
    badge: 'Traceability',
  },
  {
    step: 4,
    role: 'creator',
    title: 'Human Review Checkpoint: Dismissal Loop',
    subtitle: 'AI Suggests, Humans Decide',
    description:
      'Accept a fix or dismiss with a reason. Dismissals are recorded in the store and feed into the Guideline Gap Radar to detect ambiguous company policies.',
    targetPath: '/gap-radar',
    actionText: 'Open Guideline Gap Radar',
    badge: 'Living Feedback',
  },
  {
    step: 5,
    role: 'brand_manager',
    title: 'Brand Kit: Facts & Governance Expiry',
    subtitle: 'Ground Truth with Expiry Dates',
    description:
      'Brand managers maintain approved facts with real review dates. Inspect expired facts (e.g. FACT-03 Pricing review) and expiring facts. Gate 5 uses these to block publication of stale evidence.',
    targetPath: '/brand-kit',
    actionText: 'Inspect Brand Kit Facts',
    badge: 'Brand Governance',
  },
  {
    step: 6,
    role: 'reviewer',
    title: 'Reviewer Sign-Off & Release Lock',
    subtitle: 'Gate 5 Blocker & Version Locking',
    description:
      'Switch to Nisha Rao (Reviewer). Reviewers cannot approve drafts citing expired facts until renewed by a brand manager. Once approved, the version is permanently locked.',
    targetPath: '/review',
    actionText: 'Go to Review Queue',
    badge: 'Human Sign-off',
  },
  {
    step: 7,
    role: 'brand_manager',
    title: 'Tamper-Evident Audit Verification',
    subtitle: 'SHA-256 Cryptographic Hash Chain',
    description:
      'Verify that all workflow actions—creation, editing, approval, and fact renewal—form an unbroken SHA-256 tamper-evident hash chain from genesis to latest.',
    targetPath: '/audit',
    actionText: 'Verify Log Integrity',
    badge: 'Security Guarantee',
  },
];

export function GuidedTour() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('citecheck_dismiss_tour') !== 'true';
    } catch {
      return true;
    }
  });

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const user = useSession((s) => s.user);
  const demoRole = useSession((s) => s.demoRole);
  const [, setPath] = useLocation();

  if (!open) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];

  const handleDismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem('citecheck_dismiss_tour', 'true');
    } catch {}
  };

  const handleAction = async () => {
    // Automatically switch to the recommended persona for this step if needed
    if (user?.role !== currentStep.role) {
      await demoRole(currentStep.role);
      toast.success(`Switched role to ${roleName(currentStep.role)} for Step ${currentStep.step}`);
    }
    setPath(currentStep.targetPath);
  };

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleDismiss();
      toast.success('Guided tour completed! You can restart it anytime from your profile menu.');
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  return (
    <Glass className="mb-5 border-teal-300/35 bg-teal-300/[.07] p-5 relative overflow-hidden shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-300/20 text-teal-600 dark:text-teal-200">
            <Sparkles size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-200">
                  Judges' 7-Step Interactive Verification Tour
                </span>
                <Tag tone="teal">{currentStep.badge}</Tag>
                <span className="mono text-[10px] text-muted-foreground">
                  Step {currentStep.step} of {TOUR_STEPS.length}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Active: <b className="text-foreground">{user?.name || 'User'} ({roleName(user?.role)})</b>
              </div>
            </div>

            <div className="mt-2.5">
              <h3 className="display text-base font-bold text-foreground sm:text-lg flex items-center gap-2">
                {currentStep.title}
                <span className="text-xs font-normal text-muted-foreground">· {currentStep.subtitle}</span>
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground max-w-3xl">
                {currentStep.description}
              </p>
            </div>

            {/* Stepper Dots & Action Buttons */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-teal-300/20 pt-3">
              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((s, idx) => (
                  <button
                    key={s.step}
                    onClick={() => setCurrentStepIndex(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === currentStepIndex
                        ? 'w-6 bg-teal-400'
                        : idx < currentStepIndex
                        ? 'w-2 bg-teal-400/50'
                        : 'w-2 bg-border/80'
                    }`}
                    title={`Step ${s.step}: ${s.title}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {currentStepIndex > 0 && (
                  <Button variant="outline" onClick={handlePrev} className="px-3 py-1.5 text-xs">
                    <ChevronLeft size={14} /> Back
                  </Button>
                )}
                <Button onClick={handleAction} className="px-3.5 py-1.5 text-xs font-bold">
                  {currentStep.actionText} <ChevronRight size={14} />
                </Button>
                <Button
                  variant="outline"
                  onClick={handleNext}
                  className="px-3 py-1.5 text-xs"
                >
                  {currentStepIndex === TOUR_STEPS.length - 1 ? 'Finish Tour' : 'Next Step'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          aria-label="Dismiss guided tour"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 shrink-0 cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
    </Glass>
  );
}

