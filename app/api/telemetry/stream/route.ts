import { telemetryBuffer } from '@/lib/telemetry/processor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const encoder = new TextEncoder();
  let isClosed = false;
  let statsInterval: NodeJS.Timeout | null = null;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`)
        );
      } catch (error) {
        console.error('SSE initial send error:', error);
        return;
      }

      // Subscribe to telemetry events
      unsubscribe = telemetryBuffer.subscribe((events) => {
        if (isClosed) return;
        try {
          const message = JSON.stringify({
            type: 'telemetry',
            events,
            stats: telemetryBuffer.getThroughputStats(),
          });
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch (error) {
          // Controller likely closed, mark as closed
          isClosed = true;
        }
      });

      // Send throughput stats every second
      statsInterval = setInterval(() => {
        if (isClosed) {
          if (statsInterval) clearInterval(statsInterval);
          return;
        }
        try {
          const message = JSON.stringify({
            type: 'throughput',
            stats: telemetryBuffer.getThroughputStats(),
          });
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch (error) {
          // Controller likely closed, cleanup
          isClosed = true;
          if (statsInterval) clearInterval(statsInterval);
        }
      }, 1000);
    },

    cancel() {
      // Called when client disconnects
      isClosed = true;
      if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
      }
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
