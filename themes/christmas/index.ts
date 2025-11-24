/**
 * Christmas Theme Configuration
 * A festive theme with red, green, and gold colors
 * Includes warm, cozy colors perfect for the holiday season
 */

import type { ThemeConfig } from '../types'
import { fontConfig } from './fonts'
import { ChristmasSnowEffect } from '@/components/christmas-snow-effect'
import type React from 'react'

const christmasTheme: ThemeConfig = {
  name: 'christmas',
  fonts: {
    sans: [...fontConfig.sans.family],
    mono: [...fontConfig.mono.family],
  },
  radius: '0.625rem',
  colors: {
    light: {
      // Warm, cozy backgrounds with subtle red/green tints
      background: 'oklch(0.98 0.02 140)', // Very light green tint
      foreground: 'oklch(0.15 0.05 20)', // Deep red-brown text
      card: 'oklch(1 0 0)', // Pure white cards
      cardForeground: 'oklch(0.15 0.05 20)',
      popover: 'oklch(1 0 0)',
      popoverForeground: 'oklch(0.15 0.05 20)',
      // Primary: Rich Christmas red
      primary: 'oklch(0.45 0.18 25)', // Deep red
      primaryForeground: 'oklch(0.98 0 0)', // White text
      // Secondary: Forest green
      secondary: 'oklch(0.35 0.12 150)', // Deep green
      secondaryForeground: 'oklch(0.98 0 0)', // White text
      muted: 'oklch(0.95 0.01 140)', // Very light green-gray
      mutedForeground: 'oklch(0.45 0.05 140)', // Medium green-gray
      // Accent: Gold/amber
      accent: 'oklch(0.75 0.15 85)', // Warm gold
      accentForeground: 'oklch(0.15 0.05 20)', // Dark text
      destructive: 'oklch(0.55 0.22 25)', // Bright red
      destructiveForeground: 'oklch(0.98 0 0)',
      border: 'oklch(0.90 0.02 140)', // Light green-gray border
      input: 'oklch(0.95 0.01 140)',
      ring: 'oklch(0.45 0.18 25)', // Red ring
      // Chart colors with Christmas theme
      chart1: 'oklch(0.45 0.18 25)', // Red
      chart2: 'oklch(0.35 0.12 150)', // Green
      chart3: 'oklch(0.75 0.15 85)', // Gold
      chart4: 'oklch(0.65 0.15 200)', // Blue (for variety)
      chart5: 'oklch(0.55 0.18 30)', // Dark red
      sidebar: 'oklch(0.97 0.01 140)',
      sidebarForeground: 'oklch(0.15 0.05 20)',
      sidebarPrimary: 'oklch(0.45 0.18 25)',
      sidebarPrimaryForeground: 'oklch(0.98 0 0)',
      sidebarAccent: 'oklch(0.95 0.01 140)',
      sidebarAccentForeground: 'oklch(0.15 0.05 20)',
      sidebarBorder: 'oklch(0.90 0.02 140)',
      sidebarRing: 'oklch(0.45 0.18 25)',
    },
    dark: {
      // Dark mode with lighter, cozy Christmas colors
      background: 'oklch(0.25 0.03 140)', // Lighter dark green for Christmas
      foreground: 'oklch(0.95 0.02 140)', // Light green-tinted text
      card: 'oklch(0.30 0.04 140)', // Lighter green card
      cardForeground: 'oklch(0.95 0.02 140)',
      popover: 'oklch(0.15 0.04 140)',
      popoverForeground: 'oklch(0.95 0.02 140)',
      // Primary: Bright Christmas red
      primary: 'oklch(0.60 0.20 25)', // Bright red
      primaryForeground: 'oklch(0.98 0 0)', // White
      // Secondary: Bright green
      secondary: 'oklch(0.50 0.15 150)', // Bright green
      secondaryForeground: 'oklch(0.98 0 0)', // White
      muted: 'oklch(0.30 0.03 140)', // Lighter green-gray
      mutedForeground: 'oklch(0.65 0.05 140)', // Medium green-gray
      // Accent: Warm gold
      accent: 'oklch(0.70 0.18 85)', // Bright gold
      accentForeground: 'oklch(0.12 0.03 140)', // Dark background
      destructive: 'oklch(0.55 0.22 25)', // Red
      destructiveForeground: 'oklch(0.98 0 0)',
      border: 'oklch(0.35 0.04 140)', // Lighter green border
      input: 'oklch(0.30 0.03 140)',
      ring: 'oklch(0.60 0.20 25)', // Red ring
      // Chart colors
      chart1: 'oklch(0.60 0.20 25)', // Red
      chart2: 'oklch(0.50 0.15 150)', // Green
      chart3: 'oklch(0.70 0.18 85)', // Gold
      chart4: 'oklch(0.55 0.15 200)', // Blue
      chart5: 'oklch(0.65 0.20 30)', // Bright red
      sidebar: 'oklch(0.28 0.04 140)',
      sidebarForeground: 'oklch(0.95 0.02 140)',
      sidebarPrimary: 'oklch(0.60 0.20 25)',
      sidebarPrimaryForeground: 'oklch(0.98 0 0)',
      sidebarAccent: 'oklch(0.30 0.03 140)',
      sidebarAccentForeground: 'oklch(0.95 0.02 140)',
      sidebarBorder: 'oklch(0.35 0.04 140)',
      sidebarRing: 'oklch(0.60 0.20 25)',
    },
  },
  // Theme-specific additional CSS (colors/visual effects only)
  getAdditionalCSS: (isDark: boolean) => {
    const backgroundGradient = isDark
      ? `linear-gradient(135deg, oklch(0.25 0.03 140) 0%, oklch(0.22 0.02 20) 50%, oklch(0.25 0.03 140) 100%)`
      : `linear-gradient(135deg, oklch(0.98 0.02 140) 0%, oklch(0.99 0.01 20) 50%, oklch(0.98 0.02 140) 100%)`

    return `
/* Christmas theme background - colors only */
body {
  background-image: ${backgroundGradient};
  background-attachment: fixed;
}

body::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle at 20% 30%, rgba(220, 38, 38, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(34, 197, 94, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.03) 0%, transparent 50%);
  pointer-events: none;
  z-index: -1;
}
`
  },
  // Theme-specific component (snow effect)
  AdditionalComponent: ChristmasSnowEffect,
}

// Export as both named and default for compatibility
export { christmasTheme }
export default christmasTheme

