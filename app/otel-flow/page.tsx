import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamic import with SSR disabled to prevent HTMLElement reference errors
// from EUI components during static page generation
const OtelFlowCanvas = dynamic(
  () => import('./components/OtelFlowCanvas').then((mod) => mod.OtelFlowCanvas),
  { ssr: false }
);

// Initialize validation engine with all rules
import './lib/validators';

export const metadata: Metadata = {
  title: 'EDOT Flow Visualizer | Interactive OpenTelemetry Architecture',
  description: 'Visualize and design your Elastic Distribution of OpenTelemetry architecture with animated data flows',
};

export default function OtelFlowPage(): React.ReactElement {
  return (
    <main className="w-full h-screen overflow-hidden">
      <Suspense>
        <OtelFlowCanvas />
      </Suspense>
    </main>
  );
}
