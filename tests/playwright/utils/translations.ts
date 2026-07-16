import en from '../../../lang/en.json';
import de from '../../../lang/de.json';
import fr from '../../../lang/fr.json';

type Language = 'en' | 'de' | 'fr';

const translations: Record<Language, object> = {
  en,
  de,
  fr,
};


async function getCurrentLanguage(page: import('@playwright/test').Page): Promise<SupportedLanguage> {
  const activeLanguage = await page
    .locator('[data-bs-language-value].active')
    .first()
    .getAttribute('data-bs-language-value');

  if (activeLanguage === 'en' || activeLanguage === 'de' || activeLanguage === 'fr') {
    return activeLanguage;
  }

  const storedLanguage = await page.evaluate(() => localStorage.getItem('userLanguage'));
  if (storedLanguage === 'en' || storedLanguage === 'de' || storedLanguage === 'fr') {
    return storedLanguage;
  }

  return 'en';
}
export { getCurrentLanguage };
// This strongly presumes that all translations have the same structure as English
export const getTranslations = (language: Language = 'en') => translations[language];

export const defaultTranslations = en;