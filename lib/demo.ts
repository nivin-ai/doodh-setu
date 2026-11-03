// Demo clock. The prototype runs on fixed dates so the story is repeatable.
export type DemoDateKey = 'mar' | 'apr';

export const DEMO_DATES: Record<DemoDateKey, { date: string; label: string; note: string }> = {
  mar: { date: '2027-03-20', label: '20 Mar 2027', note: 'Planning the lean season (forecast, product mix, incentive)' },
  apr: { date: '2027-04-30', label: '30 Apr 2027', note: 'After the first month of the premium (earnings, response)' },
};

export const PREMIUM_PERIOD = { from: '2027-04-01', to: '2027-06-30' };

export const FARMER = {
  name: 'Farmer',
  first: 'Farmer',
  memberId: '0412',
  society: 'Anand Milk Society',
  village: 'Bakrol, Anand district',
  phone: '+91 98250 40412',
  animals: { buffalo: 3, cow: 1 },
};

export const UNION = 'Kheda District Union (demo)';
