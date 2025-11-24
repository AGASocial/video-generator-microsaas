/**
 * Theme type definitions
 */

export interface ThemeColors {
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  destructiveForeground: string
  border: string
  input: string
  ring: string
  chart1: string
  chart2: string
  chart3: string
  chart4: string
  chart5: string
  sidebar: string
  sidebarForeground: string
  sidebarPrimary: string
  sidebarPrimaryForeground: string
  sidebarAccent: string
  sidebarAccentForeground: string
  sidebarBorder: string
  sidebarRing: string
}

export interface ThemeConfig {
  name: string
  colors: {
    light: ThemeColors
    dark: ThemeColors
  }
  radius: string
  fonts: {
    sans: string[]
    mono: string[]
  }
  // Optional: Function to get additional CSS (colors/visual effects only, no layout/positioning)
  getAdditionalCSS?: (isDark: boolean) => string
  // Optional: Component to render (e.g., snow effect, particles, etc.)
  AdditionalComponent?: React.ComponentType
}

export interface CSSClassConstants {
  // Layout
  container: string
  containerPadding: string
  
  // Typography
  heading1: string
  heading2: string
  heading3: string
  heading4: string
  body: string
  bodyLarge: string
  bodySmall: string
  muted: string
  
  // Spacing
  sectionSpacing: string
  cardSpacing: string
  buttonSpacing: string
  
  // Borders
  borderDefault: string
  borderRadius: string
  borderRadiusSmall: string
  borderRadiusLarge: string
  
  // Shadows
  shadowSm: string
  shadowMd: string
  shadowLg: string
  
  // Transitions
  transitionDefault: string
  transitionFast: string
  transitionSlow: string
}

