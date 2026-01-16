import type { Metadata } from 'next';
import { OtelFlowCanvas } from './components/OtelFlowCanvas';
// Initialize validation engine with all rules
import './lib/validators';

export const metadata: Metadata = {
  title: 'EDOT Flow Visualizer | Interactive OpenTelemetry Architecture',
  description: 'Visualize and design your Elastic Distribution of OpenTelemetry architecture with animated data flows',
};

export default function OtelFlowPage() {
  return (
    <main className="w-full h-screen overflow-hidden">
      <OtelFlowCanvas />
    </main>
  );
}
