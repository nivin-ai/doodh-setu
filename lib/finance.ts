// DairyFin loan data sharing (FRD finance journey; DPDP Act 2023 consent).
// Demo records follow the Farmers Database Structure (tables farmer_kyc, farmer_properties,
// credit_profiles, consent_records, data_sharing_logs). Values are simulated and masked:
// raw Aadhaar or PAN numbers are never held in the app, only tokens and masked display values.
import type { Lang } from './i18n';

export const NOTICE_VERSION = 'DPDP-LOAN-1.0';

// farmer_kyc (document_number_masked only; the token lives with the verification provider)
export const KYC = [
  { type: 'Aadhaar', masked: 'XXXX XXXX 4821', status: 'verified', provider: 'DigiLocker (demo)', token: 'tok_aad_7f3c' },
  { type: 'PAN', masked: 'XXXXX6413K', status: 'verified', provider: 'NSDL PAN verification (demo)', token: 'tok_pan_19be' },
];

// farmer_properties
export const PROPERTY = {
  ownership: 'Owned', survey: '214/2', village: 'Bakrol', district: 'Anand', state: 'Gujarat',
  area: 1.2, unit: 'acres', use: 'Mixed (fodder and cattle shed)', record: '7/12 land record extract', status: 'verified',
};

// credit_profiles (mock_data = true)
export const CREDIT = { bureau: 'CIBIL', score: 742, loans: 1, outstanding: 18000, retrieved: 'With consent, at application', mock: true };

// Data categories covered by the loan consent (consent_records.collection_categories)
export const CATEGORIES = ['identity_kyc', 'land_property', 'credit_history', 'milk_income'] as const;
export type Category = (typeof CATEGORIES)[number];

type FinText = {
  alsoShared: string; alsoSharedSub: string;
  kycTitle: string; kycText: string; landTitle: string; landText: string; creditTitle: string; creditText: string; milkTitle: string; milkText: string;
  consentTitle: string; consentIntro: string; statements: [string, string, string];
  noticeTitle: string; notice: [string, string][];
  agree: string; tickAll: string; version: string;
};

const en: FinText = {
  alsoShared: 'When you apply, this information is also shared',
  alsoSharedSub: 'Only with the bank you choose, only for your loan, and only after you agree on the next pages.',
  kycTitle: 'Identity and KYC', kycText: 'Government IDs such as Aadhaar and PAN, checked by an authorised provider',
  landTitle: 'Land and property records', landText: 'Land title, survey number or lease agreement, to show where your animals are kept',
  creditTitle: 'Credit history', creditText: 'Credit bureau score (such as CIBIL), to check past repayments',
  milkTitle: 'Milk income', milkText: 'Milk quantity and payments, last 12 months',
  consentTitle: 'Consent for sharing your information for this loan',
  consentIntro: 'Please read or listen. Tick each box to agree. You can say no, and you can withdraw later.',
  statements: [
    'I understand that the information I provide, including my identity and KYC details, land and property records, and credit-related information, may be collected and processed for the purpose of assessing and facilitating my loan application.',
    'I authorise the sharing of relevant information and supporting documents with the selected bank or authorised lending institution, including Union Bank of India, where applicable, for loan assessment, verification and processing, subject to applicable laws.',
    'I understand how my information will be used, who it will be shared with, and how I can exercise my applicable data protection rights.',
  ],
  noticeTitle: 'Notice: how your information is used',
  notice: [
    ['What is shared', 'Identity and KYC (masked Aadhaar and PAN, verification result), land and property records, credit bureau score and loans, milk income for 12 months'],
    ['Why', 'Only to assess, verify and process this loan application'],
    ['Who receives it', 'The bank you selected. DairyFin is not a lender and does not decide your loan'],
    ['How long', 'Until your application is decided, then as long as the bank\'s legal rules require'],
    ['Your rights', 'See what is held about you, ask for corrections, ask for deletion when no longer needed, and name someone to act for you'],
    ['Withdraw', 'Any time in Profile. Withdrawing is as easy as agreeing. It stops further sharing; the bank may stop processing your application'],
    ['Complaints', 'Grievance officer: grievance@doodhsetu.example (demo). If not resolved, you can complain to the Data Protection Board of India'],
  ],
  agree: 'I agree and continue', tickAll: 'Tick all three boxes to continue', version: 'Notice version',
};

