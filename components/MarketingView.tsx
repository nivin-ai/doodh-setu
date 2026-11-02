'use client';
// Planner console > Marketing (BRD Module G; FRD PW7 to PW10, screens P-11 to P-14)
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '@/lib/store';
import { FARMER } from '@/lib/demo';
import { CAMPAIGNS, SEGMENTS, WEEKLY_CAP, campaignPlan, campaignResult, milkStory, opportunities, type Campaign } from '@/lib/marketing';
import { STORY, STORY_PRODUCT, storyMessage, type Lang } from '@/lib/i18n';
import { fmtDate, inrShort, num, pct } from '@/lib/util';
import { CHART, Chip, Note, PageTitle, PlayButton, Segmented, Stat } from './ui';
import { IconCheck, IconChevron } from './icons';

type Tab = 'opps' | 'campaigns' | 'results' | 'members';
const NAMES = { planner: 'Priya (planner)', approver: 'Mr Shah (approver)', marketer: 'Neha (marketing)' };
const CHANNEL_HINT: Record<string, string> = {
  icecream: 'Quick commerce in-app ads on hot weekends',
  lassi: 'Quick commerce ads and booth posters during the heatwave',
  curd: 'Quick commerce sponsored listings; Amul Shop subscriptions',
  paneer: 'Regional media and quick commerce; strongest in festivals and weddings',
};
export const PRODUCT_COLOR: Record<string, string> = { milk: CHART.indigo, curd: CHART.green, paneer: CHART.marigold, lassi: '#6B8BD6', icecream: CHART.temp, sink: CHART.grey };

export default function MarketingView() {
  const [tab, setTab] = useState<Tab>('opps');
  return (
    <div>
      <PageTitle title="Marketing" sub="Uses the same forecast and product-mix plan as procurement: what to promote, where and when, only where milk and stock allow; and what to tell farmer members." />
      <div className="mb-4"><Segmented options={[{ id: 'opps', label: 'Opportunities' }, { id: 'campaigns', label: 'Campaigns' }, { id: 'results', label: 'Results' }, { id: 'members', label: 'Farmer members' }]} value={tab} onChange={(v) => setTab(v as Tab)} /></div>
      <div key={tab} className="animate-view-in">
        {tab === 'opps' ? <Opportunities go={setTab} /> : tab === 'campaigns' ? <Campaigns /> : tab === 'results' ? <Results /> : <Members />}
      </div>
    </div>
  );
}

// P-11
function Opportunities({ go }: { go: (t: Tab) => void }) {
  const ops = useMemo(() => opportunities(), []);
  const rising = ops[0];
  const holds = Array.from(new Set(ops.filter((o) => !o.check.ok).map((o) => o.name)));
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Strongest opportunity" value={`${rising.name}, ${rising.city}`} sub={`+${pct(rising.growth + rising.heatLift, 0)} (growth plus heatwave)`} tone="good" />
        <Stat label="Upcoming moment" value="Heatwave 10-24 Apr" sub="IMD outlook; cold products rise" tone="warn" />
        <Stat label="Held by supply check" value={holds.length ? holds.join(', ') : 'None'} sub="Promoting these would cause stockouts" tone={holds.length ? 'bad' : undefined} />
      </div>
      <div className="card mt-4 overflow-hidden">
        <table className="tbl w-full"><thead><tr><th>Product</th><th>City</th><th>Growth vs last year</th><th>Heatwave lift</th><th>Supply check (Apr to Jun)</th><th>Suggested channel</th></tr></thead>
          <tbody>{ops.map((o) => (
            <tr key={o.product + o.city}><td className="font-semibold">{o.name}</td><td>{o.city}</td>
              <td className="num text-good">+{pct(o.growth, 1)}</td><td className="num">{o.heatLift > 0.005 ? `+${pct(o.heatLift, 1)}` : '-'}</td>
              <td>{o.check.ok ? <Chip tone="good">Go</Chip> : <Chip tone="warn">Hold</Chip>}</td>
              <td className="text-xs text-muted">{CHANNEL_HINT[o.product]}</td></tr>
          ))}</tbody></table>
      </div>
      <Note>Growth and heatwave lift come from the demand forecast (all channels, weather, festivals). Liquid milk is not promoted: affordable supply is a commitment, not a campaign. Targeting stays at city or pin-code level (BR-35).</Note>
      <button className="btn-primary mt-4" onClick={() => go('campaigns')}>Review campaigns<IconChevron /></button>
    </div>
  );
}

