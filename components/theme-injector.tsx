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
    let isMounted = true

    async function applyTheme() {
      try {
        console.log('[ThemeInjector] Applying theme:', theme)
        const themeConfig = await getTheme(theme)
        console.log('[ThemeInjector] Theme config loaded:', themeConfig.name)
        
        // Disconnect previous observer if it exists
        if (observer) {
          observer.disconnect()
          observer = null
        }
        
        let cssVariables = getThemeCSSVariables(themeConfig)
        console.log('[ThemeInjector] Base CSS variables generated')
        
        // Add theme-specific additional CSS if the theme provides it
        if (themeConfig.getAdditionalCSS) {
          const isDark = document.documentElement.classList.contains('dark')
          cssVariables += themeConfig.getAdditionalCSS(isDark)
          console.log('[ThemeInjector] Additional CSS added for theme:', themeConfig.name)
          
          // Update additional CSS when dark mode changes
          observer = new MutationObserver(() => {
            if (!isMounted) return
            
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
        if (!isMounted) return
        
        let styleElement = document.getElementById('theme-styles') as HTMLStyleElement
        
        if (!styleElement) {
          styleElement = document.createElement('style')
          styleElement.id = 'theme-styles'
          // Insert at the end of head to ensure it overrides base styles
          document.head.appendChild(styleElement)
          console.log('[ThemeInjector] Created new style element')
        } else {
          // If element exists, move it to the end to ensure it's last in cascade
          styleElement.remove()
          document.head.appendChild(styleElement)
        }
        
        styleElement.textContent = cssVariables
        console.log('[ThemeInjector] Theme CSS applied successfully, length:', cssVariables.length)
        
        // Force a reflow to ensure styles are applied
        void document.documentElement.offsetHeight
      } catch (error) {
        console.error('[ThemeInjector] Failed to apply theme:', error)
      }
    }

    applyTheme()

    // Cleanup function
    return () => {
      isMounted = false
      if (observer) {
        observer.disconnect()
        observer = null
      }
    }
  }, [theme])
  
  // Render theme-specific component if the theme provides it
  const [ThemeComponent, setThemeComponent] = useState<React.ComponentType | null>(null)
  
  useEffect(() => {
    let isMounted = true
    
    async function loadThemeComponent() {
      try {
        console.log('[ThemeInjector] Loading component for theme:', theme)
        const themeConfig = await getTheme(theme)
        console.log('[ThemeInjector] Theme config loaded, has AdditionalComponent:', !!themeConfig.AdditionalComponent)
        
        if (!isMounted) return
        
        if (themeConfig.AdditionalComponent) {
          console.log('[ThemeInjector] Setting theme component')
          setThemeComponent(() => themeConfig.AdditionalComponent!)
        } else {
          console.log('[ThemeInjector] Clearing theme component (theme has no AdditionalComponent)')
          setThemeComponent(null)
        }
      } catch (error) {
        console.error('[ThemeInjector] Failed to load theme component:', error)
        if (isMounted) {
          setThemeComponent(null)
        }
      }
    }
    
    // Clear component immediately when theme changes
    setThemeComponent(null)
    loadThemeComponent()
    
    return () => {
      isMounted = false
      setThemeComponent(null)
    }
  }, [theme])
  
  console.log('[ThemeInjector] Rendering, ThemeComponent:', ThemeComponent ? 'present' : 'null', 'theme:', theme)
  return ThemeComponent ? <ThemeComponent key={theme} /> : null
}

