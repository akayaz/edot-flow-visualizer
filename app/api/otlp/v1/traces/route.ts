import { NextRequest, NextResponse } from 'next/server';
import { telemetryBuffer, parseOTLPTraces } from '@/lib/telemetry/processor';
import { gunzipSync } from 'zlib';

// Import the protobuf root from otlp-transformer
// eslint-disable-next-line @typescript-eslint/no-var-requires
const protobufRoot = require('@opentelemetry/otlp-transformer/build/src/generated/root');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const userAgent = request.headers.get('user-agent') || '';
    console.log('[OTLP Traces] Received request with content-type:', contentType, 'user-agent:', userAgent);
    
    // Register collector if User-Agent indicates it's a collector
    try {
      if (userAgent && typeof telemetryBuffer.registerCollector === 'function') {
        telemetryBuffer.registerCollector(userAgent);
      }
    } catch (e) {
      console.log('[OTLP Traces] registerCollector not available, skipping');
    }
    
    let data: unknown;
    
    if (contentType.includes('application/json')) {
      // JSON format - parse directly
      data = await request.json();
    } else if (contentType.includes('application/x-protobuf') || contentType.includes('application/protobuf')) {
      // Protobuf format - decode using the OTel protobuf definitions
      try {
        const buffer = await request.arrayBuffer();
        let bytes = new Uint8Array(buffer);
        
        // Check if data is gzip compressed (gzip magic number: 0x1f 0x8b)
        const contentEncoding = request.headers.get('content-encoding') || '';
        if (contentEncoding.includes('gzip') || (bytes[0] === 0x1f && bytes[1] === 0x8b)) {
          console.log('[OTLP Traces] Decompressing gzip data');
          try {
            bytes = new Uint8Array(gunzipSync(Buffer.from(bytes)));
          } catch (gzipError) {
            console.error('[OTLP Traces] Failed to decompress gzip:', gzipError);
          }
        }
        
        // Decode using the protobuf schema
        const decoded = decodeOTLPTracesProtobuf(bytes);
        data = decoded;
        
        const serviceCount = decoded.resourceSpans?.length || 0;
        console.log('[OTLP Traces] Decoded protobuf with', serviceCount, 'resource spans');
      } catch (protoError) {
        console.error('[OTLP Traces] Failed to decode protobuf:', protoError);
        return NextResponse.json(
          { partialSuccess: { rejectedSpans: 0 } },
          { status: 200 }
        );
      }
    } else {
      // Try JSON as fallback
      try {
        data = await request.json();
      } catch {
        console.log('[OTLP Traces] Unknown content type, treating as empty');
        data = { resourceSpans: [] };
      }
    }

    const events = parseOTLPTraces(data);
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
    console.error('OTLP traces error:', error);
    return NextResponse.json(
      { error: 'Failed to process traces' },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
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
 * Decode OTLP traces protobuf using the official schema
 */
function decodeOTLPTracesProtobuf(bytes: Uint8Array): { 
  resourceSpans: Array<{ 
    resource?: { attributes: Array<{ key: string; value: { stringValue?: string } }> }; 
    scopeSpans: Array<{ spans: Array<{ traceId: string; spanId: string; name: string }> }> 
  }> 
} {
  try {
    // Get the ExportTraceServiceRequest type from the protobuf root
    const ExportTraceServiceRequest = protobufRoot?.opentelemetry?.proto?.collector?.trace?.v1?.ExportTraceServiceRequest;
    
    if (ExportTraceServiceRequest) {
      // Decode the protobuf message
      const decoded = ExportTraceServiceRequest.decode(bytes);
      const decodedObj = ExportTraceServiceRequest.toObject(decoded, {
        longs: String,
        enums: String,
        bytes: String,
      });
      
      console.log('[OTLP Traces] Successfully decoded protobuf using schema');
      
      // Extract service names for logging
      const serviceNames: string[] = [];
      if (decodedObj.resourceSpans) {
        for (const rs of decodedObj.resourceSpans) {
          if (rs.resource?.attributes) {
            for (const attr of rs.resource.attributes) {
              if (attr.key === 'service.name' && attr.value?.stringValue) {
                serviceNames.push(attr.value.stringValue);
              }
            }
          }
        }
      }
      console.log('[OTLP Traces] Services in protobuf:', serviceNames);
      
      return decodedObj;
    } else {
      console.log('[OTLP Traces] Protobuf schema not available, using fallback decoder');
      return fallbackDecodeProtobuf(bytes);
    }
  } catch (error) {
    console.error('[OTLP Traces] Schema decode failed, using fallback:', error);
    return fallbackDecodeProtobuf(bytes);
  }
}

/**
 * Fallback decoder that extracts service names using heuristics
 */
function fallbackDecodeProtobuf(bytes: Uint8Array): { 
  resourceSpans: Array<{ 
    resource?: { attributes: Array<{ key: string; value: { stringValue?: string } }> }; 
    scopeSpans: Array<{ spans: Array<{ traceId: string; spanId: string; name: string }> }> 
  }> 
} {
  const resourceSpans: Array<{
    resource?: { attributes: Array<{ key: string; value: { stringValue?: string } }> };
    scopeSpans: Array<{ spans: Array<{ traceId: string; spanId: string; name: string }> }>;
  }> = [];
  
  // Try to find readable service names in the binary data
  const serviceNames = extractReadableServiceNames(bytes);
  
  if (serviceNames.size > 0) {
    for (const serviceName of Array.from(serviceNames)) {
      resourceSpans.push({
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: serviceName } }
          ]
        },
        scopeSpans: [{
          spans: [{ traceId: 'proto-trace', spanId: 'proto-span', name: 'protobuf-span' }]
        }]
      });
    }
    console.log('[OTLP Traces] Fallback extracted services:', Array.from(serviceNames));
  } else {
    resourceSpans.push({
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'protobuf-service' } }
        ]
      },
      scopeSpans: [{
        spans: [{ traceId: 'proto-trace', spanId: 'proto-span', name: 'protobuf-span' }]
      }]
    });
    console.log('[OTLP Traces] Fallback: no service names found, using default');
  }
  
  return { resourceSpans };
}

/**
 * Extract readable service names from protobuf bytes
 * Looks for length-prefixed strings that match common service name patterns
 */
function extractReadableServiceNames(bytes: Uint8Array): Set<string> {
  const serviceNames = new Set<string>();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  
  // Scan through bytes looking for length-prefixed strings
  for (let i = 0; i < bytes.length - 4; i++) {
    const len = bytes[i];
    
    // Reasonable service name lengths
    if (len >= 5 && len <= 50 && i + 1 + len <= bytes.length) {
      try {
        const potentialName = decoder.decode(bytes.slice(i + 1, i + 1 + len));
        
        // Check if it looks like a valid service name
        if (/^[a-z][a-z0-9_-]*(-[a-z0-9]+)*$/.test(potentialName.toLowerCase())) {
          // Additional checks: must contain common service patterns or be kebab-case
          const lower = potentialName.toLowerCase();
          const isLikelyService = 
            lower.includes('service') ||
            lower.includes('api') ||
            lower.includes('frontend') ||
            lower.includes('backend') ||
            lower.includes('app') ||
            lower.includes('web') ||
            lower.includes('gateway') ||
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
