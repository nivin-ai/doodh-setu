import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Doodh Setu prototype',
  description: 'Demand-to-farmer intelligence platform for a dairy cooperative (student prototype, synthetic data).',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#084785' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Baloo+Bhai+2:wght@500;700;800&family=Baloo+Da+2:wght@700&family=Baloo+Tammudu+2:wght@700&family=Baloo+Thambi+2:wght@700&family=Baloo+Tamma+2:wght@700&family=Baloo+Chettan+2:wght@700&family=Baloo+Bhaina+2:wght@700&family=Mukta:wght@400;500;600;700&family=Mukta+Vaani:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;600;700&family=Noto+Sans+Telugu:wght@400;600;700&family=Noto+Sans+Tamil:wght@400;600;700&family=Noto+Sans+Kannada:wght@400;600;700&family=Noto+Sans+Malayalam:wght@400;600;700&family=Noto+Sans+Oriya:wght@400;600;700&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
