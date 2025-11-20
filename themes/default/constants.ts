/**
 * CSS Class Constants
 * Centralized class names for consistent styling across the application
 */

import type { CSSClassConstants } from '../types'

export const cssClasses: CSSClassConstants = {
  // Layout
  container: 'container mx-auto',
  containerPadding: 'px-4 sm:px-6 lg:px-8',
  
  // Typography
  heading1: 'text-5xl sm:text-6xl font-bold tracking-tight',
  heading2: 'text-4xl sm:text-5xl font-bold tracking-tight',
  heading3: 'text-3xl sm:text-4xl font-semibold tracking-tight',
  heading4: 'text-2xl sm:text-3xl font-semibold',
  body: 'text-base',
  bodyLarge: 'text-lg',
  bodySmall: 'text-sm',
  muted: 'text-muted-foreground',
  
  // Spacing
  sectionSpacing: 'py-12 sm:py-16 lg:py-20',
  cardSpacing: 'gap-6',
  buttonSpacing: 'gap-4',
  
  // Borders
  borderDefault: 'border',
  borderRadius: 'rounded-xl',
  borderRadiusSmall: 'rounded-lg',
  borderRadiusLarge: 'rounded-2xl',
  
  // Shadows
  shadowSm: 'shadow-sm',
  shadowMd: 'shadow-md',
  shadowLg: 'shadow-lg',
  
  // Transitions
  transitionDefault: 'transition-all duration-200 ease-in-out',
  transitionFast: 'transition-all duration-150 ease-in-out',
  transitionSlow: 'transition-all duration-300 ease-in-out',
}

/**
 * Utility class combinations for common patterns
 */
export const classCombinations = {
  // Card styles
  card: 'bg-card text-card-foreground rounded-xl border shadow-sm',
  cardHover: 'bg-card text-card-foreground rounded-xl border shadow-sm hover:shadow-md transition-shadow',
  
  // Button styles
  buttonPrimary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  buttonSecondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  buttonOutline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  
  // Input styles
  input: 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
  inputFocus: 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  
  // Link styles
  link: 'text-primary hover:underline',
  linkMuted: 'text-muted-foreground hover:text-foreground',
  
  // Navigation
  navItem: 'text-sm font-medium hover:underline transition-colors',
  navItemActive: 'text-sm font-medium underline',
  
  // Layout
  pageContainer: 'min-h-screen bg-background',
  mainContent: 'container mx-auto px-4',
  sectionContainer: 'container mx-auto px-4 py-12 sm:py-16 lg:py-20',
  
  // Flexbox utilities
  flexCenter: 'flex items-center justify-center',
  flexBetween: 'flex items-center justify-between',
  flexCol: 'flex flex-col',
  flexRow: 'flex flex-row',
  
  // Grid utilities
  gridCols2: 'grid grid-cols-1 sm:grid-cols-2 gap-6',
  gridCols3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6',
  gridCols4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6',
} as const

