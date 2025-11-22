"use client";

import { useLocale } from 'next-intl';
import { useEffect } from 'react';

export function LocaleScript() {
  const locale = useLocale();

  useEffect(() => {
    // Update the html lang attribute when locale changes
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return null;
}

