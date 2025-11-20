'use client'

import { useEffect } from 'react'
import { useThemePreference } from '@/hooks/use-theme-preference'
import { getTheme } from '@/themes/registry'
import { getThemeCSSVariables } from '@/themes'

/**
 * Component that dynamically injects CSS variables based on the selected theme
 * This overrides the base theme variables in globals.css
 */
export function ThemeInjector() {
  const { theme } = useThemePreference()

  useEffect(() => {
    async function applyTheme() {
      try {
        const themeConfig = await getTheme(theme)
        const cssVariables = getThemeCSSVariables(themeConfig)
        
        // Create or update a style element with the theme CSS
        // We use a high priority to ensure it overrides base styles
        let styleElement = document.getElementById('theme-styles') as HTMLStyleElement
        
        if (!styleElement) {
          styleElement = document.createElement('style')
          styleElement.id = 'theme-styles'
          // Insert after any existing stylesheets but before other inline styles
          const firstStyle = document.head.querySelector('style')
          if (firstStyle) {
            document.head.insertBefore(styleElement, firstStyle.nextSibling)
          } else {
            document.head.appendChild(styleElement)
          }
        }
        
        styleElement.textContent = cssVariables
      } catch (error) {
        console.error('Failed to apply theme:', error)
      }
    }

    // Only apply theme on client side
    if (typeof window !== 'undefined') {
      applyTheme()
    }
  }, [theme])

  return null
}

