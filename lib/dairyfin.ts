// DairyFin domain rules shared by the server and the screens: the product model (configured as
// data in loan_products), application and claim status transitions, indicative eligibility and
// validation of product-specific answers. No product terms are defined here.
import type { AppStatus } from './types/api';

export type Segment = 'farmer' | 'society' | 'consumer';
export type ProductType = 'loan' | 'insurance' | 'prepaid';
export interface FieldDef { id: string; label: string; type: 'text' | 'number' | 'select'; options?: string[]; required?: boolean }
export interface DocDef { id: string; label: string }
export interface EligibilityRule { id: string; label: string; check: string }
export interface FinProduct {
  id: string; name: string; segment: Segment; type: ProductType; category: string; description: string; benefits: string[];
  provider: string; providerId: string; providerKind: 'lender' | 'insurer' | 'platform';
  eligibility: EligibilityRule[]; min: number | null; max: number | null; rate: number | null; tenures: number[]; fees: string | null;
  documents: DocDef[]; fields: FieldDef[]; dataCategories: string[]; status: 'active' | 'paused'; disclaimer: string; termsVerified: boolean;
  coverage: { period?: string; options?: string[] } | null; exclusions: string[]; claimReasons: string[];
}

// One status system for every application (loans and insurance)
export const APP_TRANSITIONS: Record<AppStatus, AppStatus[]> = {
  draft: ['submitted', 'withdrawn'],
  submitted: ['in_review', 'more_info', 'approved', 'declined', 'withdrawn'],
  in_review: ['more_info', 'approved', 'declined', 'withdrawn'],
  more_info: ['in_review', 'withdrawn'],
  approved: ['policy_issued', 'withdrawn'],
  declined: [],
  policy_issued: [],
  withdrawn: [],
};
export const canMove = (from: AppStatus, to: AppStatus) => APP_TRANSITIONS[from]?.includes(to) ?? false;
// Who may make which move: applicants submit, respond and withdraw; providers review and decide
export const APPLICANT_MOVES: AppStatus[] = ['submitted', 'in_review', 'withdrawn'];
export const PROVIDER_MOVES: AppStatus[] = ['in_review', 'more_info', 'approved', 'declined', 'policy_issued'];

export type ClaimStatus = 'draft' | 'submitted' | 'in_review' | 'more_info' | 'approved' | 'declined' | 'settled' | 'withdrawn';
export const CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  draft: ['submitted', 'withdrawn'], submitted: ['in_review', 'more_info', 'approved', 'declined', 'withdrawn'], in_review: ['more_info', 'approved', 'declined'],
  more_info: ['in_review', 'withdrawn'], approved: ['settled'], declined: [], settled: [], withdrawn: [],
};

export interface ApplicantFacts { membershipMonths?: number; regularSupply?: boolean; societyRegistered?: boolean; authorised?: boolean; animalTagged?: boolean }
// Indicative only: shows which known requirements look met. The provider decides.
export function indicativeEligibility(p: FinProduct, f: ApplicantFacts): { id: string; label: string; state: 'met' | 'not_met' | 'unknown' }[] {
  return p.eligibility.map((r) => {
    const m = r.check.match(/^membership_months>=(\d+)$/);
    let state: 'met' | 'not_met' | 'unknown' = 'unknown';
    if (m && f.membershipMonths !== undefined) state = f.membershipMonths >= Number(m[1]) ? 'met' : 'not_met';
    else if (r.check === 'regular_supply' && f.regularSupply !== undefined) state = f.regularSupply ? 'met' : 'not_met';
    else if (r.check === 'society_registered' && f.societyRegistered !== undefined) state = f.societyRegistered ? 'met' : 'not_met';
    else if (r.check === 'authorised' && f.authorised !== undefined) state = f.authorised ? 'met' : 'not_met';
    else if (r.check === 'animal_tagged' && f.animalTagged !== undefined) state = f.animalTagged ? 'met' : 'not_met';
    return { id: r.id, label: r.label, state };
  });
}

// Validates the answers to a product's configured fields; returns error messages (empty = valid)
export function validateApplication(p: FinProduct, a: { amount?: number | null; tenure?: number | null; answers: Record<string, unknown>; docs: string[] }, final: boolean) {
  const errors: string[] = [];
  if (p.status !== 'active') errors.push('This product is not open for applications');
  if (p.type === 'loan' && final) {
    if (!a.amount || (p.min !== null && a.amount < p.min) || (p.max !== null && a.amount > p.max)) errors.push(`Amount must be between ${p.min ?? 0} and ${p.max ?? 'the limit'}`);
    if (p.tenures.length && !p.tenures.includes(Number(a.tenure))) errors.push('Choose one of the offered tenures');
  }
  if (final) {
    for (const f of p.fields) {
      const v = a.answers[f.id];
      if (f.required && (v === undefined || v === null || String(v).trim() === '')) errors.push(`${f.label} is required`);
      else if (v !== undefined && f.type === 'number' && v !== '' && !(Number(v) > 0)) errors.push(`${f.label} must be a positive number`);
      else if (v !== undefined && f.type === 'select' && f.options && !f.options.includes(String(v))) errors.push(`${f.label}: choose one of the options`);
    }
  }
  return errors;
}

export const COOPERATIVE_SAFEGUARDS = [
  'You stay a member of your society. Applying for a financial product never affects your membership.',
  'Milk prices and your payments stay the same and fully visible, whatever you apply for.',
  'The society and the union only share the data you allow. The bank or insurer makes every decision.',
  'Doodh Setu does not guarantee approval.',
];

export const STATUS_TONE: Record<AppStatus, 'primary' | 'good' | 'warn' | 'bad' | 'neutral'> = { draft: 'neutral', submitted: 'primary', in_review: 'primary', more_info: 'warn', approved: 'good', declined: 'bad', policy_issued: 'good', withdrawn: 'neutral' };
export const STATUS_LABEL: Record<AppStatus, string> = { draft: 'Draft', submitted: 'Submitted', in_review: 'In review', more_info: 'More information needed', approved: 'Approved', declined: 'Declined', policy_issued: 'Policy issued', withdrawn: 'Withdrawn' };
export const CLAIM_LABEL: Record<ClaimStatus, string> = { draft: 'Draft', submitted: 'Submitted', in_review: 'Under review', more_info: 'More information needed', approved: 'Approved by insurer', declined: 'Declined by insurer', settled: 'Settled by insurer', withdrawn: 'Withdrawn' };

// Demo plans for the simulated prepaid milk wallet (prices are illustrative, not Amul prices)
export const WALLET_PLANS = [
  { id: 'gold-500', label: 'Full cream milk, 500 ml daily', perDay: 34 },
  { id: 'taaza-1l', label: 'Toned milk, 1 litre daily', perDay: 56 },
  { id: 'buffalo-500', label: 'Buffalo milk, 500 ml daily', perDay: 38 },
];
