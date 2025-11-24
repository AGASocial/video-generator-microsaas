'use client'

import { useEffect, useState } from 'react'
import type React from 'react'
import { useThemePreference } from '@/hooks/use-theme-preference'
import { getTheme } from '@/themes/registry'
import { getThemeCSSVariables } from '@/themes'

/**
 * Component that dynamically injects CSS variables based on the selected theme
 * This overrides the base theme variables in globals.css
 * Themes can optionally provide additional CSS and components
 */
export function ThemeInjector() {
  const { theme } = useThemePreference()

  useEffect(() => {
    // Only apply theme on client side
    if (typeof window === 'undefined') return

    let observer: MutationObserver | null = null

    async function applyTheme() {
      try {
        const themeConfig = await getTheme(theme)
        let cssVariables = getThemeCSSVariables(themeConfig)
        
        // Add theme-specific additional CSS if the theme provides it
        if (themeConfig.getAdditionalCSS) {
          const isDark = document.documentElement.classList.contains('dark')
          cssVariables += themeConfig.getAdditionalCSS(isDark)
          
          // Update additional CSS when dark mode changes
          observer = new MutationObserver(() => {
            const isDark = document.documentElement.classList.contains('dark')
            const additionalCSS = themeConfig.getAdditionalCSS!(isDark)
            
            const styleEl = document.getElementById('theme-styles') as HTMLStyleElement
            if (styleEl) {
              const baseCSS = getThemeCSSVariables(themeConfig)
              styleEl.textContent = baseCSS + additionalCSS
            }
          })
          
          observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
          })
        }
        
        // Create or update a style element with the theme CSS
        let styleElement = document.getElementById('theme-styles') as HTMLStyleElement
        
        if (!styleElement) {
          styleElement = document.createElement('style')
          styleElement.id = 'theme-styles'
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
  
  // Render theme-specific component if the theme provides it
  const [ThemeComponent, setThemeComponent] = useState<React.ComponentType | null>(null)
  
  useEffect(() => {
    async function loadThemeComponent() {
      try {
        const themeConfig = await getTheme(theme)
        if (themeConfig.AdditionalComponent) {
          setThemeComponent(() => themeConfig.AdditionalComponent!)
        } else {
          setThemeComponent(null)
        }
      } catch (error) {
        console.error('Failed to load theme component:', error)
        setThemeComponent(null)
      }
    }
    loadThemeComponent()
  }, [theme])
  
  return ThemeComponent ? <ThemeComponent /> : null
}

