// Rule-based assistant: answers only from approved content and the farmer's own records (BR-26).
import type { Lang } from './i18n';
import { dayTotals, explainChange, monthSummary, type Premium } from './farmer';
import { inr } from './util';

export type Intent = 'snf' | 'price' | 'earn' | 'increase' | 'premium' | 'loan' | 'today' | 'unknown';

const KEYWORDS: Record<Exclude<Intent, 'unknown'>, string[]> = {
  snf: ['snf', 'solid', 'एसएनएफ', 'एस एन एफ', 'ठोस', 'એસએનએફ', 'એસ એન એફ', 'ઘન'],
  price: ['price', 'rate', 'change', 'why', 'drop', 'less money', 'भाव', 'दाम', 'क्यों', 'बदल', 'घट', 'ભાવ', 'કેમ', 'બદલ', 'ઘટ'],
  earn: ['earn', 'income', 'how much', 'payment', 'money', 'कमाई', 'कमाया', 'कितना', 'भुगतान', 'પૈસા', 'કમાણી', 'કમાય', 'કેટલ', 'ચુકવણી'],
  increase: ['increase', 'more milk', 'summer', 'yield', 'heat', 'बढ़', 'बढा', 'गर्मी', 'ज़्यादा दूध', 'ज्यादा दूध', 'વધાર', 'વધુ દૂધ', 'ઉનાળ', 'ગરમી'],
  premium: ['premium', 'message', 'signal', 'प्रीमियम', 'संदेश', 'પ્રીમિયમ', 'સંદેશ'],
  loan: ['loan', 'emi', 'bank', 'credit', 'लोन', 'कर्ज', 'क़र्ज़', 'बैंक', 'લોન', 'બેંક', 'દેવું'],
  today: ['today', 'morning', 'evening', 'आज', 'सुबह', 'शाम', 'આજ', 'સવાર', 'સાંજ'],
};
const ORDER: Exclude<Intent, 'unknown'>[] = ['snf', 'loan', 'premium', 'increase', 'price', 'earn', 'today'];

export function detectIntent(q: string): Intent {
  const s = q.toLowerCase();
  for (const i of ORDER) if (KEYWORDS[i].some((k) => s.includes(k.toLowerCase()))) return i;
  return 'unknown';
}

const prevKey = (k: string) => {
  const [y, m] = k.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
};

