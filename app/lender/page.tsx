'use client';
import { ClientOnly } from '@/components/Providers';
import LenderApp from '@/components/LenderApp';

export default function Page() {
  return <ClientOnly><LenderApp /></ClientOnly>;
}
