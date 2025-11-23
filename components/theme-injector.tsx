'use client'

import { useEffect, useState } from 'react'
import { useThemePreference } from '@/hooks/use-theme-preference'
import { getTheme } from '@/themes/registry'
import { getThemeCSSVariables } from '@/themes'
import { ChristmasSnowEffect } from './christmas-snow-effect'

/**
 * Component that dynamically injects CSS variables based on the selected theme
 * This overrides the base theme variables in globals.css
 */
export function ThemeInjector() {
  const { theme } = useThemePreference()
  const [isChristmasTheme, setIsChristmasTheme] = useState(false)

  useEffect(() => {
    // Only apply theme on client side
    if (typeof window === 'undefined') return

    let observer: MutationObserver | null = null

    async function applyTheme() {
      try {
        const themeConfig = await getTheme(theme)
        let cssVariables = getThemeCSSVariables(themeConfig)
        
        // Add Christmas-specific background gradient
        if (themeConfig.name === 'christmas') {
          console.log('🎄 Christmas theme detected! Theme name:', themeConfig.name, 'Current theme value:', theme)
          setIsChristmasTheme(true)
          const isDark = document.documentElement.classList.contains('dark')
          
          const backgroundGradient = isDark
            ? `linear-gradient(135deg, oklch(0.25 0.03 140) 0%, oklch(0.22 0.02 20) 50%, oklch(0.25 0.03 140) 100%)`
            : `linear-gradient(135deg, oklch(0.98 0.02 140) 0%, oklch(0.99 0.01 20) 50%, oklch(0.98 0.02 140) 100%)`
          
          cssVariables += `
/* Christmas theme background */
body {
  background-image: ${backgroundGradient};
  background-attachment: fixed;
  position: relative;
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
  z-index: -2;
}

/* Ensure all content is above the snow effect */
body > * {
  position: relative;
  z-index: 1;
}

/* Ensure cards, modals, and other elevated content are above snow */
[class*="card"],
[class*="Card"],
[class*="dialog"],
[class*="Dialog"],
[class*="modal"],
[class*="Modal"],
[class*="popover"],
[class*="Popover"],
[class*="dropdown"],
[class*="Dropdown"],
[class*="sheet"],
[class*="Sheet"],
main,
header,
footer,
nav {
  position: relative;
  z-index: 10;
}
`
          
          // Update background when dark mode changes (only for Christmas theme)
          observer = new MutationObserver(() => {
            const isDark = document.documentElement.classList.contains('dark')
            const backgroundGradient = isDark
              ? `linear-gradient(135deg, oklch(0.25 0.03 140) 0%, oklch(0.22 0.02 20) 50%, oklch(0.25 0.03 140) 100%)`
              : `linear-gradient(135deg, oklch(0.98 0.02 140) 0%, oklch(0.99 0.01 20) 50%, oklch(0.98 0.02 140) 100%)`
            
            const styleEl = document.getElementById('theme-styles') as HTMLStyleElement
            if (styleEl) {
              styleEl.textContent = styleEl.textContent?.replace(
                /background-image:\s*[^;]+;/,
                `background-image: ${backgroundGradient};`
              ) || styleEl.textContent
            }
          })
          
          observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
          })
        } else {
          setIsChristmasTheme(false)
        }
        
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

    applyTheme()

    // Cleanup function
    return () => {
      if (observer) {
        observer.disconnect()
      }
    }
  }, [theme])
  
  // Debug logging
  useEffect(() => {
    console.log('ThemeInjector - Current theme:', theme, 'isChristmasTheme:', isChristmasTheme)
  }, [theme, isChristmasTheme])
  
  return isChristmasTheme ? <ChristmasSnowEffect /> : null
}

