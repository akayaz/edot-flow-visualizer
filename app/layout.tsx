import type { Metadata } from 'next';
import './globals.css';
import { EuiClientProvider } from './EuiClientProvider';

export const metadata: Metadata = {
  title: 'EDOT Flow Visualizer',
  description: 'Interactive visualization of Elastic Distribution of OpenTelemetry architecture patterns',
  keywords: ['OpenTelemetry', 'EDOT', 'Elastic', 'Observability', 'APM', 'Visualization'],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <EuiClientProvider>
          {children}
        </EuiClientProvider>
      </body>
    </html>
  );
}