// P-12
function Campaigns() {
  const s = useStore();
  const isMkt = s.plannerUser === 'marketer';
  return (
    <div className="space-y-4">
      {!isMkt ? <div className="rounded-xl border border-primary/30 bg-primary-light p-3 text-sm text-primary">Campaigns are approved by the marketing manager (BR-34). Switch user to <b>{NAMES.marketer}</b> at the top right.</div> : null}
      {CAMPAIGNS.map((c) => <CampaignCard key={c.id} c={c} isMkt={isMkt} />)}
    </div>
  );
}

function CampaignCard({ c, isMkt }: { c: Campaign; isMkt: boolean }) {
  const s = useStore();
  const p = useMemo(() => campaignPlan(c), [c]);
  const st = s.marketing.campaigns[c.id] ?? 'draft';
  const [why, setWhy] = useState('');
  const [over, setOver] = useState(false);
  const chip = st === 'approved' ? <Chip tone="good">Approved</Chip> : st === 'override' ? <Chip tone="bad">Approved over a hold</Chip> : st === 'held' ? <Chip tone="warn">Held</Chip> : <Chip>Draft</Chip>;
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2"><span className="text-lg font-bold">{c.title}</span>{chip}</div>
      <div className="mt-1 text-sm text-muted">{c.moment} | {c.cities.join(' and ')} | {fmtDate(c.from)} to {fmtDate(c.to)}</div>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
        <div><div className="label">Channels</div>{c.channels.join(', ')}</div>
        <div><div className="label">Budget</div>{inrShort(c.budget)}</div>
        <div><div className="label">Expected extra sales</div>+{pct(c.lift)} ({num(Math.round(p.extraUnits / 1000))}k {p.unit})</div>
        <div><div className="label">Extra value vs powder</div>{inrShort(p.value)} <span className="text-muted">(₹{p.perRupee.toFixed(1)} per ₹1)</span></div>
      </div>
      <div className={`mt-3 rounded-xl border p-3 text-sm ${p.check.ok ? 'border-good/30 bg-good-light' : 'border-marigold-deep/40 bg-warn-light'}`}>
        <div className={`font-bold ${p.check.ok ? 'text-good' : 'text-warn'}`}>Supply check: {p.check.ok ? 'go' : 'hold'}</div>
        <div>{p.check.reason}</div>
        {!p.check.ok && c.alt ? <div className="mt-1"><b>Suggestion:</b> {c.alt}</div> : null}
      </div>
      <div className="mt-2 text-xs text-muted">Control area: {c.control} (BR-38)</div>
      {st === 'override' ? <div className="mt-2 text-sm text-bad">Override reason: “{s.marketing.overrides[c.id]}”</div> : null}
      {st === 'draft' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {p.check.ok ? (
            <button className="btn-primary" disabled={!isMkt} onClick={() => { s.setCampaign(c.id, 'approved'); s.log(NAMES.marketer, `Approved campaign "${c.title}" (${inrShort(c.budget)}); supply check go`); }}>Approve campaign</button>
          ) : (
            <>
              <button className="btn-primary" disabled={!isMkt} onClick={() => { s.setCampaign(c.id, 'held'); s.log(NAMES.marketer, `Held campaign "${c.title}": ${p.check.reason}`); }}>Accept hold</button>
              <button className="btn-quiet" disabled={!isMkt} onClick={() => setOver(true)}>Override</button>
            </>
          )}
        </div>
      ) : null}
      {over && st === 'draft' ? (
        <div className="mt-3">
          <textarea className="input h-16" placeholder="Written reason required; the union planner is alerted (BR-34)" value={why} onChange={(e) => setWhy(e.target.value)} />
          <button className="btn-quiet mt-2" disabled={!why.trim()} onClick={() => { s.setCampaign(c.id, 'override', why); s.log(NAMES.marketer, `Overrode supply-check hold on "${c.title}": ${why}`); }}>Approve over the hold</button>
        </div>
      ) : null}
    </div>
  );
}

