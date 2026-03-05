import { NextRequest, NextResponse } from 'next/server';
import { telemetryBuffer, parseOTLPLogs } from '@/lib/telemetry/processor';
import { gunzipSync } from 'zlib';

// Import the protobuf root from otlp-transformer
const protobufRoot = require('@opentelemetry/otlp-transformer/build/src/generated/root'); // eslint-disable-line

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const userAgent = request.headers.get('user-agent') || '';
    console.log('[OTLP Logs] Received request with content-type:', contentType, 'user-agent:', userAgent);
    
    // Register collector if User-Agent indicates it's a collector
    try {
      if (userAgent && typeof telemetryBuffer.registerCollector === 'function') {
        telemetryBuffer.registerCollector(userAgent);
      }
    } catch (e) {
      console.log('[OTLP Logs] registerCollector not available, skipping');
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
          console.log('[OTLP Logs] Decompressing gzip data');
          try {
            bytes = new Uint8Array(gunzipSync(Buffer.from(bytes)));
          } catch (gzipError) {
            console.error('[OTLP Logs] Failed to decompress gzip:', gzipError);
          }
        }
        
        const decoded = decodeOTLPLogsProtobuf(bytes);
        data = decoded;
        console.log('[OTLP Logs] Decoded protobuf data with', decoded.resourceLogs?.length || 0, 'resource logs');
      } catch (protoError) {
        console.error('[OTLP Logs] Failed to decode protobuf:', protoError);
        return NextResponse.json(
          { partialSuccess: { rejectedLogRecords: 0 } },
          { status: 200 }
        );
      }
    } else {
      try {
        data = await request.json();
      } catch {
        console.log('[OTLP Logs] Unknown content type, treating as empty');
        data = { resourceLogs: [] };
      }
    }

    const events = parseOTLPLogs(data);
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
    console.error('OTLP logs error:', error);
    return NextResponse.json(
      { error: 'Failed to process logs' },
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
 * Decode OTLP logs protobuf using the official schema
 */
function decodeOTLPLogsProtobuf(bytes: Uint8Array): { 
  resourceLogs: Array<{ 
    resource?: { attributes: Array<{ key: string; value: { stringValue?: string } }> }; 
    scopeLogs: Array<{ logRecords: Array<{ severityText?: string }> }> 
  }> 
} {
  try {
    const ExportLogsServiceRequest = protobufRoot?.opentelemetry?.proto?.collector?.logs?.v1?.ExportLogsServiceRequest;
    
    if (ExportLogsServiceRequest) {
      const decoded = ExportLogsServiceRequest.decode(bytes);
      const decodedObj = ExportLogsServiceRequest.toObject(decoded, {
        longs: String,
        enums: String,
        bytes: String,
      });
      
      console.log('[OTLP Logs] Successfully decoded protobuf using schema');
      
      const serviceNames: string[] = [];
      if (decodedObj.resourceLogs) {
        for (const rl of decodedObj.resourceLogs) {
          if (rl.resource?.attributes) {
            for (const attr of rl.resource.attributes) {
              if (attr.key === 'service.name' && attr.value?.stringValue) {
                serviceNames.push(attr.value.stringValue);
              }
            }
          }
        }
      }
      console.log('[OTLP Logs] Services in protobuf:', serviceNames);
      
      return decodedObj;
    } else {
      console.log('[OTLP Logs] Protobuf schema not available, using fallback');
      return fallbackDecodeProtobuf(bytes);
    }
  } catch (error) {
    console.error('[OTLP Logs] Schema decode failed, using fallback:', error);
    return fallbackDecodeProtobuf(bytes);
  }
}

function fallbackDecodeProtobuf(bytes: Uint8Array): { 
  resourceLogs: Array<{ 
    resource?: { attributes: Array<{ key: string; value: { stringValue?: string } }> }; 
    scopeLogs: Array<{ logRecords: Array<{ severityText?: string }> }> 
  }> 
} {
  const resourceLogs: Array<{
    resource?: { attributes: Array<{ key: string; value: { stringValue?: string } }> };
    scopeLogs: Array<{ logRecords: Array<{ severityText?: string }> }>;
  }> = [];
  
  const serviceNames = extractReadableServiceNames(bytes);
  
  if (serviceNames.size > 0) {
    for (const serviceName of Array.from(serviceNames)) {
      resourceLogs.push({
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: serviceName } }
          ]
        },
        scopeLogs: [{
          logRecords: [{ severityText: 'INFO' }]
        }]
      });
    }
  } else {
    resourceLogs.push({
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'protobuf-service' } }
        ]
      },
      scopeLogs: [{
        logRecords: [{ severityText: 'INFO' }]
      }]
    });
  }
  
  return { resourceLogs };
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
