'use client';

import { memo } from 'react';
import {
  EuiPanel,
  EuiAccordion,
  EuiFlexGroup,
  EuiFlexItem,
  EuiText,
  EuiBadge,
  EuiIcon,
  EuiSpacer,
  EuiHorizontalRule,
} from '@elastic/eui';
import { useFlowStore } from '../../store/flowStore';

const telemetryItems = [
  { type: 'Traces', abbrev: 'T', color: '#f59e0b', description: 'Distributed tracing data' },
  { type: 'Metrics', abbrev: 'M', color: '#3b82f6', description: 'Application & infra metrics' },
  { type: 'Logs', abbrev: 'L', color: '#10b981', description: 'Log records' },
];

const protocolItems = [
  { protocol: 'gRPC', color: '#60a5fa', endpoint: ':4317' },
  { protocol: 'HTTP', color: '#34d399', endpoint: ':4318' },
];

export const Legend = memo((): React.ReactElement | null => {
  const { isPaletteOpen } = useFlowStore();

  if (isPaletteOpen) return null;

  return (
    <EuiPanel
      paddingSize="s"
      borderRadius="m"
      hasShadow
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        zIndex: 10,
        minWidth: 200,
      }}
    >
      <EuiAccordion
        id="legendAccordion"
        buttonContent={
          <EuiText size="xs" color="subdued">
            <strong>Data Flow Legend</strong>
          </EuiText>
        }
        initialIsOpen={false}
        paddingSize="none"
        extraAction={
          <div style={{ display: 'flex', gap: 6 }}>
            {telemetryItems.map((item) => (
              <div
                key={item.type}
                style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: item.color }}
              />
            ))}
          </div>
        }
      >
        <EuiSpacer size="s" />

        {/* Telemetry Types */}
        <EuiText size="xs" color="subdued">
          <p style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, fontSize: 10, marginBottom: 4 }}>
            Telemetry
          </p>
        </EuiText>
        {telemetryItems.map((item) => (
          <EuiFlexGroup key={item.type} alignItems="center" gutterSize="s" responsive={false} style={{ marginBottom: 4 }}>
            <EuiFlexItem grow={false}>
              <EuiIcon type="dot" color={item.color} size="s" />
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiBadge color="hollow" style={{ borderColor: item.color, color: item.color, fontSize: 9, padding: '0 4px' }}>
                {item.abbrev}
              </EuiBadge>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiText size="xs"><span>{item.type}</span></EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
        ))}

        <EuiHorizontalRule margin="xs" />

        {/* Protocols */}
        <EuiText size="xs" color="subdued">
          <p style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, fontSize: 10, marginBottom: 4 }}>
            Protocols
          </p>
        </EuiText>
        {protocolItems.map((item) => (
          <EuiFlexGroup key={item.protocol} alignItems="center" gutterSize="s" responsive={false} style={{ marginBottom: 4 }}>
            <EuiFlexItem grow={false}>
              <EuiBadge color="hollow" style={{ borderColor: item.color, color: item.color, fontSize: 9 }}>
                {item.protocol}
              </EuiBadge>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiText size="xs" color="subdued"><span>{item.endpoint}</span></EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
        ))}

        <EuiHorizontalRule margin="xs" />

        {/* Edge hints */}
        <EuiText size="xs" color="subdued">
          <p style={{ fontStyle: 'italic', fontSize: 10 }}>Hover over edges to see protocol details</p>
        </EuiText>
      </EuiAccordion>
    </EuiPanel>
  );
});

Legend.displayName = 'Legend';
