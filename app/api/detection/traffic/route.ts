import { NextRequest, NextResponse } from 'next/server';
import { telemetryBuffer } from '@/lib/telemetry/processor';
import { analyzeTrafficSnapshot } from '@/app/otel-flow/lib/detection/traffic-analyzer';
import { layoutTopology } from '@/app/otel-flow/lib/detection/layout-engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/detection/traffic/start
 * Start traffic analysis session
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'start') {
      // Start analysis session
      telemetryBuffer.startAnalysis();

      return NextResponse.json({
        success: true,
        message: 'Traffic analysis started',
        timestamp: Date.now(),
      });
    }

    if (action === 'stop') {
      // Stop analysis and return snapshot
      const snapshot = telemetryBuffer.stopAnalysis();

      // Convert to serializable format
      const serializableSnapshot = {
        services: Array.from(snapshot.services.entries()).map(([key, value]) => ({
          key,
          ...value,
          telemetryTypes: Array.from(value.telemetryTypes),
        })),
        connections: Array.from(snapshot.connections.entries()).map(([key, value]) => ({
          key,
          ...value,
          telemetryTypes: Array.from(value.telemetryTypes),
        })),
        collectors: Array.from(snapshot.collectors.entries()).map(([key, value]) => ({
          key,
          ...value,
        })),
        startTime: snapshot.startTime,
        endTime: snapshot.endTime,
        totalEvents: snapshot.totalEvents,
      };

      // Analyze the traffic and generate topology
      const detectionResult = analyzeTrafficSnapshot(snapshot);

      // Apply layout to nodes
      const layoutResult = layoutTopology(detectionResult.nodes, detectionResult.edges, {
        direction: 'LR',
        nodeSpacing: { x: 150, y: 100 },
        layerSpacing: 200,
        groupByInfrastructure: true,
        fitView: true,
        animate: false,
      });

      return NextResponse.json({
        success: true,
        message: 'Traffic analysis complete',
        snapshot: serializableSnapshot,
        detection: {
          nodes: layoutResult.nodes,
          edges: layoutResult.edges,
          warnings: detectionResult.warnings,
          confidence: detectionResult.confidence,
          method: detectionResult.method,
          timestamp: detectionResult.timestamp,
        },
      });
    }

    if (action === 'analyze-existing') {
      // Analyze already-collected events without starting a session
      const snapshot = telemetryBuffer.analyzeExistingEvents();

      // Analyze the traffic and generate topology
      const detectionResult = analyzeTrafficSnapshot(snapshot);

      // Apply layout to nodes
      const layoutResult = layoutTopology(detectionResult.nodes, detectionResult.edges, {
        direction: 'LR',
        nodeSpacing: { x: 150, y: 100 },
        layerSpacing: 200,
        groupByInfrastructure: true,
        fitView: true,
        animate: false,
      });

      return NextResponse.json({
        success: true,
        message: 'Existing traffic analyzed',
        detection: {
          nodes: layoutResult.nodes,
          edges: layoutResult.edges,
          warnings: detectionResult.warnings,
          confidence: detectionResult.confidence,
          method: detectionResult.method,
          timestamp: detectionResult.timestamp,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use ?action=start, ?action=stop, or ?action=analyze-existing' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Traffic detection error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process traffic detection request' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/detection/traffic
 * Get current analysis status and progress
 */
export async function GET() {
  try {
    const progress = telemetryBuffer.getAnalysisProgress();

    return NextResponse.json({
      success: true,
      progress: {
        isActive: progress.isActive,
        elapsedTime: progress.duration,
        eventCount: progress.eventCount,
        serviceCount: progress.serviceCount,
        connectionCount: progress.connectionCount,
      },
    });
  } catch (error) {
    console.error('Traffic detection status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get traffic detection status' },
      { status: 500 }
    );
  }
}
