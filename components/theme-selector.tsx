'use client'

import { useThemePreference } from '@/hooks/use-theme-preference'
import { availableThemes } from '@/themes/registry'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export function ThemeSelector() {
  const { theme, setTheme, isLoading } = useThemePreference()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Choose your preferred theme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme</CardTitle>
        <CardDescription>Choose your preferred theme</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="theme-select">Theme Preference</Label>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger id="theme-select">
              <SelectValue placeholder="Select a theme" />
            </SelectTrigger>
            <SelectContent>
              {availableThemes.map((themeName) => (
                <SelectItem key={themeName} value={themeName}>
                  <span className="capitalize">{themeName}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Your theme preference is saved and will be applied across all your devices when you're signed in.
        </p>
      </CardContent>
    </Card>
  )
}

