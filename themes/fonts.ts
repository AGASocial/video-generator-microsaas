/**
 * Font configuration for the application
 * Using Inter as the primary font - a modern, clean, and highly readable font
 */

export const fontConfig = {
  sans: {
    family: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] as const,
  },
  mono: {
    family: ['JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'monospace'],
    weights: ['400', '500', '600', '700'] as const,
  },
} as const

/**
 * Font class names for use in components
 */
export const fontClasses = {
  sans: 'font-sans',
  mono: 'font-mono',
  // Font weights
  thin: 'font-thin',
  extralight: 'font-extralight',
  light: 'font-light',
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
  extrabold: 'font-extrabold',
  black: 'font-black',
  // Font sizes
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
  '5xl': 'text-5xl',
  '6xl': 'text-6xl',
} as const