// P-13
function Results() {
  const s = useStore();
  const live = CAMPAIGNS.filter((c) => ['approved', 'override'].includes(s.marketing.campaigns[c.id] ?? ''));
  const held = CAMPAIGNS.filter((c) => s.marketing.campaigns[c.id] === 'held');
  if (!live.length) return <div className="rounded-sheet border border-dashed border-line p-10 text-center text-muted">No approved campaigns yet. Approve one under Campaigns.</div>;
  if (s.demoDate !== 'apr') return <div className="rounded-sheet border border-dashed border-line p-10 text-center text-muted">{live.length} campaign{live.length > 1 ? 's' : ''} approved. Results appear after launch: switch the demo date to 30 Apr.</div>;
  const rows = live.map((c) => ({ c, r: campaignResult(c) }));
  const spend = live.reduce((a, c) => a + c.budget, 0);
  const value = rows.reduce((a, x) => a + x.r.value, 0);
  const chart = rows.map(({ c, r }) => ({ name: c.title.split(':')[0], lift: +(r.lift * 100).toFixed(1), planned: +(c.lift * 100).toFixed(1) }));
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Campaigns live" value={String(live.length)} sub={held.length ? `${held.length} held by supply check` : undefined} />
        <Stat label="Spend to date" value={inrShort(spend)} />
        <Stat label="Extra value vs powder" value={inrShort(value)} tone="good" />
        <Stat label="Return" value={`₹${(value / spend).toFixed(1)} per ₹1`} tone={value > spend ? 'good' : 'bad'} sub="Target above ₹2" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="card p-4"><div className="font-bold">Sales lift vs control areas (%)</div>
          <div className="h-64"><ResponsiveContainer><BarChart data={chart} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} /><YAxis unit="%" tickLine={false} axisLine={false} fontSize={11} />
            <Tooltip cursor={{ fill: '#F3F5F9' }} formatter={(v: number) => `${v}%`} /><Legend iconType="circle" />
            <Bar isAnimationActive={false} dataKey="planned" name="Expected" fill={CHART.indigoSoft} radius={[6, 6, 0, 0]}><LabelList dataKey="planned" position="top" fontSize={11} formatter={(v: number) => `${v}%`} /></Bar>
            <Bar isAnimationActive={false} dataKey="lift" name="Measured" fill={CHART.indigo} radius={[6, 6, 0, 0]}><LabelList dataKey="lift" position="top" fontSize={11} formatter={(v: number) => `${v}%`} /></Bar>
          </BarChart></ResponsiveContainer></div>
          <Note>Lift is measured against matched control areas, not just last year (BR-38). Demo figures.</Note></div>
        <div className="card overflow-hidden">
          <table className="tbl w-full"><thead><tr><th>Campaign</th><th>Lift vs control</th><th>Return</th><th>Stockouts</th></tr></thead>
            <tbody>{rows.map(({ c, r }) => (
              <tr key={c.id}><td>{c.title}</td><td className="num font-bold text-good">+{pct(r.lift, 1)}</td><td className="num">₹{r.perRupee.toFixed(1)}</td><td className="num">{pct(r.stockout, 1)}</td></tr>
            ))}</tbody></table>
          <div className="p-3 text-sm">{held.length ? <>Held: {held.map((c) => c.title).join('; ')}. No ad money went behind products the plants could not supply.</> : null}</div>
          <div className="px-3 pb-3"><span className="inline-flex items-center gap-1 text-sm font-semibold text-good"><IconCheck size={16} />Lift added to the forecast for similar moments (FR-G4)</span></div>
        </div>
      </div>
    </div>
  );
}

