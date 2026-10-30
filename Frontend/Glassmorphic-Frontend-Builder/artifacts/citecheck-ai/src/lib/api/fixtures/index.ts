import type { AuditItem, BrandKit, Draft, Finding, User, Version } from '../types';

// Synthetic preview-only data. This module is consulted only when VITE_USE_FIXTURES=true.
export const demoUsers: User[] = [
  { id: 'u-1', name: 'Meera Nair', role: 'creator' },
  { id: 'u-2', name: 'Arjun Mehta', role: 'brand_manager' },
  { id: 'u-3', name: 'Nisha Rao', role: 'reviewer' },
];

export const brandKit: BrandKit = {
  guidelines: [
    { id: 'GUIDE-01', title: 'Claims need proof', text: 'Never use superlatives unless supported by an approved, current fact.', category: 'claim' },
    { id: 'GUIDE-02', title: 'Plainspoken confidence', text: 'Use clear, useful language. Avoid guarantees and absolute promises.', category: 'tone' },
    { id: 'GUIDE-03', title: 'Payments terminology', text: 'Say “UPI payment”, not “UPI transaction”.', category: 'terminology' },
    { id: 'GUIDE-04', title: 'Security language', text: 'Do not use “military-grade”. Describe specific controls instead.', category: 'tone' },
    { id: 'GUIDE-05', title: 'Numbers and dates', text: 'Promotional values and eligibility always need a current source.', category: 'formatting' },
    { id: 'GUIDE-06', title: 'Human review', text: 'A reviewer must decide any change to a number, date, or named entity.', category: 'tone' },
    { id: 'GUIDE-07', title: 'Respectful tone', text: 'Avoid fear-based language and pressure tactics.', category: 'tone' },
    { id: 'GUIDE-08', title: 'Product naming', text: 'Use Lumen Pay on first mention; Lumen thereafter.', category: 'terminology' },
    { id: 'GUIDE-09', title: 'No lifetime promises', text: 'Do not promise a price or feature will never change.', category: 'claim' },
    { id: 'GUIDE-10', title: 'Accessibility', text: 'Use short sentences and explain specialist terms.', category: 'accessibility' },
  ],
  facts: [
    { id: 'FACT-01', text: 'Lumen Pay is a digital wallet built for simple, secure everyday UPI payments.', source: 'Product Overview v2', review_date: '2027-04-15', allow_ai: true },
    { id: 'FACT-02', text: 'Users can link bank accounts via UPI to pay merchant QR codes and contacts.', source: 'Payments Specification 2026', review_date: '2027-05-01', allow_ai: true },
    { id: 'FACT-03', text: 'Pricing: fees are reviewed quarterly; no lifetime zero-fee promises.', source: 'Lumen Pay pricing policy Q3', review_date: '2026-08-15', allow_ai: true },
    { id: 'FACT-04', text: 'Every payment generates an instant in-app digital receipt with UTR.', source: 'Core Payments Engine Doc', review_date: '2027-03-10', allow_ai: true },
    { id: 'FACT-05', text: 'Customer support is accessible 24/7 directly within the Lumen Pay mobile application.', source: 'In-App Support SLA', review_date: '2027-06-01', allow_ai: true },
    { id: 'FACT-06', text: 'Payment history and itemized monthly summaries are available in the app.', source: 'Account Features Spec', review_date: '2027-02-28', allow_ai: true },
    { id: 'FACT-07', text: 'Approved claims: no superlatives without proof.', source: 'Brand governance policy 2026', review_date: '2027-09-01', allow_ai: true },
    { id: 'FACT-08', text: 'Account setup requires mobile number verification and standard device binding.', source: 'Security & Onboarding Guide', review_date: '2027-01-15', allow_ai: true },
    { id: 'FACT-09', text: 'Data in transit is protected using TLS 1.3 encryption across all public APIs.', source: 'Security Whitepaper 2026', review_date: '2027-08-01', allow_ai: true },
    { id: 'FACT-10', text: 'Users can configure biometrics (fingerprint / Face Unlock) to authorize payments.', source: 'Authentication Architecture', review_date: '2027-04-01', allow_ai: true },
    { id: 'FACT-11', text: 'Cashback up to 15% on eligible payments during the launch offer.', source: 'Launch offer terms (synthetic)', review_date: '2026-06-30', allow_ai: true },
    { id: 'FACT-12', text: 'Lumen Pay supports UPI payments for everyday purchases.', source: 'Product capability sheet', review_date: '2027-03-01', allow_ai: true },
    { id: 'FACT-13', text: 'Daily transaction limits follow NPCI guidelines and user-configured banking limits.', source: 'Compliance & Regulatory Manual', review_date: '2027-07-01', allow_ai: true },
    { id: 'FACT-14', text: 'The app interface is available in English, with Hindi localization launching in Q1.', source: 'Localization Roadmap', review_date: '2026-11-15', allow_ai: false },
    { id: 'FACT-15', text: 'Users can view their payment history in the app.', source: 'Product capability sheet', review_date: '2026-11-20', allow_ai: true },
  ],
  terms: [
    { id: 'TERM-01', banned: 'UPI transaction', preferred: 'UPI payment' },
    { id: 'TERM-02', banned: 'military-grade', preferred: 'specific security control' },
    { id: 'TERM-03', banned: 'guaranteed', preferred: 'descriptive, sourced language' },
    { id: 'TERM-04', banned: 'forever', preferred: 'a current, reviewed timeframe' },
    { id: 'TERM-05', banned: 'best in class', preferred: 'a specific supported product detail' },
    { id: 'TERM-06', banned: 'risk-free', preferred: 'explain the relevant safeguards' },
    { id: 'TERM-07', banned: 'instant', preferred: 'describe the actual processing experience' },
    { id: 'TERM-08', banned: 'unlimited', preferred: 'state the supported limits' },
    { id: 'TERM-09', banned: '100% secure', preferred: 'describe a specific security control' },
    { id: 'TERM-10', banned: 'revolutionary', preferred: 'describe the product benefit plainly' },
    { id: 'TERM-11', banned: 'hassle-free', preferred: 'explain the steps involved' },
    { id: 'TERM-12', banned: 'guaranteed savings', preferred: 'describe a current, sourced offer' },
    { id: 'TERM-13', banned: 'zero cost', preferred: 'state current reviewed fees' },
    { id: 'TERM-14', banned: 'wallet app', preferred: 'digital wallet' },
    { id: 'TERM-15', banned: 'transaction', preferred: 'payment, when referring to a UPI payment' },
    { id: 'TERM-16', banned: 'unhackable', preferred: 'describe a specific security control' },
    { id: 'TERM-17', banned: 'no risk', preferred: 'explain relevant conditions and protections' },
    { id: 'TERM-18', banned: 'instant cashback', preferred: 'cashback, subject to current offer terms' },
    { id: 'TERM-19', banned: 'forever free', preferred: 'state current reviewed fees' },
    { id: 'TERM-20', banned: 'most trusted', preferred: 'a specific claim supported by evidence' },
  ],
};

