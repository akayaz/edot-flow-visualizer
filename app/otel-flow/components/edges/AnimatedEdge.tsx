'use client';

import { memo, useMemo, useState } from 'react';
import { BaseEdge, getBezierPath, Position } from '@xyflow/react';
import { useEuiTheme } from '@elastic/eui';
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
 * Uses a shared keyframe name per edge (not per particle) to reduce
 * injected <style> tags. Particles differentiate via animation-delay.
 */
const Particle = memo(({ path, color, delay, duration, size = 4, animationId }: ParticleProps) => {
  return (
    <circle
      r={size}
      fill={color}
      filter="url(#particle-glow)"
      style={{
        offsetPath: `path("${path}")`,
        animation: `particle-move-${animationId} ${duration}s linear ${delay}s infinite`,
      }}
    />
  );
});

Particle.displayName = 'Particle';

interface TelemetryPillProps {
  types: TelemetryType[];
  x: number;
  y: number;
}

/**
 * Compact telemetry pill showing colored segments for active telemetry types.
 * Replaces 3 separate circle badges with a single pill.
 */
const TelemetryPill = memo(({ types, x, y }: TelemetryPillProps) => {
  if (types.length === 0) return null;

  const segmentWidth = 14;
  const pillHeight = 14;
  const totalWidth = types.length * segmentWidth;
  const pillX = x - totalWidth / 2;
  const pillY = y - pillHeight / 2;
  const radius = 4;

  return (
    <g>
      {/* Pill background */}
      <rect
        x={pillX - 2}
        y={pillY - 1}
        width={totalWidth + 4}
        height={pillHeight + 2}
        rx={radius + 1}
        fill="var(--rf-node-bg, #1a1a2e)"
        opacity={0.9}
      />
      {/* Colored segments */}
      {types.map((type, i) => {
        const segX = pillX + i * segmentWidth;
        return (
          <g key={type}>
            <rect
              x={segX}
              y={pillY}
              width={segmentWidth}
              height={pillHeight}
              rx={i === 0 ? radius : i === types.length - 1 ? radius : 0}
              fill={TELEMETRY_COLORS[type]}
              opacity={0.85}
            />
            <text
              x={segX + segmentWidth / 2}
              y={pillY + pillHeight / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="8"
              fontWeight="bold"
              fill="#fff"
              style={{ fontFamily: 'ui-monospace, monospace' }}
            >
              {TELEMETRY_LABELS[type]}
            </text>
          </g>
        );
      })}
    </g>
  );
});

TelemetryPill.displayName = 'TelemetryPill';

interface ProtocolIndicatorProps {
  protocol: 'otlp-grpc' | 'otlp-http' | 'kafka';
  x: number;
  y: number;
  visible: boolean;
}

/**
 * Protocol indicator shown on hover
 */
const ProtocolIndicator = memo(({ protocol, x, y, visible }: ProtocolIndicatorProps) => {
  if (!visible) return null;
  
  const label = protocol === 'otlp-grpc' ? 'gRPC' : protocol === 'kafka' ? 'Kafka' : 'HTTP';
  const bgColor = 'var(--rf-node-bg)';
  const textColor = protocol === 'otlp-grpc' ? '#60a5fa' : protocol === 'kafka' ? '#7B42BC' : '#34d399';
  
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
  const { euiTheme } = useEuiTheme();

  // Use EUI theme tokens for edge base colors (adapts to light/dark)
  const edgeBaseColor = euiTheme.colors.mediumShade;
  const edgeLightColor = euiTheme.colors.lightShade;

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

  // Generate particles — capped at 2 per telemetry type (6 max per edge).
  // Speed and size modulated by throughput instead of spawning more particles.
  const particles = useMemo(() => {
    if (!data?.animated || !isAnimating) return [];

    const result: Omit<ParticleProps, 'animationId'>[] = [];
    const MAX_PER_TYPE = 2;

    // For kafka protocol edges, use purple-tinted particle colors
    const isKafkaProtocol = data.protocol === 'kafka';
    const KAFKA_TELEMETRY_COLORS: Record<TelemetryType, string> = {
      traces: '#9B6FD6',
      metrics: '#7B5FCC',
      logs: '#8B62C6',
    };

    data.telemetryTypes.forEach((type, typeIndex) => {
      let particleSize = 4;
      let duration = 2; // seconds

      if (isDemoMode && liveThroughput) {
        const typeRate = liveThroughput[type] || 0;
        // Modulate size and speed instead of count
        particleSize = typeRate > 10 ? 6 : typeRate > 5 ? 5 : 3;
        duration = typeRate > 10 ? 1.2 : typeRate > 5 ? 1.6 : 2.5;
      }

      for (let i = 0; i < MAX_PER_TYPE; i++) {
        result.push({
          path: edgePath,
          color: isKafkaProtocol ? KAFKA_TELEMETRY_COLORS[type] : TELEMETRY_COLORS[type],
          delay: (typeIndex * 0.4) + (i * (duration / MAX_PER_TYPE)),
          duration,
          size: particleSize,
        });
      }
    });

    return result;
  }, [edgePath, data?.telemetryTypes, data?.animated, data?.protocol, isAnimating, isDemoMode, liveThroughput]);

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
      {/* Shared keyframe for all particles on this edge */}
      <style>
        {`@keyframes particle-move-${id} { 0% { offset-distance: 0%; } 100% { offset-distance: 100%; } }`}
      </style>

      {/* SVG Defs for glow filter */}
      <defs>
        <filter id="particle-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Gradient for the edge line */}
        <linearGradient id={`edge-gradient-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={hasWarning ? WARNING_COLOR : protocol === 'kafka' ? '#7B42BC' : edgeBaseColor} stopOpacity={0.5 + glowIntensity * 0.5} />
          <stop offset="50%" stopColor={hasWarning ? WARNING_COLOR : protocol === 'kafka' ? '#9B62DC' : edgeLightColor} stopOpacity={0.6 + glowIntensity * 0.4} />
          <stop offset="100%" stopColor={hasWarning ? WARNING_COLOR : protocol === 'kafka' ? '#7B42BC' : edgeBaseColor} stopOpacity={0.5 + glowIntensity * 0.5} />
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

      {/* Compact telemetry pill */}
      {telemetryTypes.length > 0 && !hasWarning && (
        <TelemetryPill
          types={telemetryTypes}
          x={midX}
          y={midY - 16}
        />
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
            fill="var(--rf-node-bg, #ffffff)"
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

      {/* Animated particles (shared keyframe per edge) */}
      {particles.map((particle, index) => (
        <Particle
          key={`${id}-particle-${index}`}
          {...particle}
          animationId={id}
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
