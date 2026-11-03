import type { Metadata, Viewport } from 'next';

// The farmer app can be added to a phone home screen and opens full screen, like an installed app.
export const metadata: Metadata = {
  title: 'Doodh Setu Farmer',
  manifest: '/farmer.webmanifest',
  appleWebApp: { capable: true, title: 'Doodh Setu', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/farmer-192.png', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = { themeColor: '#084785', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
