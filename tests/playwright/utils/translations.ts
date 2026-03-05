import en from '../../../lang/en.json';
import de from '../../../lang/de.json';
import fr from '../../../lang/fr.json';

type Language = 'en' | 'de' | 'fr';

const translations: Record<Language, object> = {
  en,
  de,
  fr,
};
// This strongly presumes that all translations have the same structure as English
export const getTranslations = (language: Language = 'en') => translations[language];

export const defaultTranslations = en;