export const sampleText = 'Lumen Pay is India’s most trusted wallet and charges zero fees forever.';

export const findings: Finding[] = [
  { id: 'F-101', draft_id: 'draft-1', excerpt: 'most trusted wallet', start: 18, end: 37, type: 'Claim', severity: 'high', source: 'ai', source_ref_id: 'FACT-07', reason: 'A superlative needs current evidence. No approved fact supports “most trusted”.', suggested_fix: 'a wallet built for simple, everyday payments', fix_needs_human: false, confidence: .94, status: 'open' },
  { id: 'F-102', draft_id: 'draft-1', excerpt: 'zero fees forever', start: 50, end: 68, type: 'Claim', severity: 'high', source: 'ai', source_ref_id: 'FACT-03', reason: 'Pricing is reviewed quarterly. An absolute lifetime promise is not supported. Note: cited FACT-03 review date expired.', suggested_fix: 'fees reviewed quarterly', fix_needs_human: true, confidence: .91, status: 'open' },
  { id: 'F-103', draft_id: 'draft-3', excerpt: 'military-grade', start: 24, end: 38, type: 'Banned phrase', severity: 'medium', source: 'rules', source_ref_id: 'GUIDE-04', reason: 'This phrase is not approved. Describe a specific, verifiable control.', suggested_fix: 'security designed around clear, specific safeguards', fix_needs_human: false, confidence: 1, status: 'open' },
  { id: 'F-104', draft_id: 'draft-3', excerpt: 'UPI transaction', start: 61, end: 76, type: 'Terminology', severity: 'low', source: 'rules', source_ref_id: 'TERM-01', reason: 'Use the preferred product terminology.', suggested_fix: 'UPI payment', fix_needs_human: false, confidence: 1, status: 'open' },
  { id: 'F-105', draft_id: 'draft-2', excerpt: 'cashback up to 15%', start: 36, end: 54, type: 'Claim', severity: 'high', source: 'ai', source_ref_id: 'FACT-11', reason: 'The cited fact FACT-11 (Launch cashback) expired on 2026-06-30. Overdue promotional rate requires human confirmation.', suggested_fix: 'cashback up to 10% (confirm current promotional campaign approval)', fix_needs_human: true, confidence: .72, status: 'open' },
];

