// Application models exchanged between the API routes and the UI. Database rows are mapped to
// these in lib/server/repositories; components only ever see these shapes.
import type { Lang } from '../i18n';
import type { Session } from '../farmer';
import type { City, ProductId, Channel } from '../demand';

export type AppStatus = 'draft' | 'submitted' | 'in_review' | 'more_info' | 'approved' | 'declined' | 'policy_issued' | 'withdrawn';
export type ProgramStatus = 'submitted' | 'approved' | 'rejected' | 'concern' | 'published';
export type SendSlot = 'evening' | 'morning' | 'both';
export type SignalStatus = '-' | 'Interested' | 'Heard' | 'Not heard';

export interface QueryMsg { from: 'farmer' | 'society'; text: string; at: string }
export interface MemberQuery { id: string; code: string; lang: Lang; at: string; status: 'open' | 'resolved'; farmerSeen: boolean; farmerName?: string; messages: QueryMsg[] }

export interface Consent {
  id: string; code: string; recipient: string; lenderId: string | null; purpose: string; scope: string; period: string;
  grantedAt: string; status: 'active' | 'withdrawn'; withdrawnAt?: string;
  noticeVersion?: string; categories: string[]; method?: 'digital' | 'assisted'; language?: Lang; statements?: number;
}
export interface SharingLog { id: string; consentCode: string; recipient: string; categories: string[]; purpose: string; status: 'initiated' | 'completed' | 'failed'; at: string }
export type DocId = string; // configured per product (loan_products.required_documents)
export interface Application {
  id: string; ref: string; product: string; lender: string; lenderId: string; amount: number; tenure: number; rate: number; status: AppStatus;
  history: { status: AppStatus; at: string; note: string }[];
  docs: { id: DocId; status: 'received' | 'requested' | 'missing' }[];
  consentCode: string | null;
  sharing: SharingLog[];
}
export interface LoanProduct { id: string; lender: string; lenderId: string; name: string; purpose: string; min: number; max: number; rate: number; maxTenure: number; feePct: number; elig: string }
export interface KycRecord { type: string; masked: string; status: string; provider: string }
export interface PropertyRecord { ownership: string; survey: string; village: string; district: string; state: string; area: number; unit: string; use: string; record: string; status: string }
export interface CreditRecord { bureau: string; score: number; loans: number; outstanding: number; mock: boolean }
export interface Premium { programId: string; rate: number; from: string; to: string }

export interface FarmerProfile {
  id: string; code: string; name: string; phone: string | null; language: Lang; village: string;
  society: { id: string; code: string; name: string }; animals: { buffalo: number; cow: number }; correctionRequested: boolean;
}
export interface FarmerData {
  asOf: string;
  profile: FarmerProfile;
  sessions: Session[];
  premium: Premium | null;
  response: { heard: boolean; interested: boolean };
  queries: MemberQuery[];
  consents: Consent[];
  application: Application | null;
  finance: { kyc: KycRecord[]; property: PropertyRecord | null; credit: CreditRecord | null; products: LoanProduct[] };
}

export interface ProgramView {
  id: string; title: string; rate: number; from: string; to: string; status: ProgramStatus;
  submittedBy: string; approvedBy: string | null; justification: string | null; rejectedReason: string | null;
  concern: string | null; sendSlot: SendSlot | null; notes: Partial<Record<Lang, string>>; societyIds: string[];
  publishedAt: string | null;
}
export interface AuditEvent { at: string; actor: string; action: string }

export interface MemberRow {
  id: string; code: string; name: string; mobile: string | null; device: 'Smartphone' | 'Feature phone (IVR)'; lang: Lang;
  village: string; buffaloes: number; cows: number; litres: number; status: SignalStatus; isDemoFarmer?: boolean;
}
export interface SocietyData {
  asOf: string;
  society: { id: string; code: string; name: string; village: string; members: number };
  collection: { buffalo: number; cow: number } | null;
  monthly: { month: string; buffalo: number }[]; // average buffalo litres per day, by month up to asOf
  program: ProgramView | null;
  members: MemberRow[];
  reach: { heard: number; interested: number; app: number; voice: number };
  preview: { memberName: string; worth: number } | null;
  queries: MemberQuery[];
}

