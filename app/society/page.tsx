'use client';
import { ClientOnly } from '@/components/Providers';
import SocietyApp from '@/components/SocietyApp';

export default function Page() {
  return <ClientOnly><SocietyApp /></ClientOnly>;
}
