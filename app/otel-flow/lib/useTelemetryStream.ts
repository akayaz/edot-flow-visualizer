'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTelemetryStore } from '../store/telemetryStore';
import { useFlowStore } from '../store/flowStore';
import type { TelemetryEvent, ThroughputStats } from '../types';

interface StreamMessage {
  type: 'connected' | 'telemetry' | 'throughput';
  events?: TelemetryEvent[];
  stats?: ThroughputStats[];
  timestamp?: number;
}

export function useTelemetryStream() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const { addEvents, updateThroughput, setConnected, isDemoMode } = useTelemetryStore();
  const { nodes } = useFlowStore();

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource('/api/telemetry/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[Telemetry] Stream connected');
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const message: StreamMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'connected':
            console.log('[Telemetry] Connection confirmed');
            break;
          case 'telemetry':
            if (message.events && message.events.length > 0) {
              addEvents(message.events);
            }
            if (message.stats) {
              updateThroughput(message.stats);
            }
            break;
          case 'throughput':
            if (message.stats) {
              updateThroughput(message.stats);
            }
            break;
        }
      } catch (error) {
        console.error('[Telemetry] Failed to parse message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[Telemetry] Stream error:', error);
      setConnected(false);
      
      // Attempt reconnection after 3 seconds
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          console.log('[Telemetry] Attempting reconnection...');
          connect();
        }
      }, 3000);
    };
  }, [addEvents, updateThroughput, setConnected]);

  // Disconnect from stream
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setConnected(false);
    }
  }, [setConnected]);

  // Start demo mode
  const startDemo = useCallback(async () => {
    try {
      const topology = {
        nodes: nodes.map((n) => ({ id: n.id, data: n.data })),
      };

      const response = await fetch('/api/telemetry/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', topology }),
      });

      if (!response.ok) {
        throw new Error('Failed to start demo');
      }

      console.log('[Telemetry] Demo mode started');
      useTelemetryStore.getState().setDemoMode(true);
    } catch (error) {
      console.error('[Telemetry] Failed to start demo:', error);
    }
  }, [nodes]);

  // Stop demo mode
  const stopDemo = useCallback(async () => {
    try {
      const response = await fetch('/api/telemetry/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });

      if (!response.ok) {
        throw new Error('Failed to stop demo');
      }

      console.log('[Telemetry] Demo mode stopped');
      useTelemetryStore.getState().setDemoMode(false);
      useTelemetryStore.getState().clearEvents();
    } catch (error) {
      console.error('[Telemetry] Failed to stop demo:', error);
    }
  }, []);

  // Toggle demo mode
  const toggleDemo = useCallback(async () => {
    if (isDemoMode) {
      await stopDemo();
    } else {
      await startDemo();
    }
  }, [isDemoMode, startDemo, stopDemo]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    connect,
    disconnect,
    startDemo,
    stopDemo,
    toggleDemo,
  };
}
