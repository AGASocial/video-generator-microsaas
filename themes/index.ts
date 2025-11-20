/**
 * Theme System Entry Point
 * Export all theme-related utilities and configurations
 */

import { defaultTheme } from './default'

export { defaultTheme } from './default'
export { fontConfig, fontClasses } from './default/fonts'
export { cssClasses, classCombinations } from './default/constants'
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

  return `
:root {
${lightVars}
  --radius: ${theme.radius};
}

.dark {
${darkVars}
}
`
}

