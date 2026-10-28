import type { AuditItem, BrandKit, Draft, Finding, User, Version } from '../types';

// Synthetic preview-only data. This module is consulted only when VITE_USE_FIXTURES=true.
export const demoUsers: User[] = [
  { id: 'u-1', name: 'Meera Nair', role: 'creator' },
  { id: 'u-2', name: 'Arjun Mehta', role: 'brand_manager' },
  { id: 'u-3', name: 'Nisha Rao', role: 'reviewer' },
];
export const brandKit: BrandKit = {
  guidelines: [
    { id: 'GUIDE-01', title: 'Claims need proof', text: 'Never use superlatives unless supported by an approved, current fact.' },
    { id: 'GUIDE-02', title: 'Plainspoken confidence', text: 'Use clear, useful language. Avoid guarantees and absolute promises.' },
    { id: 'GUIDE-03', title: 'Payments terminology', text: 'Say “UPI payment”, not “UPI transaction”.' },
    { id: 'GUIDE-04', title: 'Security language', text: 'Do not use “military-grade”. Describe specific controls instead.' },
    { id: 'GUIDE-05', title: 'Numbers and dates', text: 'Promotional values and eligibility always need a current source.' },
    { id: 'GUIDE-06', title: 'Human review', text: 'A reviewer must decide any change to a number, date, or named entity.' },
    { id: 'GUIDE-07', title: 'Respectful tone', text: 'Avoid fear-based language and pressure tactics.' },
    { id: 'GUIDE-08', title: 'Product naming', text: 'Use Lumen Pay on first mention; Lumen thereafter.' },
    { id: 'GUIDE-09', title: 'No lifetime promises', text: 'Do not promise a price or feature will never change.' },
    { id: 'GUIDE-10', title: 'Accessibility', text: 'Use short sentences and explain specialist terms.' },
  ],
  facts: [
    { id: 'FACT-03', text: 'Pricing: fees are reviewed quarterly; no lifetime promises.', source: 'Lumen Pay pricing policy', review_date: '2026-06-30', allow_ai: true },
    { id: 'FACT-07', text: 'Approved claims: no superlatives without proof.', source: 'Brand governance policy', review_date: '2026-08-15', allow_ai: true },
    { id: 'FACT-11', text: 'Cashback up to 15% on eligible payments during the launch offer.', source: 'Launch offer terms (synthetic)', review_date: '2025-02-01', allow_ai: true },
    { id: 'FACT-12', text: 'Lumen Pay supports UPI payments for everyday purchases.', source: 'Product capability sheet', review_date: '2026-12-01', allow_ai: true },
    { id: 'FACT-14', text: 'Customer support is available in the app.', source: 'Support policy', review_date: '2026-10-01', allow_ai: false },
    { id: 'FACT-15', text: 'Users can view their payment history in the app.', source: 'Product capability sheet', review_date: '2026-11-01', allow_ai: true },
    { id: 'FACT-16', text: 'Payment confirmation is shown after a successful payment.', source: 'Product capability sheet', review_date: '2026-11-01', allow_ai: true },
    { id: 'FACT-18', text: 'The app supports English-language interface copy.', source: 'Localization inventory', review_date: '2026-09-01', allow_ai: false },
    { id: 'FACT-19', text: 'Offer eligibility and dates are listed in the offer terms.', source: 'Launch offer terms (synthetic)', review_date: '2026-07-15', allow_ai: true },
    { id: 'FACT-20', text: 'Lumen Pay is a digital wallet product.', source: 'Product overview', review_date: '2026-10-01', allow_ai: true },
    { id: 'FACT-21', text: 'Users can contact support through the in-app help section.', source: 'Support policy', review_date: '2026-10-01', allow_ai: true },
    { id: 'FACT-22', text: 'Payment availability depends on participating payment networks.', source: 'Payments policy', review_date: '2026-08-01', allow_ai: true },
    { id: 'FACT-23', text: 'Account features may require verification.', source: 'Account policy', review_date: '2026-08-01', allow_ai: true },
    { id: 'FACT-24', text: 'The app provides an in-app payment receipt.', source: 'Product capability sheet', review_date: '2026-11-01', allow_ai: true },
    { id: 'FACT-25', text: 'Promotional offers are subject to the published terms.', source: 'Promotions policy', review_date: '2026-07-15', allow_ai: true },
    { id: 'FACT-26', text: 'Feature availability can change as the product is updated.', source: 'Product governance policy', review_date: '2026-12-01', allow_ai: false },
    { id: 'FACT-27', text: 'Users can review current offer details inside the app.', source: 'Product capability sheet', review_date: '2026-11-01', allow_ai: true },
    { id: 'FACT-28', text: 'Lumen Pay uses the term “UPI payment” in customer-facing copy.', source: 'Terminology guide', review_date: '2026-09-01', allow_ai: true },
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
  { id: 'F-102', draft_id: 'draft-1', excerpt: 'zero fees forever', start: 50, end: 68, type: 'Claim', severity: 'high', source: 'ai', source_ref_id: 'FACT-03', reason: 'Pricing is reviewed quarterly. An absolute lifetime promise is not supported.', suggested_fix: 'fees reviewed quarterly', fix_needs_human: true, confidence: .91, status: 'open' },
  { id: 'F-103', draft_id: 'draft-3', excerpt: 'military-grade', start: 24, end: 38, type: 'Banned phrase', severity: 'medium', source: 'rules', source_ref_id: 'GUIDE-04', reason: 'This phrase is not approved. Describe a specific, verifiable control.', suggested_fix: 'security designed around clear, specific safeguards', fix_needs_human: false, confidence: 1, status: 'open' },
  { id: 'F-104', draft_id: 'draft-3', excerpt: 'UPI transaction', start: 61, end: 76, type: 'Terminology', severity: 'low', source: 'rules', source_ref_id: 'TERM-01', reason: 'Use the preferred product terminology.', suggested_fix: 'UPI payment', fix_needs_human: false, confidence: 1, status: 'open' },
  { id: 'F-105', draft_id: 'draft-2', excerpt: 'up to 15%', start: 10, end: 18, type: 'Claim', severity: 'medium', source: 'ai', source_ref_id: 'FACT-11', reason: 'The referenced offer fact has an overdue review date. Verify the promotion before publication.', suggested_fix: 'up to 15% (confirm offer eligibility and dates)', fix_needs_human: true, confidence: .72, status: 'open' },
];
export const drafts: Draft[] = [
  { id: 'draft-1', title: 'app-store-listing.md', text: sampleText, version: 2, status: 'Changes requested', updated_at: '2026-03-14T11:20:00Z', findings_count: 2 },
  { id: 'draft-2', title: 'launch-email.md', text: 'Get cashback up to 15% on every payment this month.', version: 3, status: 'In review', updated_at: '2026-03-13T16:05:00Z', findings_count: 1 },
  { id: 'draft-3', title: 'blog-security.md', text: 'Our military-grade security protects each UPI transaction.', version: 1, status: 'Draft', updated_at: '2026-03-12T09:40:00Z', findings_count: 2 },
];
export const versions: Version[] = [
  { id: 'v-1', version: 1, text: 'Lumen Pay is a wallet for everyday payments.', created_at: '2026-03-12T10:00:00Z' },
  { id: 'v-2', version: 2, text: sampleText, created_at: '2026-03-14T11:20:00Z' },
];
export const audit: AuditItem[] = [
  { id: 'a-1', who: 'Meera Nair', role: 'creator', action: 'Submitted draft for review', target: 'launch-email.md · v3', timestamp: '2026-03-13T16:05:00Z' },
  { id: 'a-2', who: 'Nisha Rao', role: 'reviewer', action: 'Requested changes', target: 'app-store-listing.md · v2', timestamp: '2026-03-13T13:48:00Z' },
  { id: 'a-3', who: 'Arjun Mehta', role: 'brand_manager', action: 'Updated approved fact', target: 'FACT-11', timestamp: '2026-03-12T08:10:00Z' },
];
export const dropped = [{ candidate: '“The safest wallet in India” (cited FACT-42)', failed_gate: 2 as const, why: 'FACT-42 does not exist in this brand kit.' }];
