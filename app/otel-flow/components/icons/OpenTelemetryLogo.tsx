'use client';

import { memo } from 'react';
import Image from 'next/image';

interface OpenTelemetryLogoProps {
  size?: number;
  className?: string;
}

/**
 * OpenTelemetry Official Logo
 * Using the official CNCF artwork from https://github.com/cncf/artwork
 */
export const OpenTelemetryLogo = memo(({ size = 24, className = '' }: OpenTelemetryLogoProps) => (
  <Image
    src="/opentelemetry-logo.svg"
    alt="OpenTelemetry"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size }}
  />
));

OpenTelemetryLogo.displayName = 'OpenTelemetryLogo';

/**
 * Simplified OpenTelemetry icon - same as main logo but for smaller contexts
 */
export const OpenTelemetryIcon = memo(({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <Image
    src="/opentelemetry-logo.svg"
    alt="OpenTelemetry"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size }}
  />
));

OpenTelemetryIcon.displayName = 'OpenTelemetryIcon';

