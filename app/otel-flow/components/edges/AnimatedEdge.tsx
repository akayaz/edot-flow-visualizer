'use client';

import { memo, useMemo, useState } from 'react';
import { BaseEdge, getBezierPath, Position } from '@xyflow/react';
import { useFlowStore } from '../../store/flowStore';
import { useTelemetryStore } from '../../store/telemetryStore';
import type { FlowEdgeData, TelemetryType } from '../../types';

const TELEMETRY_COLORS: Record<TelemetryType, string> = {
  traces: '#f59e0b',   // Amber
  metrics: '#3b82f6',  // Blue
  logs: '#10b981',     // Emerald
};

const TELEMETRY_LABELS: Record<TelemetryType, string> = {
  traces: 'T',
  metrics: 'M',
  logs: 'L',
};

// Warning edge color (amber/yellow)
const WARNING_COLOR = '#f59e0b';

interface ParticleProps {
  path: string;
  color: string;
  delay: number;
  duration: number;
  size?: number;
  animationId: string;
}

/**
 * Particle component that animates along a path using CSS offset-path.
 * Uses native CSS animations instead of Framer Motion to avoid React warnings
 * about unrecognized offsetDistance prop on DOM elements.
 */
const Particle = memo(({ path, color, delay, duration, size = 4, animationId }: ParticleProps) => {
  const animationName = `particle-move-${animationId}`;
  
  return (
    <>
      <style>
        {`
          @keyframes ${animationName} {
            0% { offset-distance: 0%; }
            100% { offset-distance: 100%; }
          }
        `}
      </style>
      <circle
        r={size}
        fill={color}
        filter="url(#particle-glow)"
        style={{
          offsetPath: `path("${path}")`,
          animation: `${animationName} ${duration}s linear ${delay}s infinite`,
        }}
      />
    </>
  );
});

Particle.displayName = 'Particle';

interface TelemetryBadgeProps {
  type: TelemetryType;
  x: number;
  y: number;
  index: number;
}

/**
 * Telemetry type badge (T/M/L) displayed on edges
 */
const TelemetryBadge = memo(({ type, x, y, index }: TelemetryBadgeProps) => {
  const color = TELEMETRY_COLORS[type];
  const label = TELEMETRY_LABELS[type];
  const offsetX = (index - 1) * 18; // Space badges horizontally
  
  return (
    <g transform={`translate(${x + offsetX}, ${y})`}>
      <circle
        r={8}
        fill="#1f2937"
        stroke={color}
        strokeWidth={1.5}
        filter="url(#badge-glow)"
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="9"
        fontWeight="bold"
        fill={color}
        style={{ fontFamily: 'ui-monospace, monospace' }}
      >
        {label}
      </text>
    </g>
  );
});

TelemetryBadge.displayName = 'TelemetryBadge';

interface ProtocolIndicatorProps {
  protocol: 'otlp-grpc' | 'otlp-http';
  x: number;
  y: number;
  visible: boolean;
}

/**
 * Protocol indicator shown on hover
 */
const ProtocolIndicator = memo(({ protocol, x, y, visible }: ProtocolIndicatorProps) => {
  if (!visible) return null;
  
  const label = protocol === 'otlp-grpc' ? 'gRPC' : 'HTTP';
  const bgColor = protocol === 'otlp-grpc' ? '#1e3a5f' : '#1e3a3f';
  const textColor = protocol === 'otlp-grpc' ? '#60a5fa' : '#34d399';
  
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x={-22}
        y={-10}
        width={44}
        height={20}
        rx={4}
        fill={bgColor}
        stroke={textColor}
        strokeWidth={1}
        opacity={0.95}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="10"
        fontWeight="600"
        fill={textColor}
        style={{ fontFamily: 'ui-monospace, monospace' }}
      >
        {label}
      </text>
    </g>
  );
});

ProtocolIndicator.displayName = 'ProtocolIndicator';

interface AnimatedEdgeProps {
  id: string;
  source: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  style?: React.CSSProperties;
  markerEnd?: string;
  data?: FlowEdgeData;
}

