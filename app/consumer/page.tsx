'use client';
import { ClientOnly } from '@/components/Providers';
import ConsumerWallet from '@/components/dairyfin/ConsumerWallet';

export default function Page() {
  return <ClientOnly><ConsumerWallet /></ClientOnly>;
}
