/**
 * Type declarations for EUI icon deep imports used in icon-cache.ts
 * These modules export React components but don't ship their own .d.ts files.
 */

declare module '@elastic/eui/es/components/icon/icon' {
  export function appendIconComponentCache(
    iconTypeToIconComponentMap: Record<string, React.ComponentType>
  ): void;
}

declare module '@elastic/eui/es/components/icon/assets/*' {
  import { ComponentType } from 'react';
  export const icon: ComponentType;
}
