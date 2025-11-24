import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { GoogleAnalytics } from '@/components/google-analytics'

// Initialize fonts
const inter = Inter({ 
  subsets: ['latin'], 
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ['latin'], 
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CCTV Magic - Transform Your Security Camera Photos into AI Videos',
  description: 'Transform your security camera photos into fun, realistic, and viral videos with AI',
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/icon-light-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-dark-32x32.png', type: 'image/png', sizes: '32x32', media: '(prefers-color-scheme: dark)' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Root layout must have html/body tags
  // The [locale] layout will handle the actual content and locale-specific providers
  // Default to Spanish since it's our default locale
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