export function answer(q: string, lang: Lang, today: string, premium: Premium | null): { intent: Intent; text: string; bullets?: string[] } {
  const intent = detectIntent(q);
  const curKey = today.endsWith('-30') || today.endsWith('-31') ? today.slice(0, 7) : prevKey(today.slice(0, 7));
  const L = (gu: string, hi: string, en: string) => (lang === 'gu' ? gu : lang === 'hi' ? hi : en);
  switch (intent) {
    case 'snf':
      return { intent, text: L(
        'એસએનએફ એટલે દૂધમાં ફેટ સિવાયના ઘન પદાર્થો, જેમ કે પ્રોટીન અને લેક્ટોઝ. એસએનએફ 8.5 ટકાથી વધુ હોય તો દર 0.1 ટકા પર દર કિલો ફેટે 6 રૂપિયા બોનસ મળે છે.',
        'एसएनएफ यानी दूध में फैट के अलावा ठोस पदार्थ, जैसे प्रोटीन और लैक्टोज़। एसएनएफ 8.5 प्रतिशत से ज़्यादा हो तो हर 0.1 प्रतिशत पर हर किलो फैट पर 6 रुपये बोनस मिलता है।',
        'SNF means the milk solids other than fat, like protein and lactose. Above 8.5%, every 0.1% earns a bonus of 6 rupees per kg of fat.') };
    case 'price': {
      const cur = monthSummary(curKey, premium, today), prev = monthSummary(prevKey(curKey), premium, today);
      const diff = cur.total - prev.total;
      const rs = explainChange(prev, cur);
      const name = (k: string) => k === 'premium' ? L('ભેંસના દૂધ પર પ્રીમિયમ', 'भैंस के दूध पर प्रीमियम', 'buffalo milk premium') : k === 'snf' ? L('એસએનએફ', 'एसएनएफ', 'SNF') : L('દૂધનો જથ્થો', 'दूध की मात्रा', 'milk quantity');
      return { intent, text: L(
        `આ મહિને તમારી ચુકવણી ${inr(Math.abs(diff))} ${diff >= 0 ? 'વધી' : 'ઘટી'}. કારણો:`,
        `इस महीने आपका भुगतान ${inr(Math.abs(diff))} ${diff >= 0 ? 'बढ़ा' : 'घटा'}। कारण:`,
        `Your payment ${diff >= 0 ? 'went up' : 'went down'} by ${inr(Math.abs(diff))} this month. Reasons:`),
        bullets: rs.map((r) => `${r.amount >= 0 ? '+' : '-'}${inr(Math.abs(r.amount))}: ${name(r.key)}`) };
    }
    case 'earn': {
      const cur = monthSummary(today.slice(0, 7), premium, today);
      return { intent, text: L(
        `આ મહિને અત્યાર સુધી તમે ${Math.round(cur.litres)} લિટર દૂધ ભર્યું અને ${inr(cur.total)} કમાયા.`,
        `इस महीने अब तक आपने ${Math.round(cur.litres)} लीटर दूध दिया और ${inr(cur.total)} कमाए।`,
        `So far this month you poured ${Math.round(cur.litres)} litres and earned ${inr(cur.total)}.`) };
    }
    case 'today': {
      const d = dayTotals(today, premium);
      return { intent, text: L(
        `આજે સવારે ${d.am.toFixed(1)} લિટર અને સાંજે ${d.pm.toFixed(1)} લિટર. ફેટ ${d.fat.toFixed(1)} ટકા, એસએનએફ ${d.snf.toFixed(1)} ટકા. આજની રકમ ${inr(d.amount)}.`,
        `आज सुबह ${d.am.toFixed(1)} लीटर और शाम ${d.pm.toFixed(1)} लीटर। फैट ${d.fat.toFixed(1)} प्रतिशत, एसएनएफ ${d.snf.toFixed(1)} प्रतिशत। आज की राशि ${inr(d.amount)}।`,
        `Today: ${d.am.toFixed(1)} litres in the morning and ${d.pm.toFixed(1)} in the evening. Fat ${d.fat.toFixed(1)}%, SNF ${d.snf.toFixed(1)}%. Today's amount ${inr(d.amount)}.`) };
    }
    case 'increase':
      return { intent, text: L('ઉનાળામાં દૂધ જાળવવા માટે પશુચિકિત્સકે મંજૂર કરેલી સલાહ:', 'गर्मी में दूध बनाए रखने के लिए पशु चिकित्सक द्वारा स्वीकृत सलाह:', 'Veterinarian-approved advice for keeping milk up in summer:'),
        bullets: lang === 'gu' ? ['દરરોજ લીલો ચારો અથવા સાઇલેજ આપો', 'દિવસમાં 3-4 વાર ચોખ્ખું પાણી આપો', 'બપોરે પશુઓને છાંયડામાં રાખો', 'મિનરલ મિક્સચર વિશે મંડળીને પૂછો']
          : lang === 'hi' ? ['रोज़ हरा चारा या साइलेज दें', 'दिन में 3-4 बार साफ़ पानी दें', 'दोपहर में पशुओं को छाँव में रखें', 'मिनरल मिक्सचर के बारे में मंडली से पूछें']
          : ['Give green fodder or silage every day', 'Give clean water 3-4 times a day', 'Keep animals in shade at midday', 'Ask the society about mineral mixture'] };
    case 'premium':
      return { intent, text: premium
        ? L(`એપ્રિલથી જૂન સુધી ભેંસના દૂધ પર દર કિલો ફેટે ${premium.rate} રૂપિયા વધારાના મળે છે. વિગતો સંદેશા ટૅબમાં છે.`, `अप्रैल से जून तक भैंस के दूध पर हर किलो फैट पर ${premium.rate} रुपये अतिरिक्त मिलते हैं। विवरण संदेश टैब में है।`, `From April to June, buffalo milk earns ${premium.rate} rupees extra per kg fat. Details are in the Signals tab.`)
        : L('હાલમાં તમારી મંડળી તરફથી કોઈ પ્રીમિયમ નથી.', 'अभी आपकी मंडली की ओर से कोई प्रीमियम नहीं है।', 'There is no premium from your society right now.') };
    case 'loan':
      return { intent, text: L('લોન વિશે માહિતી નાણાં ટૅબમાં છે. ત્યાં તમે લોન ભરી શકશો કે નહીં તે જોઈ શકો. નિર્ણય હંમેશા બેંક લે છે.', 'लोन की जानकारी वित्त टैब में है। वहाँ आप देख सकते हैं कि लोन चुका पाएँगे या नहीं। फ़ैसला हमेशा बैंक करता है।', 'Loan information is in the Finance tab, where you can check if a loan is affordable. The bank always makes the decision.') };
    default:
      return { intent, text: L('માફ કરશો, હું આનો જવાબ આપી શકતો નથી. તમે મંડળીના કોઈ વ્યક્તિ સાથે વાત કરી શકો છો.', 'माफ़ कीजिए, मैं इसका जवाब नहीं दे सकता। आप मंडली के किसी व्यक्ति से बात कर सकते हैं।', "Sorry, I can't answer that. You can talk to a person at your society.") };
  }
}
