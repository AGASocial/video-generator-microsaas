'use client'

import { useEffect } from 'react'
import Snowfall from 'react-snowfall'

/**
 * Christmas Snow Effect Component
 * Uses react-snowfall library for a beautiful, performant snow effect
 * Only renders when Christmas theme is active
 */
export function ChristmasSnowEffect() {
  useEffect(() => {
    console.log('❄️ ChristmasSnowEffect component mounted!')
  }, [])

  return (
    <div
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 2, // Make it very visible first
        pointerEvents: 'none',
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Snowfall
          snowflakeCount={100}
          color="#ffffff"
        />
      </div>
    </div>
  )
}