// P-14
function Members() {
  const s = useStore();
  const shares = useMemo(() => milkStory(), []);
  const premium = s.incentive.status === 'published';
  const story = s.marketing.story;
  const langs: { id: Lang; name: string }[] = [{ id: 'gu', name: 'Gujarati' }, { id: 'hi', name: 'Hindi' }, { id: 'en', name: 'English' }];
  const sent = (id: string) => (id === 'buffalo' || id === 'noheard' ? (premium ? 1 : 0) : 0) + (story !== 'none' ? 1 : 0) + (id === 'lowsnf' ? 1 : 0);
  const user = NAMES[s.plannerUser];
  return (
    <div>
      <div className="card overflow-hidden">
        <table className="tbl w-full"><thead><tr><th>Segment</th><th>Rule</th><th>Members</th><th>Used for</th><th>Messages this week</th></tr></thead>
          <tbody>{SEGMENTS.filter((g) => g.id !== 'noheard' || premium).map((g) => {
            const n = sent(g.id);
            return <tr key={g.id}><td className="font-semibold">{g.name}</td><td className="text-xs text-muted">{g.rule}</td><td className="num">{num(g.count)}</td><td>{g.use}</td>
              <td>{n} of {WEEKLY_CAP} {n >= WEEKLY_CAP ? <Chip tone="warn">At cap</Chip> : null}</td></tr>;
          })}</tbody></table>
      </div>
      <Note>Segments decide who hears a message, never the price paid. The union sees counts only; societies see their own members. Farmer data is never used to market other companies&apos; products (BR-36, BR-37).</Note>

      <div className="mt-5 flex items-center gap-2"><h3 className="text-lg font-bold">Monthly milk story</h3>
        <Chip tone={story === 'published' ? 'good' : story === 'sent' ? 'primary' : 'neutral'}>{story === 'none' ? 'Not sent' : story === 'sent' ? 'Sent to societies' : 'Published by societies'}</Chip></div>
      <p className="text-sm text-muted">Tells every member where the society&apos;s milk goes this summer, from the recommended product mix for April. Audience: all members (counts towards the weekly cap).</p>
      <div className="card mt-3 p-4">
        <div className="flex h-6 overflow-hidden rounded-full">{shares.map((x) => <div key={x.id} title={`${STORY_PRODUCT.en[x.id]} ${x.share}%`} style={{ width: `${x.share}%`, background: PRODUCT_COLOR[x.id] }} />)}</div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">{[...shares].sort((a, b) => b.share - a.share).map((x) => <span key={x.id} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PRODUCT_COLOR[x.id] }} />{STORY_PRODUCT.en[x.id]} {x.share}</span>)}</div>
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        {langs.map((l) => {
          const msg = storyMessage(l.id, FARMER.society, shares);
          return (
            <div key={l.id} className="card p-4">
              <div className="flex items-center justify-between"><span className="font-semibold">{l.name}</span><PlayButton text={msg} lang={l.id} /></div>
              <p className="indic mt-2 text-sm">{msg}</p>
              <div className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-good"><IconCheck size={14} />Reviewed template, {STORY[l.id].label}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3">
        {story === 'none' ? <button className="btn-primary" onClick={() => { s.setMarketing({ story: 'sent' }); s.log(user, 'Sent the April milk story to 120 societies for publishing'); }}>Send to societies</button>
          : <span className="text-sm text-muted">{story === 'sent' ? 'Waiting for society secretaries to publish (SW6).' : 'Published. Members hear it in their society\'s name.'}</span>}
      </div>
    </div>
  );
}