const hi: FinText = {
  alsoShared: 'आवेदन करने पर यह जानकारी भी साझा होगी',
  alsoSharedSub: 'सिर्फ़ आपके चुने बैंक के साथ, सिर्फ़ आपके लोन के लिए, और अगले पन्नों पर आपकी सहमति के बाद ही।',
  kycTitle: 'पहचान और KYC', kycText: 'आधार और पैन जैसे सरकारी पहचान पत्र, अधिकृत संस्था द्वारा जाँचे गए',
  landTitle: 'ज़मीन और संपत्ति के रिकॉर्ड', landText: 'ज़मीन का मालिकाना कागज़, सर्वे नंबर या पट्टा, यह दिखाने के लिए कि पशु कहाँ रखे जाते हैं',
  creditTitle: 'क्रेडिट इतिहास', creditText: 'क्रेडिट ब्यूरो स्कोर (जैसे CIBIL), पुराने कर्ज़ चुकाने की जाँच के लिए',
  milkTitle: 'दूध की आय', milkText: 'पिछले 12 महीने का दूध और भुगतान',
  consentTitle: 'इस लोन के लिए आपकी जानकारी साझा करने की सहमति',
  consentIntro: 'कृपया पढ़ें या सुनें। सहमति के लिए हर बॉक्स पर निशान लगाएँ। आप मना कर सकते हैं और बाद में सहमति वापस ले सकते हैं।',
  statements: [
    'मैं समझता/समझती हूँ कि मेरी दी गई जानकारी, जिसमें पहचान और KYC विवरण, ज़मीन और संपत्ति के रिकॉर्ड और क्रेडिट से जुड़ी जानकारी शामिल है, मेरे लोन आवेदन की जाँच और प्रक्रिया के लिए एकत्र और उपयोग की जा सकती है।',
    'मैं चुने गए बैंक या अधिकृत ऋण संस्था, जहाँ लागू हो वहाँ यूनियन बैंक ऑफ़ इंडिया सहित, के साथ लोन की जाँच, सत्यापन और प्रक्रिया के लिए संबंधित जानकारी और दस्तावेज़ साझा करने की अनुमति देता/देती हूँ, लागू क़ानूनों के अधीन।',
    'मैं समझता/समझती हूँ कि मेरी जानकारी का उपयोग कैसे होगा, किसके साथ साझा होगी, और मैं अपने डेटा संरक्षण अधिकारों का उपयोग कैसे कर सकता/सकती हूँ।',
  ],
  noticeTitle: 'सूचना: आपकी जानकारी का उपयोग कैसे होता है',
  notice: [
    ['क्या साझा होगा', 'पहचान और KYC (छिपे हुए आधार और पैन, जाँच का परिणाम), ज़मीन के रिकॉर्ड, क्रेडिट स्कोर और कर्ज़, 12 महीने की दूध की आय'],
    ['क्यों', 'सिर्फ़ इस लोन आवेदन की जाँच, सत्यापन और प्रक्रिया के लिए'],
    ['किसे मिलेगी', 'आपका चुना हुआ बैंक। DairyFin कर्ज़ नहीं देता और आपके लोन का फ़ैसला नहीं करता'],
    ['कब तक', 'आवेदन पर फ़ैसला होने तक, फिर बैंक के क़ानूनी नियमों के अनुसार'],
    ['आपके अधिकार', 'अपनी जानकारी देखना, सुधार माँगना, ज़रूरत न रहने पर हटवाना, और किसी को अपनी ओर से नामित करना'],
    ['सहमति वापस लेना', 'प्रोफ़ाइल में कभी भी। यह सहमति देने जितना ही आसान है। इससे आगे साझा करना रुक जाता है; बैंक आवेदन रोक सकता है'],
    ['शिकायत', 'शिकायत अधिकारी: grievance@doodhsetu.example (डेमो)। हल न होने पर आप भारतीय डेटा संरक्षण बोर्ड से शिकायत कर सकते हैं'],
  ],
  agree: 'मैं सहमत हूँ, आगे बढ़ें', tickAll: 'आगे बढ़ने के लिए तीनों बॉक्स पर निशान लगाएँ', version: 'सूचना संस्करण',
};

