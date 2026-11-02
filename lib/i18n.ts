// Farmer-facing strings in Gujarati, Hindi and English.
// Starter translations for the prototype: to be reviewed by native speakers before field use.
export type Lang = 'gu' | 'hi' | 'en';
export const LANGS: { id: Lang; label: string; code: string }[] = [
  { id: 'gu', label: 'ગુજરાતી', code: 'gu-IN' },
  { id: 'hi', label: 'हिन्दी', code: 'hi-IN' },
  { id: 'en', label: 'English', code: 'en-IN' },
];
export const LANG_CODE: Record<Lang, string> = { gu: 'gu-IN', hi: 'hi-IN', en: 'en-IN' };

type Dict = Record<string, string>;
const en: Dict = {
  appName: 'Doodh Setu', namaste: 'Namaste', member: 'Member',
  home: 'Home', earnings: 'Earnings', signals: 'Signals', finance: 'Finance', ask: 'Ask',
  todaysMilk: "Today's milk", morning: 'Morning', evening: 'Evening', today: 'today',
  goodQuality: 'Good quality', checkQuality: 'Check quality',
  monthSoFar: 'This month so far', vsLastMonth: 'vs last month',
  newFromSociety: 'New from your society', fromSociety: 'From', seeDetails: 'See details',
  noSignals: 'No new messages from your society.', alertsNone: 'Alerts: none today',
  whatNeeded: 'What is needed', worthToYou: 'Worth to you', perMonth: '/ month', about: 'about',
  basedOn: 'Based on your last 3 months of milk', whatYouCanDo: 'What you can do',
  act1: 'Time insemination for Feb-Mar calving next year', act2: 'Add mineral mixture to feed (ask the society)', act3: "Keep treated animals' milk separate",
  exploreFinance: 'Explore finance for this', interested: "I'm interested", interestedDone: 'Sent. Your society will call you.',
  askQ: 'Ask a question', callSociety: 'Call society',
  whyChanged: 'Why did my price change?', comparedWith: 'compared with', total: 'Total',
  rPremium: 'Summer premium for buffalo milk', rSnfUp: 'Your milk solids (SNF) went up', rSnfDown: 'Your milk solids (SNF) went down',
  rVolUp: 'More milk this month', rVolDown: 'Less milk this month (fewer days or lean season)',
  whyPremium: 'Why the premium?', whyPremiumText: 'Paneer and curd demand is high this summer, so buffalo milk is worth more to the union.',
  talkSociety: 'Talk to society', statement: 'Monthly statement', litres: 'Litres', base: 'Base amount', snfBonus: 'SNF bonus', premium: 'Premium',
  youSaid: 'You said', tryAgain: 'Not right? Try again', automated: 'Automated answer', talkPerson: 'Talk to a person',
  tapSpeak: 'Tap and speak', listening: 'Listening...', thinking: 'Working...', typeInstead: 'Or type your question',
  suggested: 'Suggested questions', sq1: 'Why did my price change?', sq2: 'How can I increase milk in summer?', sq3: 'How much did I earn this month?', sq4: 'What is SNF?',
  helpful: 'Was this helpful?', yes: 'Yes', no: 'No', sentToSociety: 'Sent to your society. They will reply soon.',
  financeHome: 'DairyFin', avgMonthly: 'Average monthly milk payments', simulated: 'Simulated data', incomeInsights: 'Income insights',
  checkAfford: 'Check loan affordability', exploreOptions: 'Explore finance options', trackApp: 'Track my application',
  months: 'months', coverage: 'months recorded', download: 'Download report',
  loanAmount: 'Loan amount', interest: 'Annual interest (%)', tenure: 'Tenure (months)', monthlyIncome: 'Monthly dairy income', fromRecords: 'from records',
  expenses: 'Farm expenses per month', existingEmi: 'Existing EMI', estimateOnly: 'Estimate only', emi: 'EMI', leftAfter: 'Left after EMI',
  lowestOk: 'Lowest month last year: still covered', lowestBad: 'Lowest month last year: not covered', emiHigh: 'This EMI uses more than half of what you have left. Think carefully.',
  notGuaranteed: 'The summer premium is not guaranteed income and is not counted here. The bank decides.', compare: 'Compare products',
  demoOffer: 'Demo offer', range: 'Range', rate: 'Rate', fees: 'Fees', eligibility: 'Eligibility', startApp: 'Start application',
  shareRecords: 'Share your milk records?', listenCarefully: 'Please listen or read carefully', sharedWith: 'Shared with', purpose: 'Purpose',
  purposeText: 'To assess my loan application', data: 'Data', dataText: 'Milk quantity and payments', period: 'Period', last12: 'Last 12 months',
  keptFor: 'Kept for', keptText: "As the bank's rules require", youCan: 'You can', youCanText: 'Withdraw any time in Profile',
  allow: 'I allow sharing for this purpose', notNow: 'Not now', continue: 'Continue',
  application: 'Application', documents: 'Documents', submit: 'Submit', idProof: 'Identity proof', bankAcc: 'Bank account details', cattleQuote: 'Cattle purchase quote',
  submitted: 'Submitted', reference: 'Reference', status: 'Status', nextStep: 'Next step', bankDecides: 'The bank decides. We never promise approval.',
  docRequested: 'The bank asked for a document', upload: 'Upload', uploaded: 'Uploaded',
  st_submitted: 'Submitted', st_in_review: 'In review', st_more_info: 'More information needed', st_approved: 'Approved by the bank', st_declined: 'Declined by the bank', st_withdrawn: 'Withdrawn',
  noApp: 'You have no applications yet.', back: 'Back', profile: 'Profile and my data', language: 'Language', myData: 'My data',
  myDataText: 'We hold your milk records, payments, messages you received, and consents you gave. Your data is used to raise your income, never to lower your price.',
  consents: 'Consents', withdraw: 'Withdraw', withdrawn: 'Withdrawn', requestCorrection: 'Request a correction', requested: 'Request sent',
  offline: 'Offline. Showing saved data.', listen: 'Listen', voiceSource: 'Voice',
};

