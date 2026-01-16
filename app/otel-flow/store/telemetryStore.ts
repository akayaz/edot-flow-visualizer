import { create } from 'zustand';
import type { TelemetryEvent, ThroughputStats } from '../types';

interface TelemetryStore {
  // State
  recentEvents: TelemetryEvent[];
  maxEvents: number;
  throughputStats: Map<string, ThroughputStats>;
  isConnected: boolean;
  isDemoMode: boolean;
  lastEventTime: number | null;

  // Actions
  addEvents: (events: TelemetryEvent[]) => void;
  updateThroughput: (stats: ThroughputStats[]) => void;
  setConnected: (connected: boolean) => void;
  setDemoMode: (enabled: boolean) => void;
  clearEvents: () => void;

  // Selectors
  getEventsForEdge: (sourceId: string, targetId: string) => TelemetryEvent[];
  getThroughputForComponent: (componentId: string) => ThroughputStats | undefined;
}

export const useTelemetryStore = create<TelemetryStore>((set, get) => ({
  // Initial state
  recentEvents: [],
  maxEvents: 500,
  throughputStats: new Map(),
  isConnected: false,
  isDemoMode: false,
  lastEventTime: null,

  // Add new telemetry events (maintains circular buffer)
  addEvents: (events) => {
    set((state) => {
      const combined = [...state.recentEvents, ...events];
      const trimmed = combined.slice(-state.maxEvents);
      return {
        recentEvents: trimmed,
        lastEventTime: Date.now(),
      };
    });
  },

  // Update throughput statistics
  updateThroughput: (stats) => {
    set((state) => {
      const newMap = new Map(state.throughputStats);
      stats.forEach((stat) => {
        newMap.set(stat.componentId, stat);
      });
      return { throughputStats: newMap };
    });
  },

  // Set connection status
  setConnected: (connected) => set({ isConnected: connected }),

  // Toggle demo mode
  setDemoMode: (enabled) => set({ isDemoMode: enabled }),

  // Clear all events
  clearEvents: () =>
    set({
      recentEvents: [],
      throughputStats: new Map(),
      lastEventTime: null,
    }),

  // Get events flowing between two components
  getEventsForEdge: (sourceId, targetId) => {
    return get().recentEvents.filter(
      (e) => e.sourceComponent === sourceId && e.targetComponent === targetId
    );
  },

  // Get throughput stats for a specific component
  getThroughputForComponent: (componentId) => {
    return get().throughputStats.get(componentId);
  },
}));
