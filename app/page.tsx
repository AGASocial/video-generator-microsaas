// This page should not be reached - middleware redirects to locale
// But if it is, redirect to default locale
import { redirect } from 'next/navigation';
import { routing } from '@/i18n/routing';

export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