const hi: Dict = {
  appName: 'दूध सेतु', namaste: 'नमस्ते', member: 'सदस्य',
  home: 'होम', earnings: 'कमाई', signals: 'संदेश', finance: 'वित्त', ask: 'पूछें',
  todaysMilk: 'आज का दूध', morning: 'सुबह', evening: 'शाम', today: 'आज',
  goodQuality: 'अच्छी गुणवत्ता', checkQuality: 'गुणवत्ता जाँचें',
  monthSoFar: 'इस महीने अब तक', vsLastMonth: 'पिछले महीने से',
  newFromSociety: 'आपकी मंडली से नया संदेश', fromSociety: 'भेजने वाला', seeDetails: 'विवरण देखें',
  noSignals: 'आपकी मंडली से कोई नया संदेश नहीं।', alertsNone: 'आज कोई चेतावनी नहीं',
  whatNeeded: 'क्या चाहिए', worthToYou: 'आपके लिए फ़ायदा', perMonth: '/ महीना', about: 'लगभग',
  basedOn: 'आपके पिछले 3 महीने के दूध के आधार पर', whatYouCanDo: 'आप क्या कर सकते हैं',
  act1: 'अगले साल फ़रवरी-मार्च में ब्याने के लिए गर्भाधान का समय तय करें', act2: 'चारे में मिनरल मिक्सचर मिलाएँ (मंडली से पूछें)', act3: 'इलाज वाले पशु का दूध अलग रखें',
  exploreFinance: 'इसके लिए लोन देखें', interested: 'मुझे रुचि है', interestedDone: 'भेज दिया। मंडली आपको कॉल करेगी।',
  askQ: 'सवाल पूछें', callSociety: 'मंडली को कॉल करें',
  whyChanged: 'मेरा भाव क्यों बदला?', comparedWith: 'की तुलना में', total: 'कुल',
  rPremium: 'भैंस के दूध पर गर्मी का प्रीमियम', rSnfUp: 'आपके दूध का एसएनएफ बढ़ा', rSnfDown: 'आपके दूध का एसएनएफ घटा',
  rVolUp: 'इस महीने ज़्यादा दूध', rVolDown: 'इस महीने कम दूध (कम दिन या गर्मी का मौसम)',
  whyPremium: 'प्रीमियम क्यों?', whyPremiumText: 'इस गर्मी में पनीर और दही की माँग ज़्यादा है, इसलिए भैंस का दूध संघ के लिए ज़्यादा कीमती है।',
  talkSociety: 'मंडली से बात करें', statement: 'मासिक विवरण', litres: 'लीटर', base: 'मूल राशि', snfBonus: 'एसएनएफ बोनस', premium: 'प्रीमियम',
  youSaid: 'आपने कहा', tryAgain: 'सही नहीं? फिर से कोशिश करें', automated: 'स्वचालित जवाब', talkPerson: 'किसी व्यक्ति से बात करें',
  tapSpeak: 'दबाएँ और बोलें', listening: 'सुन रहे हैं...', thinking: 'काम हो रहा है...', typeInstead: 'या अपना सवाल लिखें',
  suggested: 'सुझाए गए सवाल', sq1: 'मेरा भाव क्यों बदला?', sq2: 'गर्मी में दूध कैसे बढ़ाएँ?', sq3: 'इस महीने मैंने कितना कमाया?', sq4: 'एसएनएफ क्या है?',
  helpful: 'क्या यह मददगार था?', yes: 'हाँ', no: 'नहीं', sentToSociety: 'मंडली को भेज दिया। वे जल्द जवाब देंगे।',
  financeHome: 'डेयरीफ़िन', avgMonthly: 'औसत मासिक दूध भुगतान', simulated: 'नमूना डेटा', incomeInsights: 'आय की जानकारी',
  checkAfford: 'लोन चुका पाएँगे या नहीं देखें', exploreOptions: 'लोन विकल्प देखें', trackApp: 'मेरा आवेदन देखें',
  months: 'महीने', coverage: 'महीने दर्ज', download: 'रिपोर्ट डाउनलोड करें',
  loanAmount: 'लोन राशि', interest: 'सालाना ब्याज (%)', tenure: 'अवधि (महीने)', monthlyIncome: 'मासिक डेयरी आय', fromRecords: 'रिकॉर्ड से',
  expenses: 'मासिक खेती खर्च', existingEmi: 'मौजूदा ईएमआई', estimateOnly: 'केवल अनुमान', emi: 'ईएमआई', leftAfter: 'ईएमआई के बाद बचेगा',
  lowestOk: 'पिछले साल का सबसे कम महीना: फिर भी पूरा', lowestBad: 'पिछले साल का सबसे कम महीना: पूरा नहीं', emiHigh: 'यह ईएमआई आपकी बचत के आधे से ज़्यादा है। सोच-समझकर फ़ैसला करें।',
  notGuaranteed: 'गर्मी का प्रीमियम पक्की आय नहीं है और यहाँ नहीं जोड़ा गया। फ़ैसला बैंक करेगा।', compare: 'उत्पादों की तुलना करें',
  demoOffer: 'डेमो ऑफ़र', range: 'राशि', rate: 'ब्याज', fees: 'शुल्क', eligibility: 'पात्रता', startApp: 'आवेदन शुरू करें',
  shareRecords: 'अपना दूध रिकॉर्ड साझा करें?', listenCarefully: 'कृपया ध्यान से सुनें या पढ़ें', sharedWith: 'किसके साथ', purpose: 'उद्देश्य',
  purposeText: 'मेरे लोन आवेदन की जाँच के लिए', data: 'जानकारी', dataText: 'दूध की मात्रा और भुगतान', period: 'अवधि', last12: 'पिछले 12 महीने',
  keptFor: 'कब तक रखा जाएगा', keptText: 'बैंक के नियमों के अनुसार', youCan: 'आप', youCanText: 'प्रोफ़ाइल में कभी भी वापस ले सकते हैं',
  allow: 'इस काम के लिए जानकारी साझा करने की अनुमति दें', notNow: 'अभी नहीं', continue: 'आगे बढ़ें',
  application: 'आवेदन', documents: 'दस्तावेज़', submit: 'जमा करें', idProof: 'पहचान पत्र', bankAcc: 'बैंक खाते की जानकारी', cattleQuote: 'पशु खरीद का कोटेशन',
  submitted: 'जमा हुआ', reference: 'संदर्भ', status: 'स्थिति', nextStep: 'अगला कदम', bankDecides: 'फ़ैसला बैंक करेगा। हम मंज़ूरी का वादा नहीं करते।',
  docRequested: 'बैंक ने एक दस्तावेज़ माँगा है', upload: 'अपलोड करें', uploaded: 'अपलोड हो गया',
  st_submitted: 'जमा हुआ', st_in_review: 'जाँच जारी', st_more_info: 'और जानकारी चाहिए', st_approved: 'बैंक ने मंज़ूर किया', st_declined: 'बैंक ने अस्वीकार किया', st_withdrawn: 'वापस लिया',
  noApp: 'अभी कोई आवेदन नहीं।', back: 'वापस', profile: 'प्रोफ़ाइल और मेरा डेटा', language: 'भाषा', myData: 'मेरा डेटा',
  myDataText: 'हमारे पास आपका दूध रिकॉर्ड, भुगतान, मिले संदेश और आपकी दी हुई अनुमतियाँ हैं। आपके डेटा का उपयोग आपकी आय बढ़ाने के लिए होता है, भाव घटाने के लिए कभी नहीं।',
  consents: 'अनुमतियाँ', withdraw: 'वापस लें', withdrawn: 'वापस ली गई', requestCorrection: 'सुधार का अनुरोध करें', requested: 'अनुरोध भेजा',
  offline: 'ऑफ़लाइन। सहेजी गई जानकारी दिख रही है।', listen: 'सुनें', voiceSource: 'आवाज़',
};

