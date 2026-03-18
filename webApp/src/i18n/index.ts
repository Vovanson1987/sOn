import { ru } from './ru';
import { en } from './en';
import { kz } from './kz';

export type Locale = 'ru' | 'en' | 'kz';
export type TranslationKey = keyof typeof ru;

const translations: Record<Locale, Record<TranslationKey, string>> = { ru, en, kz };

/** Получить текущую локаль */
export function getLocale(): Locale {
  const stored = localStorage.getItem('son-locale') as Locale | null;
  if (stored && translations[stored]) return stored;

  const browserLang = navigator.language.slice(0, 2);
  if (browserLang === 'kk' || browserLang === 'kz') return 'kz';
  if (browserLang === 'en') return 'en';
  return 'ru';
}

/** Установить локаль */
export function setLocale(locale: Locale): void {
  localStorage.setItem('son-locale', locale);
}

/** Перевод по ключу */
export function t(key: TranslationKey, locale?: Locale): string {
  const l = locale ?? getLocale();
  return translations[l]?.[key] ?? translations.ru[key] ?? key;
}
