/**
 * Theme System Entry Point
 * Export all theme-related utilities and configurations
 */

export { defaultTheme } from './default'
export { fontConfig, fontClasses } from './fonts'
export { cssClasses, classCombinations } from './constants'
export type { ThemeConfig, ThemeColors, CSSClassConstants } from './types'

/**
 * Get CSS variables for a theme
 * This function generates CSS custom properties from a theme configuration
 */
export function getThemeCSSVariables(theme: typeof defaultTheme): string {
  const lightVars = Object.entries(theme.colors.light)
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
      return `  --${cssKey}: ${value};`
    })
    .join('\n')

  const darkVars = Object.entries(theme.colors.dark)
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
      return `  --${cssKey}: ${value};`
    })
    .join('\n')

  const fontSans = theme.fonts.sans.join(', ')
  const fontMono = theme.fonts.mono.join(', ')

  return `
:root {
${lightVars}
  --radius: ${theme.radius};
}

.dark {
${darkVars}
}

@theme inline {
  --font-sans: '${fontSans}';
  --font-mono: '${fontMono}';
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}
`
}