export interface ProductRow { id: ProductId | 'sink'; name: string; unit: string; milkPerUnit: number; valuePerLitre: number; capacity: number | null; buffaloShare: number; isFallback: boolean; isLiquidMilk: boolean }
export interface SocietyLite { id: string; code: string; name: string; members: number; buffaloLitres: number; region: string }
export interface ZoneRow { id: string; name: string; city: City; lat: number; lng: number; aff: number; inland: number; weight: number; qShare: number }
export interface SourceRow { id: string; name: string; kind: string; lag: string; grain: string; quality: number; prevQuality: number; note: string }
export interface PlannerDataset {
  asOf: string;
  union: { id: string; name: string };
  products: ProductRow[];
  dates: string[];
  temps: Record<City, number[]>;
  units: Record<string, Record<Channel, number[]>>; // key `${city}|${product}`
  events: { name: string; kind: 'festival' | 'heatwave'; from: string; to: string; effects: Record<string, number> }[];
  sources: SourceRow[];
  supply: { month: string; buffalo: number; cow: number; marketShare: number }[];
  baseline: Record<string, number>;
  societies: SocietyLite[];
  zones: ZoneRow[];
}
export interface PlannerWorkflow { program: ProgramView | null; audit: AuditEvent[]; acceptedPlans: { month: string; kind: 'recommended' | 'adjusted'; acceptedBy: string }[] }

export interface LenderCaseRow { id: string; ref: string; farmer: string; product: string; productCode: string; amount: number; status: AppStatus; updated: string; background: boolean; applicantType: 'farmer' | 'society'; productType: 'loan' | 'insurance' | 'prepaid' }
export interface LenderData {
  lender: { id: string; name: string; kind: 'lender' | 'insurer' | 'platform' }; cases: LenderCaseRow[]; products: LoanProduct[]; audit: AuditEvent[];
  catalogue: import('../dairyfin').FinProduct[]; policies: PolicyView[]; claims: ClaimView[];
}
export interface SocietyOps { code: string; name: string; village: string; members: number; avgDailyLitres: number; avgFat: number | null }
export interface LenderCase {
  application: Application & Partial<Omit<AppView, keyof Application>>;
  society: SocietyOps | null;
  animal: { type: string; breed: string; tag: string | null; health: string } | null;
  product: import('../dairyfin').FinProduct | null;
  notes: AuditEvent[];
  farmer: { name: string; code: string; society: string } | null;
  consent: Consent | null;
  kyc: KycRecord[] | null; property: PropertyRecord | null; credit: CreditRecord | null;
  income: { key: string; total: number; litres: number }[] | null;
  background: boolean;
}

export interface DemoState { incentive: string; farmerInterested: boolean; application: string; openQueries: number; db: 'postgres' | 'pglite' }

// ---------------------------------------------------------------- DairyFin (multi-product)
export interface AppView extends Application {
  productCode: string; productType: 'loan' | 'insurance' | 'prepaid'; applicantType: 'farmer' | 'society';
  answers: Record<string, unknown>; offer: { amount?: number; rate?: number; tenure?: number; notes?: string } | null; offerStatus: 'pending' | 'accepted' | 'declined' | null;
  insuredAnimal: { id: string; type: string; breed: string } | null; submittedAt: string | null;
}
export interface PolicyView { id: string; number: string; insurer: string; animal: { type: string; breed: string } | null; sumInsured: number | null; premium: number | null; start: string; end: string; status: string; renewal: string; simulated: boolean; productCode: string | null }
export interface ClaimView { id: string; ref: string; policyNumber: string; reason: string; incidentDate: string; description: string; status: string; amountClaimed: number | null; history: { status: string; note: string; at: string }[]; farmer?: string }
export interface FinanceFacts { membershipMonths?: number; regularSupply?: boolean; societyRegistered?: boolean; authorised?: boolean }

export interface CattleRow { id: string; type: string; breed: string; tag: string | null; health: string; insured: boolean }
export interface FarmerFinanceData {
  products: import('../dairyfin').FinProduct[]; applications: AppView[]; consents: Consent[]; policies: PolicyView[]; claims: ClaimView[];
  facts: FinanceFacts; cattle: CattleRow[]; safeguards: string[];
}
export interface SocietyFinanceData {
  products: import('../dairyfin').FinProduct[]; applications: AppView[]; consents: Consent[]; operations: SocietyOps | null;
  facts: FinanceFacts; signatory: { name: string; authorised: boolean }; safeguards: string[];
}
export interface WalletData {
  consumer: { id: string; name: string; city: string };
  product: import('../dairyfin').FinProduct | null;
  subscription: { id: string; product: string; channel: string; plan: string; pricePerDay: number; status: string; renewsOn: string | null } | null;
  transactions: { kind: 'topup' | 'purchase'; amount: number; description: string; at: string; simulated: boolean }[];
  balance: number;
}