const gu: Dict = {
  appName: 'દૂધ સેતુ', namaste: 'નમસ્તે', member: 'સભ્ય',
  home: 'હોમ', earnings: 'કમાણી', signals: 'સંદેશા', finance: 'નાણાં', ask: 'પૂછો',
  todaysMilk: 'આજનું દૂધ', morning: 'સવાર', evening: 'સાંજ', today: 'આજે',
  goodQuality: 'સારી ગુણવત્તા', checkQuality: 'ગુણવત્તા તપાસો',
  monthSoFar: 'આ મહિને અત્યાર સુધી', vsLastMonth: 'ગયા મહિના કરતાં',
  newFromSociety: 'તમારી મંડળી તરફથી નવો સંદેશ', fromSociety: 'મોકલનાર', seeDetails: 'વિગતો જુઓ',
  noSignals: 'તમારી મંડળી તરફથી કોઈ નવો સંદેશ નથી.', alertsNone: 'આજે કોઈ ચેતવણી નથી',
  whatNeeded: 'શું જોઈએ છે', worthToYou: 'તમારા માટે ફાયદો', perMonth: '/ મહિને', about: 'આશરે',
  basedOn: 'તમારા છેલ્લા 3 મહિનાના દૂધના આધારે', whatYouCanDo: 'તમે શું કરી શકો',
  act1: 'આવતા વર્ષે ફેબ્રુઆરી-માર્ચમાં વિયાણ માટે બીજદાનનો સમય નક્કી કરો', act2: 'ખાણમાં મિનરલ મિક્સચર ઉમેરો (મંડળીને પૂછો)', act3: 'સારવાર લેતા પશુનું દૂધ અલગ રાખો',
  exploreFinance: 'આ માટે લોન જુઓ', interested: 'મને રસ છે', interestedDone: 'મોકલ્યું. મંડળી તમને કૉલ કરશે.',
  askQ: 'પ્રશ્ન પૂછો', callSociety: 'મંડળીને કૉલ કરો',
  whyChanged: 'મારો ભાવ કેમ બદલાયો?', comparedWith: 'ની સરખામણીમાં', total: 'કુલ',
  rPremium: 'ભેંસના દૂધ પર ઉનાળાનું પ્રીમિયમ', rSnfUp: 'તમારા દૂધનું એસએનએફ વધ્યું', rSnfDown: 'તમારા દૂધનું એસએનએફ ઘટ્યું',
  rVolUp: 'આ મહિને વધુ દૂધ', rVolDown: 'આ મહિને ઓછું દૂધ (ઓછા દિવસ અથવા ઉનાળાની મોસમ)',
  whyPremium: 'પ્રીમિયમ કેમ?', whyPremiumText: 'આ ઉનાળામાં પનીર અને દહીંની માંગ વધુ છે, તેથી ભેંસનું દૂધ સંઘ માટે વધુ કિંમતી છે.',
  talkSociety: 'મંડળી સાથે વાત કરો', statement: 'માસિક પત્રક', litres: 'લિટર', base: 'મૂળ રકમ', snfBonus: 'એસએનએફ બોનસ', premium: 'પ્રીમિયમ',
  youSaid: 'તમે કહ્યું', tryAgain: 'બરાબર નથી? ફરી પ્રયાસ કરો', automated: 'સ્વચાલિત જવાબ', talkPerson: 'કોઈ વ્યક્તિ સાથે વાત કરો',
  tapSpeak: 'દબાવો અને બોલો', listening: 'સાંભળી રહ્યા છીએ...', thinking: 'કામ ચાલુ છે...', typeInstead: 'અથવા તમારો પ્રશ્ન લખો',
  suggested: 'સૂચવેલા પ્રશ્નો', sq1: 'મારો ભાવ કેમ બદલાયો?', sq2: 'ઉનાળામાં દૂધ કેવી રીતે વધારવું?', sq3: 'આ મહિને મેં કેટલું કમાયું?', sq4: 'એસએનએફ એટલે શું?',
  helpful: 'શું આ ઉપયોગી હતું?', yes: 'હા', no: 'ના', sentToSociety: 'મંડળીને મોકલ્યું. તેઓ જલ્દી જવાબ આપશે.',
  financeHome: 'ડેરીફિન', avgMonthly: 'સરેરાશ માસિક દૂધ ચુકવણી', simulated: 'નમૂના ડેટા', incomeInsights: 'આવકની માહિતી',
  checkAfford: 'લોન ભરી શકશો કે નહીં તે જુઓ', exploreOptions: 'લોનના વિકલ્પો જુઓ', trackApp: 'મારી અરજી જુઓ',
  months: 'મહિના', coverage: 'મહિના નોંધાયા', download: 'રિપોર્ટ ડાઉનલોડ કરો',
  loanAmount: 'લોનની રકમ', interest: 'વાર્ષિક વ્યાજ (%)', tenure: 'મુદત (મહિના)', monthlyIncome: 'માસિક ડેરી આવક', fromRecords: 'રેકોર્ડમાંથી',
  expenses: 'માસિક ખેતી ખર્ચ', existingEmi: 'હાલનો ઇએમઆઇ', estimateOnly: 'માત્ર અંદાજ', emi: 'ઇએમઆઇ', leftAfter: 'ઇએમઆઇ પછી બચશે',
  lowestOk: 'ગયા વર્ષનો સૌથી ઓછો મહિનો: છતાં પૂરતું', lowestBad: 'ગયા વર્ષનો સૌથી ઓછો મહિનો: પૂરતું નથી', emiHigh: 'આ ઇએમઆઇ તમારી બચતના અડધાથી વધુ છે. વિચારીને નિર્ણય લો.',
  notGuaranteed: 'ઉનાળાનું પ્રીમિયમ નક્કી આવક નથી અને અહીં ગણ્યું નથી. નિર્ણય બેંક લેશે.', compare: 'ઉત્પાદનોની સરખામણી કરો',
  demoOffer: 'ડેમો ઓફર', range: 'રકમ', rate: 'વ્યાજ', fees: 'ફી', eligibility: 'પાત્રતા', startApp: 'અરજી શરૂ કરો',
  shareRecords: 'તમારા દૂધના રેકોર્ડ શેર કરશો?', listenCarefully: 'કૃપા કરીને ધ્યાનથી સાંભળો અથવા વાંચો', sharedWith: 'કોની સાથે', purpose: 'હેતુ',
  purposeText: 'મારી લોન અરજીની તપાસ માટે', data: 'માહિતી', dataText: 'દૂધનો જથ્થો અને ચુકવણી', period: 'સમયગાળો', last12: 'છેલ્લા 12 મહિના',
  keptFor: 'ક્યાં સુધી રાખશે', keptText: 'બેંકના નિયમો મુજબ', youCan: 'તમે', youCanText: 'પ્રોફાઇલમાં ગમે ત્યારે પાછું ખેંચી શકો',
  allow: 'આ હેતુ માટે માહિતી શેર કરવાની મંજૂરી આપો', notNow: 'હમણાં નહીં', continue: 'આગળ વધો',
  application: 'અરજી', documents: 'દસ્તાવેજો', submit: 'જમા કરો', idProof: 'ઓળખનો પુરાવો', bankAcc: 'બેંક ખાતાની વિગતો', cattleQuote: 'પશુ ખરીદીનું ક્વોટેશન',
  submitted: 'જમા થઈ', reference: 'સંદર્ભ', status: 'સ્થિતિ', nextStep: 'આગળનું પગલું', bankDecides: 'નિર્ણય બેંક લેશે. અમે મંજૂરીનું વચન આપતા નથી.',
  docRequested: 'બેંકે એક દસ્તાવેજ માંગ્યો છે', upload: 'અપલોડ કરો', uploaded: 'અપલોડ થયું',
  st_submitted: 'જમા થઈ', st_in_review: 'તપાસ ચાલુ', st_more_info: 'વધુ માહિતી જોઈએ', st_approved: 'બેંકે મંજૂર કરી', st_declined: 'બેંકે નામંજૂર કરી', st_withdrawn: 'પાછી ખેંચી',
  noApp: 'હજુ કોઈ અરજી નથી.', back: 'પાછા', profile: 'પ્રોફાઇલ અને મારો ડેટા', language: 'ભાષા', myData: 'મારો ડેટા',
  myDataText: 'અમારી પાસે તમારા દૂધના રેકોર્ડ, ચુકવણી, મળેલા સંદેશા અને તમે આપેલી મંજૂરીઓ છે. તમારા ડેટાનો ઉપયોગ તમારી આવક વધારવા માટે થાય છે, ભાવ ઘટાડવા માટે ક્યારેય નહીં.',
  consents: 'મંજૂરીઓ', withdraw: 'પાછું ખેંચો', withdrawn: 'પાછું ખેંચ્યું', requestCorrection: 'સુધારાની વિનંતી કરો', requested: 'વિનંતી મોકલી',
  offline: 'ઑફલાઇન. સાચવેલી માહિતી બતાવી રહ્યા છીએ.', listen: 'સાંભળો', voiceSource: 'અવાજ',
};

