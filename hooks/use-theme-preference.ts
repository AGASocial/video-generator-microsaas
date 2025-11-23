'use client'

import { useState, useEffect } from 'react'

const THEME_STORAGE_KEY = 'app-theme-preference'
const DEFAULT_THEME = 'christmas'

export type ThemePreference = string

/**
 * Hook to manage theme preference with localStorage and optional database sync
 * Uses API routes instead of direct Supabase calls to avoid exposing Supabase URL/keys
 */
export function useThemePreference() {
  const [theme, setThemeState] = useState<ThemePreference>(DEFAULT_THEME)
  const [isLoading, setIsLoading] = useState(true)

  // Load theme from localStorage on mount
  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    if (storedTheme) {
      setThemeState(storedTheme)
    }
    setIsLoading(false)
  }, [])

  // Sync with database if user is authenticated
  useEffect(() => {
    async function syncWithDatabase() {
      try {
        // Fetch theme preference from API route
        const response = await fetch('/api/user/theme', {
          method: 'GET',
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.theme) {
            setThemeState(data.theme)
            localStorage.setItem(THEME_STORAGE_KEY, data.theme)
          } else {
            // If no theme in database, save current localStorage theme
            const currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME
            await fetch('/api/user/theme', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({ theme: currentTheme }),
            })
          }
        }
        // If unauthorized (401), user is not logged in - just use localStorage
      } catch (error) {
        console.error('Failed to sync theme with database:', error)
      }
    }

    if (!isLoading) {
      syncWithDatabase()
    }
  }, [isLoading])

  const setTheme = async (newTheme: ThemePreference) => {
    setThemeState(newTheme)
    localStorage.setItem(THEME_STORAGE_KEY, newTheme)

    // Sync with database via API route
    try {
      const response = await fetch('/api/user/theme', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ theme: newTheme }),
      })

      if (!response.ok && response.status !== 401) {
        // 401 means user is not logged in, which is fine - we still saved to localStorage
        console.error('Failed to save theme to database:', response.statusText)
      }
    } catch (error) {
      console.error('Failed to save theme to database:', error)
    }
  }

  return { theme, setTheme, isLoading }
}

