'use client';

/**
 * EUI Icon Components
 * 
 * Centralized exports for Elastic UI icons used throughout the EDOT Flow Visualizer.
 * Uses the official @elastic/eui library for brand consistency.
 * 
 * @see https://eui.elastic.co/#/display/icons
 */

import { EuiIcon, type EuiIconProps } from '@elastic/eui';

// Re-export EuiIcon for direct usage
export { EuiIcon };

// Common icon types used in the visualizer
export type ObservabilityIconType = 
  | 'logoElastic'
  | 'logoObservability'
  | 'logoAPM'
  | 'logoLogging'
  | 'logoMetrics'
  | 'logoKubernetes'
  | 'logoDocker'
  | 'apmTrace'
  | 'node'
  | 'console';

// Pre-configured icon components for common use cases

interface IconProps {
  size?: EuiIconProps['size'];
  color?: EuiIconProps['color'];
  className?: string;
}

/**
 * Official Elastic Logo
 * Used in the ElasticNode component
 */
export const ElasticLogo = ({ size = 'l', color = 'ghost', className }: IconProps) => (
  <EuiIcon type="logoElastic" size={size} color={color} className={className} />
);

/**
 * Elastic Observability Logo
 * Used for observability platform branding
 */
export const ObservabilityLogo = ({ size = 'm', color, className }: IconProps) => (
  <EuiIcon type="logoObservability" size={size} color={color} className={className} />
);

/**
 * APM Feature Logo
 * Used for APM feature badges
 */
export const APMLogo = ({ size = 's', color, className }: IconProps) => (
  <EuiIcon type="logoAPM" size={size} color={color} className={className} />
);

/**
 * Logging Feature Logo
 * Used for Logs feature badges
 */
export const LoggingLogo = ({ size = 's', color, className }: IconProps) => (
  <EuiIcon type="logoLogging" size={size} color={color} className={className} />
);

/**
 * Metrics Feature Logo
 * Used for Metrics feature badges
 */
export const MetricsLogo = ({ size = 's', color, className }: IconProps) => (
  <EuiIcon type="logoMetrics" size={size} color={color} className={className} />
);

/**
 * Kubernetes Logo
 * Used for K8s infrastructure nodes
 */
export const KubernetesLogo = ({ size = 'm', color, className }: IconProps) => (
  <EuiIcon type="logoKubernetes" size={size} color={color} className={className} />
);

/**
 * Docker Logo
 * Used for Docker container nodes
 */
export const DockerLogo = ({ size = 'm', color, className }: IconProps) => (
  <EuiIcon type="logoDocker" size={size} color={color} className={className} />
);

/**
 * Feature type to EUI icon mapping
 * Used in ElasticNode for feature badges
 */
export const FEATURE_ICON_MAP: Record<string, string> = {
  apm: 'logoAPM',
  logs: 'logoLogging',
  metrics: 'logoMetrics',
  profiling: 'visBarVerticalStacked', // Closest available for profiling
};

/**
 * SDK language to EUI icon mapping
 * Note: Not all languages have dedicated EUI icons
 */
export const SDK_ICON_MAP: Record<string, string> = {
  nodejs: 'logoNodejs',
  java: 'logoJava', // Custom or fallback needed
  python: 'logoPython', // Custom or fallback needed
  go: 'logoGo', // Custom or fallback needed
  dotnet: 'logoDotnet', // Custom or fallback needed
};

