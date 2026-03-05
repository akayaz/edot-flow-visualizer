import { NextRequest, NextResponse } from 'next/server';
import { telemetryBuffer, parseOTLPMetrics } from '@/lib/telemetry/processor';
import { gunzipSync } from 'zlib';

// Import the protobuf root from otlp-transformer
const protobufRoot = require('@opentelemetry/otlp-transformer/build/src/generated/root'); // eslint-disable-line

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const userAgent = request.headers.get('user-agent') || '';
    console.log('[OTLP Metrics] Received request with content-type:', contentType, 'user-agent:', userAgent);
    
    try {
      if (userAgent && typeof telemetryBuffer.registerCollector === 'function') {
        telemetryBuffer.registerCollector(userAgent);
      }
    } catch (e) {
      console.log('[OTLP Metrics] registerCollector not available, skipping');
    }
    
    let data: unknown;
    
    if (contentType.includes('application/json')) {
      data = await request.json();
    } else if (contentType.includes('application/x-protobuf') || contentType.includes('application/protobuf')) {
      try {
        const buffer = await request.arrayBuffer();
        let bytes = new Uint8Array(buffer);
        
        // Check if data is gzip compressed
        const contentEncoding = request.headers.get('content-encoding') || '';
        if (contentEncoding.includes('gzip') || (bytes[0] === 0x1f && bytes[1] === 0x8b)) {
          console.log('[OTLP Metrics] Decompressing gzip data');
          try {
            bytes = new Uint8Array(gunzipSync(Buffer.from(bytes)));
          } catch (gzipError) {
            console.error('[OTLP Metrics] Failed to decompress gzip:', gzipError);
          }
        }
        
        const decoded = decodeOTLPMetricsProtobuf(bytes);
        data = decoded;
        console.log('[OTLP Metrics] Decoded protobuf with', decoded.resourceMetrics?.length || 0, 'resource metrics');
      } catch (protoError) {
        console.error('[OTLP Metrics] Failed to decode protobuf:', protoError);
        return NextResponse.json(
          { partialSuccess: { rejectedDataPoints: 0 } },
          { status: 200 }
        );
      }
    } else {
      try {
        data = await request.json();
      } catch {
        console.log('[OTLP Metrics] Unknown content type, treating as empty');
        data = { resourceMetrics: [] };
      }
    }

    const events = parseOTLPMetrics(data);
    telemetryBuffer.addEvents(events);

    return NextResponse.json(
      { partialSuccess: {} },
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('OTLP metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to process metrics' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * Decode OTLP metrics protobuf using the official schema
 */
function decodeOTLPMetricsProtobuf(bytes: Uint8Array): { 
  resourceMetrics: Array<{ 
    resource?: { attributes: Array<{ key: string; value: { stringValue?: string } }> }; 
    scopeMetrics: Array<{ metrics: Array<{ name: string }> }> 
  }> 
} {
  try {
    const ExportMetricsServiceRequest = protobufRoot?.opentelemetry?.proto?.collector?.metrics?.v1?.ExportMetricsServiceRequest;
    
    if (ExportMetricsServiceRequest) {
      const decoded = ExportMetricsServiceRequest.decode(bytes);
      const decodedObj = ExportMetricsServiceRequest.toObject(decoded, {
        longs: String,
        enums: String,
        bytes: String,
      });
      
      console.log('[OTLP Metrics] Successfully decoded protobuf using schema');
      
      const serviceNames: string[] = [];
      if (decodedObj.resourceMetrics) {
        for (const rm of decodedObj.resourceMetrics) {
          if (rm.resource?.attributes) {
            for (const attr of rm.resource.attributes) {
              if (attr.key === 'service.name' && attr.value?.stringValue) {
                serviceNames.push(attr.value.stringValue);
              }
            }
          }
        }
      }
      console.log('[OTLP Metrics] Services in protobuf:', serviceNames);
      
      return decodedObj;
    } else {
      console.log('[OTLP Metrics] Protobuf schema not available, using fallback');
      return fallbackDecodeProtobuf(bytes);
    }
  } catch (error) {
    console.error('[OTLP Metrics] Schema decode failed, using fallback:', error);
    return fallbackDecodeProtobuf(bytes);
  }
}

function fallbackDecodeProtobuf(bytes: Uint8Array): { 
  resourceMetrics: Array<{ 
    resource?: { attributes: Array<{ key: string; value: { stringValue?: string } }> }; 
    scopeMetrics: Array<{ metrics: Array<{ name: string }> }> 
  }> 
} {
  const resourceMetrics: Array<{
    resource?: { attributes: Array<{ key: string; value: { stringValue?: string } }> };
    scopeMetrics: Array<{ metrics: Array<{ name: string }> }>;
  }> = [];
  
  const serviceNames = extractReadableServiceNames(bytes);
  
  if (serviceNames.size > 0) {
    for (const serviceName of Array.from(serviceNames)) {
      resourceMetrics.push({
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: serviceName } }
          ]
        },
        scopeMetrics: [{
          metrics: [{ name: 'protobuf_metric' }]
        }]
      });
    }
  } else {
    resourceMetrics.push({
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'protobuf-service' } }
        ]
      },
      scopeMetrics: [{
        metrics: [{ name: 'protobuf_metric' }]
      }]
    });
  }
  
  return { resourceMetrics };
}

function extractReadableServiceNames(bytes: Uint8Array): Set<string> {
  const serviceNames = new Set<string>();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  
  for (let i = 0; i < bytes.length - 4; i++) {
    const len = bytes[i];
    
    if (len >= 5 && len <= 50 && i + 1 + len <= bytes.length) {
      try {
        const potentialName = decoder.decode(bytes.slice(i + 1, i + 1 + len));
        
        if (/^[a-z][a-z0-9_-]*(-[a-z0-9]+)*$/.test(potentialName.toLowerCase())) {
          const lower = potentialName.toLowerCase();
          const isLikelyService = 
            lower.includes('service') ||
            lower.includes('api') ||
            lower.includes('frontend') ||
            lower.includes('backend') ||
            lower.includes('app') ||
            lower.includes('web') ||
            lower.includes('lumina') ||
            (lower.includes('-') && lower.length >= 8);
          
          if (isLikelyService) {
            serviceNames.add(potentialName);
          }
        }
      } catch {
        // Ignore decode errors
      }
    }
  }
  
  return serviceNames;
}
