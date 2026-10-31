'use client';
import { ClientOnly } from '@/components/Providers';
import PlannerApp from '@/components/PlannerApp';

export default function Page() {
  return <ClientOnly><PlannerApp /></ClientOnly>;
}