export const AnimatedEdge = memo(({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: AnimatedEdgeProps) => {
  const isAnimating = useFlowStore((state) => state.isAnimating);
  const { throughputStats, isDemoMode } = useTelemetryStore();
  const [isHovered, setIsHovered] = useState(false);

  // Get live throughput for source component
  const liveThroughput = throughputStats.get(source);

  // Generate the bezier path
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Calculate midpoint for badges and labels
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  // Generate particles based on telemetry types and volume
  const particles = useMemo(() => {
    if (!data?.animated || !isAnimating) return [];

    const result: Omit<ParticleProps, 'animationId'>[] = [];
    
    // Use live throughput if demo mode is active, otherwise use static volume
    const baseVolume = data.volume || 5;
    const baseDuration = 2; // seconds

    data.telemetryTypes.forEach((type, typeIndex) => {
      // Calculate particle count based on live data or static config
      let particleCount: number;
      let particleSize = 4;
      
      if (isDemoMode && liveThroughput) {
        // Dynamic particle count based on live throughput
        const typeRate = liveThroughput[type] || 0;
        particleCount = Math.min(Math.max(Math.ceil(typeRate / 5), 1), 8);
        // Larger particles for higher throughput
        particleSize = typeRate > 10 ? 5 : typeRate > 5 ? 4 : 3;
      } else {
        // Static particle count
        particleCount = Math.ceil(baseVolume / 2);
      }
      
      for (let i = 0; i < particleCount; i++) {
        result.push({
          path: edgePath,
          color: TELEMETRY_COLORS[type],
          delay: (typeIndex * 0.3) + (i * (baseDuration / particleCount)),
          duration: baseDuration,
          size: particleSize,
        });
      }
    });

    return result;
  }, [edgePath, data?.telemetryTypes, data?.volume, data?.animated, isAnimating, isDemoMode, liveThroughput]);

  // Edge glow intensity based on activity
  const glowIntensity = isDemoMode && liveThroughput 
    ? Math.min((liveThroughput.traces + liveThroughput.metrics + liveThroughput.logs) / 20, 1)
    : 0.3;

  // Check if this edge has a warning
  const hasWarning = Boolean(data?.warning);
  const warningMessage = data?.warning;

  // Get telemetry types for badges
  const telemetryTypes = data?.telemetryTypes || [];

  // Get protocol
  const protocol = data?.protocol || 'otlp-grpc';

  return (
    <>
      {/* SVG Defs for glow filter */}
      <defs>
        <filter id="particle-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        
        {/* Badge glow filter */}
        <filter id="badge-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1.5" result="badgeBlur" />
          <feMerge>
            <feMergeNode in="badgeBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        
        {/* Gradient for the edge line */}
        <linearGradient id={`edge-gradient-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={hasWarning ? WARNING_COLOR : "#4b5563"} stopOpacity={0.5 + glowIntensity * 0.5} />
          <stop offset="50%" stopColor={hasWarning ? WARNING_COLOR : "#6b7280"} stopOpacity={0.6 + glowIntensity * 0.4} />
          <stop offset="100%" stopColor={hasWarning ? WARNING_COLOR : "#4b5563"} stopOpacity={0.5 + glowIntensity * 0.5} />
        </linearGradient>
        
        {/* Warning glow filter */}
        {hasWarning && (
          <filter id={`warning-glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="warningBlur" />
            <feFlood floodColor={WARNING_COLOR} floodOpacity="0.5" result="warningColor" />
            <feComposite in="warningColor" in2="warningBlur" operator="in" result="warningGlow" />
            <feMerge>
              <feMergeNode in="warningGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* Base edge line */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: `url(#edge-gradient-${id})`,
          strokeWidth: hasWarning ? 3 : 2 + glowIntensity,
          strokeOpacity: hasWarning ? 0.9 : 0.6 + glowIntensity * 0.3,
          strokeDasharray: hasWarning ? '8 4' : undefined,
          filter: hasWarning ? `url(#warning-glow-${id})` : undefined,
        }}
      />

      {/* Active edge shimmer effect when demo mode is running */}
      {isDemoMode && liveThroughput && !hasWarning && (
        <path
          d={edgePath}
          fill="none"
          stroke={`url(#edge-gradient-${id})`}
          strokeWidth={1}
          strokeOpacity={0.4}
          strokeDasharray="10 10"
          className="edge-active"
        />
      )}

      {/* Telemetry type badges */}
      {telemetryTypes.length > 0 && !hasWarning && (
        <g transform={`translate(0, -20)`}>
          {telemetryTypes.map((type, index) => (
            <TelemetryBadge
              key={`${id}-badge-${type}`}
              type={type}
              x={midX}
              y={midY}
              index={index}
            />
          ))}
        </g>
      )}

      {/* Protocol indicator on hover */}
      <ProtocolIndicator
        protocol={protocol}
        x={midX}
        y={midY + 20}
        visible={isHovered && !hasWarning}
      />
      
      {/* Warning indicator tooltip area */}
      {hasWarning && (
        <g>
          {/* Warning icon at midpoint of edge */}
          <circle
            cx={midX}
            cy={midY}
            r={10}
            fill="#1f2937"
            stroke={WARNING_COLOR}
            strokeWidth={2}
          />
          <text
            x={midX}
            y={midY}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="12"
            fill={WARNING_COLOR}
            fontWeight="bold"
          >
            !
          </text>
          {/* Tooltip */}
          <title>{warningMessage}</title>
        </g>
      )}

      {/* Animated particles */}
      {particles.map((particle, index) => (
        <Particle 
          key={`${id}-particle-${index}`} 
          {...particle} 
          animationId={`${id}-${index}`}
        />
      ))}

      {/* Edge hover highlight - invisible hit area for hover detection */}
      <BaseEdge
        path={edgePath}
        style={{
          stroke: 'transparent',
          strokeWidth: 20,
          cursor: 'pointer',
        }}
      />
      
      {/* Hover detection overlay */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={30}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
    </>
  );
});

AnimatedEdge.displayName = 'AnimatedEdge';
