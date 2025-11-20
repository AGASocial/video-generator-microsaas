'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const THEME_STORAGE_KEY = 'app-theme-preference'
const DEFAULT_THEME = 'default'

export type ThemePreference = string

/**
 * Hook to manage theme preference with localStorage and optional database sync
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
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Try to load from database
          const { data: userData } = await supabase
            .from('users')
            .select('theme_preference')
            .eq('id', user.id)
            .single()

          if (userData?.theme_preference) {
            setThemeState(userData.theme_preference)
            localStorage.setItem(THEME_STORAGE_KEY, userData.theme_preference)
          } else {
            // Save current preference to database
            const currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME
            await supabase
              .from('users')
              .update({ theme_preference: currentTheme })
              .eq('id', user.id)
          }
        }
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

    // Sync with database if user is authenticated
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        await supabase
          .from('users')
          .update({ theme_preference: newTheme })
          .eq('id', user.id)
      }
    } catch (error) {
      console.error('Failed to save theme to database:', error)
    }
  }

  return { theme, setTheme, isLoading }
}