export const STRINGS: Record<Lang, Dict> = { en, hi, gu };
export const t = (lang: Lang, key: string) => STRINGS[lang][key] ?? STRINGS.en[key] ?? key;

// Signal message templates (reviewed templates, FRD Section 12). Values are filled in.
export function signalMessage(lang: Lang, v: { society: string; rate: number; worth: number }) {
  if (lang === 'gu') return `${v.society} તરફથી સંદેશ: એપ્રિલથી જૂન સુધી ભેંસના દૂધ પર દર કિલો ફેટે ${v.rate} રૂપિયા વધારાના મળશે. આ દર આખા સમયગાળા માટે નક્કી છે. તમારા દૂધ પ્રમાણે આ આશરે મહિને ${v.worth} રૂપિયા થાય.`;
  if (lang === 'hi') return `${v.society} की ओर से संदेश: अप्रैल से जून तक भैंस के दूध पर हर किलो फैट पर ${v.rate} रुपये अतिरिक्त मिलेंगे। यह दर पूरी अवधि के लिए तय है। आपके दूध के हिसाब से यह लगभग ${v.worth} रुपये महीना होगा।`;
  return `Message from ${v.society}: from April to June, buffalo milk earns ${v.rate} rupees extra per kg of fat. This rate is fixed for the whole period. For your milk, this is about ${v.worth} rupees a month.`;
}

