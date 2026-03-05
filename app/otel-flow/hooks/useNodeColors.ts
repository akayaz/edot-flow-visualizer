import { useEuiTheme } from '@elastic/eui';

/**
 * Provides EUI-aware colors for React Flow node components.
 *
 * These map to `euiTheme.colors.text*` tokens which are guaranteed
 * to meet WCAG contrast requirements on both light and dark backgrounds.
 * Purple has no EUI text token yet, so we use Borealis primitives directly.
 */
export function useNodeColors() {
  const { euiTheme, colorMode } = useEuiTheme();
  const isDark = colorMode === 'DARK';

  return {
    success: euiTheme.colors.textSuccess,
    primary: euiTheme.colors.textPrimary,
    warning: euiTheme.colors.textWarning,
    accentSecondary: euiTheme.colors.textAccentSecondary,
    accent: euiTheme.colors.textAccent,
    purple: isDark ? '#B084F5' : '#6B3C9F',
    subdued: euiTheme.colors.textSubdued,
  };
}
