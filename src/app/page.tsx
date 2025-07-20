'use client';

import dynamic from 'next/dynamic';

const EtherealAcousticsClient = dynamic(
  () => import('@/components/client/EtherealAcousticsClient'),
  { ssr: false, loading: () => <p className="text-white text-center p-8">Loading Sound Environment...</p> }
);

export default function Home() {
  return (
    <main className="min-h-screen w-full blueprint-grid">
      <EtherealAcousticsClient />
    </main>
  );
}