export const SIGNAL_TITLE: Record<Lang, string> = {
  gu: 'ઉનાળામાં ભેંસના દૂધ પર પ્રીમિયમ', hi: 'गर्मी में भैंस के दूध पर प्रीमियम', en: 'Summer buffalo milk premium',
};
export const SIGNAL_NEED: Record<Lang, (rate: number) => string[]> = {
  gu: (r) => ['એપ્રિલથી જૂન સુધી વધુ ભેંસનું દૂધ', `દર કિલો ફેટે ₹${r} વધારાના, આખા સમયગાળા માટે નક્કી`],
  hi: (r) => ['अप्रैल से जून तक ज़्यादा भैंस का दूध', `हर किलो फैट पर ₹${r} अतिरिक्त, पूरी अवधि के लिए तय`],
  en: (r) => ['More buffalo milk, April to June', `Extra ₹${r} per kg fat, fixed for the period`],
};

// ---------- Monthly milk story (BRD FR-G8, FRD FW12). Starter translations: review before field use. ----------
export const STORY: Record<Lang, Record<string, string>> = {
  en: { label: 'Milk story', title: 'Where your milk goes this summer', per100: 'Out of every 100 litres from your society', litres: 'litres',
    why: 'Cities buy more curd, lassi and ice cream in the heat, so less milk goes to low-value powder. Better use of each litre supports the price you receive.', new: 'New', open: 'See where it goes' },
  hi: { label: 'दूध की बात', title: 'इस गर्मी में आपका दूध कहाँ जाता है', per100: 'आपकी मंडली के हर 100 लीटर में से', litres: 'लीटर',
    why: 'गर्मी में शहरों में दही, लस्सी और आइसक्रीम की माँग बढ़ती है, इसलिए कम दूध सस्ते पाउडर में जाता है। हर लीटर का बेहतर उपयोग आपके भाव को सहारा देता है।', new: 'नया', open: 'देखें दूध कहाँ जाता है' },
  gu: { label: 'દૂધની વાત', title: 'આ ઉનાળામાં તમારું દૂધ ક્યાં જાય છે', per100: 'તમારી મંડળીના દર 100 લિટરમાંથી', litres: 'લિટર',
    why: 'ગરમીમાં શહેરોમાં દહીં, લસ્સી અને આઇસક્રીમની માંગ વધે છે, તેથી ઓછું દૂધ ઓછી કિંમતના પાવડરમાં જાય છે. દરેક લિટરનો સારો ઉપયોગ તમારા ભાવને ટેકો આપે છે.', new: 'નવું', open: 'દૂધ ક્યાં જાય છે તે જુઓ' },
};

