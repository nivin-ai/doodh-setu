'use client';
import { ClientOnly } from '@/components/Providers';
import { DemoBar } from '@/components/ui';
import FarmerApp from '@/components/FarmerApp';

export default function Page() {
  return (
    <ClientOnly>
      <DemoBar />
      <FarmerApp />
    </ClientOnly>
  );
}
