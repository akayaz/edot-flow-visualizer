// Re-export from the main OTLP route
// This handles requests to /v1/metrics (standard OTLP HTTP path)
export { POST, OPTIONS } from '@/app/api/otlp/v1/metrics/route';

// Need to define these inline for Next.js to recognize them
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