export const STORY_PRODUCT: Record<Lang, Record<string, string>> = {
  en: { milk: 'liquid milk', curd: 'curd', paneer: 'paneer', lassi: 'lassi and buttermilk', icecream: 'ice cream', sink: 'milk powder and butter' },
  hi: { milk: 'पाउच दूध', curd: 'दही', paneer: 'पनीर', lassi: 'लस्सी और छाछ', icecream: 'आइसक्रीम', sink: 'पाउडर और मक्खन' },
  gu: { milk: 'પાઉચ દૂધ', curd: 'દહીં', paneer: 'પનીર', lassi: 'લસ્સી અને છાશ', icecream: 'આઇસક્રીમ', sink: 'પાવડર અને માખણ' },
};

export function storyMessage(lang: Lang, society: string, shares: { id: string; share: number }[]) {
  const items = [...shares].sort((a, b) => b.share - a.share);
  const n = (id: string) => STORY_PRODUCT[lang][id];
  const S = STORY[lang];
  if (lang === 'gu') return `${society} તરફથી સંદેશ: ${S.title}. આપણી મંડળીના દર 100 લિટર દૂધમાંથી આશરે ${items.map((i) => `${i.share} લિટર ${n(i.id)}`).join(', ')}માં જાય છે. ${S.why}`;
  if (lang === 'hi') return `${society} की ओर से संदेश: ${S.title}। हमारी मंडली के हर 100 लीटर दूध में से लगभग ${items.map((i) => `${i.share} लीटर ${n(i.id)}`).join(', ')} में जाता है। ${S.why}`;
  const list = items.map((i, k) => (k === 0 ? `about ${i.share} litres go to ${n(i.id)}` : `${i.share} to ${n(i.id)}`));
  return `Message from ${society}: ${S.title}. Out of every 100 litres from our society, ${list.slice(0, -1).join(', ')} and ${list.at(-1)}. ${S.why}`;
}