export const drafts: Draft[] = [
  { id: 'draft-1', title: 'app-store-listing.md', text: sampleText, version: 2, status: 'Changes requested', updated_at: '2026-10-30T14:20:00Z', findings_count: 2 },
  { id: 'draft-2', title: 'launch-email.md', text: 'Join Lumen Pay today. Get promotional cashback up to 15% on qualifying payments this month only.', version: 3, status: 'In review', updated_at: '2026-10-29T16:05:00Z', findings_count: 1 },
  { id: 'draft-3', title: 'blog-security.md', text: 'Our military-grade security protects each UPI transaction.', version: 1, status: 'Draft', updated_at: '2026-10-28T09:40:00Z', findings_count: 2 },
];

export const versions: Version[] = [
  { id: 'v-1', version: 1, text: 'Lumen Pay is a wallet for everyday payments.', created_at: '2026-10-28T10:00:00Z' },
  { id: 'v-2', version: 2, text: sampleText, created_at: '2026-10-30T14:20:00Z' },
  { id: 'v-2-1', version: 1, text: 'Join Lumen Pay today and experience instant UPI payments across India.', created_at: '2026-10-27T10:00:00Z' },
  { id: 'v-2-2', version: 2, text: 'Join Lumen Pay today and get guaranteed unlimited cashback on every payment this year.', created_at: '2026-10-28T14:00:00Z' },
  { id: 'v-2-3', version: 3, text: 'Join Lumen Pay today. Get promotional cashback up to 15% on qualifying payments this month only.', created_at: '2026-10-29T16:05:00Z' },
];

export const audit: AuditItem[] = [
  { id: 'a-1', who: 'Meera Nair', role: 'creator', action: 'Accepted suggested fix', target: 'app-store-listing.md · F-101', timestamp: '2026-10-30T15:10:00Z', reason: 'Replaced unapproved superlative "most trusted wallet"', details: 'Changed to "a wallet built for simple, everyday payments"' },
  { id: 'a-2', who: 'Meera Nair', role: 'creator', action: 'Dismissed finding with reason', target: 'launch-email.md · F-105', timestamp: '2026-10-30T14:45:00Z', reason: 'Pre-approved campaign exception by Legal Counsel', details: 'Rule GUIDE-01 dismissed: Q4 launch promotional budget approved in board minutes' },
  { id: 'a-3', who: 'Nisha Rao', role: 'reviewer', action: 'Requested changes', target: 'app-store-listing.md · v2', timestamp: '2026-10-29T16:48:00Z', reason: 'Pricing claim needs updated review date', details: 'Comment: Please adjust the lifetime zero-fee claim before release' },
  { id: 'a-4', who: 'Arjun Mehta', role: 'brand_manager', action: 'Flagged expired fact', target: 'Brand Kit · FACT-11', timestamp: '2026-10-29T11:20:00Z', reason: 'Promotional campaign review date expired on 2026-06-30', details: 'Fact status changed to Needs Review' },
  { id: 'a-5', who: 'Nisha Rao', role: 'reviewer', action: 'Approved & locked draft', target: 'security-faq.md · v1', timestamp: '2026-10-28T10:15:00Z', reason: 'All 4 findings resolved and verified against Brand Kit', details: 'Final sign-off recorded for production release' },
];

export const dropped = [
  { candidate: '“The safest wallet in India” (cited FACT-42)', failed_gate: 2 as const, why: 'FACT-42 does not exist in this brand kit.' },
  { candidate: '“Zero transaction charges” (cited FACT-03)', failed_gate: 4 as const, why: 'Gate 4 guardrails: altered numeric fee schedule without reviewer approval.' },
  { candidate: '“Over 10M happy users” (cited FACT-99)', failed_gate: 3 as const, why: 'Exact excerpt not present in submitted draft.' },
];