const gu: FinText = {
  alsoShared: 'અરજી કરશો ત્યારે આ માહિતી પણ શેર થશે',
  alsoSharedSub: 'ફક્ત તમે પસંદ કરેલી બેંક સાથે, ફક્ત તમારી લોન માટે, અને આગળના પાનાં પર તમારી સંમતિ પછી જ.',
  kycTitle: 'ઓળખ અને KYC', kycText: 'આધાર અને પાન જેવા સરકારી ઓળખપત્રો, અધિકૃત સંસ્થા દ્વારા ચકાસાયેલા',
  landTitle: 'જમીન અને મિલકતના રેકોર્ડ', landText: 'જમીનનો દસ્તાવેજ, સર્વે નંબર અથવા ભાડાપટ્ટો, પશુઓ ક્યાં રાખો છો તે બતાવવા',
  creditTitle: 'ક્રેડિટ ઇતિહાસ', creditText: 'ક્રેડિટ બ્યુરો સ્કોર (જેમ કે CIBIL), અગાઉની ચુકવણી તપાસવા',
  milkTitle: 'દૂધની આવક', milkText: 'છેલ્લા 12 મહિનાનું દૂધ અને ચુકવણી',
  consentTitle: 'આ લોન માટે તમારી માહિતી શેર કરવાની સંમતિ',
  consentIntro: 'કૃપા કરીને વાંચો અથવા સાંભળો. સંમતિ માટે દરેક બૉક્સમાં ખરું કરો. તમે ના પાડી શકો છો અને પછી સંમતિ પાછી ખેંચી શકો છો.',
  statements: [
    'હું સમજું છું કે મેં આપેલી માહિતી, જેમાં ઓળખ અને KYC વિગતો, જમીન અને મિલકતના રેકોર્ડ અને ક્રેડિટ સંબંધિત માહિતી સામેલ છે, મારી લોન અરજીની તપાસ અને પ્રક્રિયા માટે એકત્ર અને ઉપયોગ થઈ શકે છે.',
    'હું પસંદ કરેલી બેંક અથવા અધિકૃત ધિરાણ સંસ્થા, જ્યાં લાગુ પડે ત્યાં યુનિયન બેંક ઑફ ઇન્ડિયા સહિત, સાથે લોનની તપાસ, ચકાસણી અને પ્રક્રિયા માટે સંબંધિત માહિતી અને દસ્તાવેજો શેર કરવાની મંજૂરી આપું છું, લાગુ કાયદાઓને આધીન.',
    'હું સમજું છું કે મારી માહિતીનો ઉપયોગ કેવી રીતે થશે, કોની સાથે શેર થશે, અને હું મારા ડેટા સંરક્ષણ અધિકારોનો ઉપયોગ કેવી રીતે કરી શકું.',
  ],
  noticeTitle: 'સૂચના: તમારી માહિતીનો ઉપયોગ કેવી રીતે થાય છે',
  notice: [
    ['શું શેર થશે', 'ઓળખ અને KYC (છુપાવેલા આધાર અને પાન, ચકાસણીનું પરિણામ), જમીનના રેકોર્ડ, ક્રેડિટ સ્કોર અને લોન, 12 મહિનાની દૂધની આવક'],
    ['શા માટે', 'ફક્ત આ લોન અરજીની તપાસ, ચકાસણી અને પ્રક્રિયા માટે'],
    ['કોને મળશે', 'તમે પસંદ કરેલી બેંક. DairyFin ધિરાણ આપતું નથી અને તમારી લોનનો નિર્ણય કરતું નથી'],
    ['ક્યાં સુધી', 'અરજીનો નિર્ણય થાય ત્યાં સુધી, પછી બેંકના કાયદાકીય નિયમો મુજબ'],
    ['તમારા અધિકારો', 'તમારી માહિતી જોવી, સુધારો માંગવો, જરૂર ન રહે ત્યારે કાઢી નાખવા કહેવું, અને તમારા વતી કોઈને નિમવા'],
    ['સંમતિ પાછી ખેંચવી', 'પ્રોફાઇલમાં ગમે ત્યારે. તે સંમતિ આપવા જેટલું જ સરળ છે. તેનાથી આગળ શેરિંગ બંધ થાય છે; બેંક અરજી રોકી શકે છે'],
    ['ફરિયાદ', 'ફરિયાદ અધિકારી: grievance@doodhsetu.example (ડેમો). નિરાકરણ ન થાય તો તમે ભારતના ડેટા પ્રોટેક્શન બોર્ડને ફરિયાદ કરી શકો છો'],
  ],
  agree: 'હું સંમત છું, આગળ વધો', tickAll: 'આગળ વધવા ત્રણેય બૉક્સમાં ખરું કરો', version: 'સૂચના આવૃત્તિ',
};

// Starter translations: legal text must be reviewed before field use. Other languages show English.
const FIN: Partial<Record<Lang, FinText>> = { en, hi, gu };
export const fin = (lang: Lang): FinText => FIN[lang] ?? en;

// Sends finance events to the database (Supabase) when it is configured. Never blocks the app.
export function syncFinance(event: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  fetch('/api/finance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) }).catch(() => undefined);
}
