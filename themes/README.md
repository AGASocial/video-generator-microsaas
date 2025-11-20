# Theme System

This folder contains the theme system for the application. The theme system is designed to be modular and extensible, allowing you to easily create and switch between different themes.

## Structure

- **`types.ts`** - TypeScript type definitions for themes
- **`fonts.ts`** - Font configuration and class names
- **`constants.ts`** - CSS class constants and utility combinations
- **`default.ts`** - Default theme configuration (light/dark colors, radius, fonts)
- **`index.ts`** - Main entry point exporting all theme utilities

## Usage

### Using Theme Constants

```tsx
import { cssClasses, classCombinations } from '@/themes/constants'

// Use predefined class combinations
<div className={classCombinations.card}>
  <h1 className={cssClasses.heading1}>Title</h1>
</div>
```

### Using Font Classes

```tsx
import { fontClasses } from '@/themes/fonts'

<h1 className={`${fontClasses.sans} ${fontClasses.bold} ${fontClasses['3xl']}`}>
  Heading
</h1>
```

### Creating a New Theme

1. Create a new file in the `themes` folder (e.g., `ocean.ts`)
2. Import and extend the default theme:

```typescript
import type { ThemeConfig } from './types'
import { defaultTheme } from './default'

export const oceanTheme: ThemeConfig = {
  ...defaultTheme,
  name: 'ocean',
  colors: {
    light: {
      // Override colors for light mode
      primary: 'oklch(0.5 0.2 220)', // Ocean blue
      // ... other colors
    },
    dark: {
      // Override colors for dark mode
      // ...
    },
  },
}
```

3. Export it from `index.ts` and use it in your CSS generation

## Current Theme

The default theme uses:
- **Primary Font**: Inter (modern, clean, highly readable)
- **Monospace Font**: JetBrains Mono (developer-friendly)
- **Color System**: OKLCH color space for better color consistency
- **Border Radius**: 0.625rem (10px)

## Font Configuration

The app uses Inter as the primary font, which is:
- Modern and clean
- Highly readable at all sizes
- Optimized for screens
- Excellent for UI/UX applications

Fonts are loaded via Next.js font optimization for optimal performance.

