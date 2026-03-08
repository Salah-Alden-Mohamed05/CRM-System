'use client';

import { useAuth } from '@/context/AuthContext';
import { en } from './en';
import { ar } from './ar';

/**
 * Hook – returns the current translation object and a `t` helper.
 *
 * Usage:
 *   const { t, lang } = useTranslation();
 *   t('common.save')   →  'Save' | 'حفظ'
 */
export function useTranslation() {
  const { language } = useAuth();
  const translations = language === 'ar' ? ar : en;

  /**
   * Access nested key with dot-notation, e.g. t('common.save')
   */
  const t = (key: string): string => {
    const parts = key.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = translations;
    for (const part of parts) {
      if (node && typeof node === 'object' && part in node) {
        node = node[part];
      } else {
        return key; // fallback to key if missing
      }
    }
    return typeof node === 'string' ? node : key;
  };

  return { t, lang: language, isRTL: language === 'ar', translations };
}

// Alias for new pages that use useI18n
export const useI18n = useTranslation;

export { en, ar };
