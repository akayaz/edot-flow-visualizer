import { NextRequest, NextResponse } from 'next/server';
import { demoGenerator, telemetryBuffer } from '@/lib/telemetry/processor';

// Store demo state (in production, use proper state management)
let isDemoActive = false;

export async function GET() {
  return NextResponse.json({
    isActive: isDemoActive,
    stats: telemetryBuffer.getThroughputStats(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, topology } = body;

    if (action === 'start') {
      if (!topology?.nodes) {
        return NextResponse.json(
          { error: 'Topology with nodes required to start demo' },
          { status: 400 }
        );
      }
      demoGenerator.start(topology);
      isDemoActive = true;
      return NextResponse.json({ status: 'started', isActive: true });
    } else if (action === 'stop') {
      demoGenerator.stop();
      isDemoActive = false;
      telemetryBuffer.resetCounters();
      return NextResponse.json({ status: 'stopped', isActive: false });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "start" or "stop"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Demo control error:', error);
    return NextResponse.json(
      { error: 'Failed to control demo mode' },
      { status: 500 }
    );
  }
}
