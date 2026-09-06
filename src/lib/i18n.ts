/**
 * Internationalization & Urdu Language Support Module
 * Supports Urdu (اردو), Roman Urdu detection, and natural translations
 * while preserving proper product names, locations, dates, and numbers.
 */

export type SupportedLanguage = 'auto' | 'en' | 'ur' | 'es' | 'fr' | 'de' | 'hi' | 'ja';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'auto', label: 'Auto (Detect)', nativeLabel: 'خودکار (Auto Detect)' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو (Urdu)' },
  { code: 'en', label: 'English (US)', nativeLabel: 'English (US)' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी (Hindi)' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語' },
];

/**
 * Regex matching Urdu / Arabic script characters
 */
const URDU_SCRIPT_REGEX = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Common Roman Urdu vocabulary markers
 */
const ROMAN_URDU_WORDS = new Set([
  'kya', 'kia', 'kaise', 'kaisay', 'haan', 'nahi', 'nahin', 'nhi', 'mein', 'main', 'ap', 'aap',
  'ka', 'ki', 'ke', 'ko', 'karo', 'karein', 'karen', 'karta', 'karti', 'karte',
  'hoga', 'hogi', 'honge', 'thi', 'tha', 'the', 'bhi', 'aur', 'shukriya', 'shukria',
  'bohot', 'bohat', 'theek', 'thik', 'karna', 'kar', 'raha', 'rahi', 'rahe',
  'hain', 'hai', 'hy', 'mujhe', 'mjhe', 'mera', 'meri', 'mere', 'tum', 'hum', 'humein',
  'aaj', 'kal', 'parson', 'waqt', 'shuru', 'khatam', 'suno', 'batao', 'bataiye',
  'kitna', 'kitni', 'door', 'dor', 'rasta', 'raste', 'masla', 'kaam', 'kuch', 'chahiye',
  'chahie', 'shukriya', 'salam', 'assalam', 'walekum', 'zaroori', 'zaruri', 'subah', 'sham', 'raat'
]);

/**
 * Detects if a text string is in Urdu script or Roman Urdu
 */
export function isUrduOrRomanUrdu(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  // 1. Urdu Script check
  if (URDU_SCRIPT_REGEX.test(text)) {
    return true;
  }

  // 2. Roman Urdu word frequency check
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;

  let matchCount = 0;
  for (const word of words) {
    if (ROMAN_URDU_WORDS.has(word)) {
      matchCount++;
    }
  }

  // If at least 2 words or >25% of words match common Roman Urdu markers
  return matchCount >= 2 || (words.length <= 4 && matchCount >= 1);
}

/**
 * Resolves active effective language given user's preference and input text
 */
export function resolveEffectiveLanguage(preferredLang?: string, sampleText?: string): string {
  const pref = (preferredLang || 'auto').toLowerCase();
  if (pref !== 'auto') {
    return pref;
  }

  if (sampleText && isUrduOrRomanUrdu(sampleText)) {
    return 'ur';
  }

  return 'en';
}

/**
 * Core UI Label Translations
 */
export const TRANSLATIONS_URDU: Record<string, string> = {
  // Navigation
  'nav.home': 'کمانڈ سینٹر (Command Center)',
  'nav.search': 'اے آئی سرچ اور انٹیلی جنس (AI Search)',
  'nav.calendar': 'کیلنڈر اور شیڈول (Calendar)',
  'nav.tasks': 'ٹاسکس اور ذمہ داریاں (Tasks)',
  'nav.planner': 'ڈیلی پلانر (Daily Planner)',
  'nav.focus': 'فوکس موڈ (Focus Mode)',
  'nav.journal': 'جرنل اور ریفلیکشنز (Journal)',
  'nav.insights': 'پروڈکٹیوٹی انسائٹس (Insights)',
  'nav.import': 'چیٹ امپورٹ (Chat Import)',
  'nav.history': 'آرکائیو (History)',
  'nav.settings': 'ترتیبات (Settings)',

  // Common Actions
  'action.search': 'تلاش کریں',
  'action.searching': 'تلاش جاری ہے...',
  'action.newChat': 'نیا چیٹ',
  'action.save': 'محفوظ کریں',
  'action.saving': 'محفوظ ہو رہا ہے...',
  'action.cancel': 'منسوخ کریں',
  'action.delete': 'حذف کریں',
  'action.retry': 'دوبارہ کوشش کریں',
  'action.approve': 'منظور کریں اور شامل کریں',
  'action.dismiss': 'مسترد کریں',
  'action.enableLocation': 'موجودہ لوکیشن کی اجازت دیں',
  'action.clear': 'صاف کریں',

  // AI Search
  'search.title': 'AI Live Search & Intelligence',
  'search.subtitle': 'ریئل ٹائم گوگل سرچ اور آپ کے کیلنڈر اور شیڈول کا جامع تجزیہ۔',
  'search.placeholder': 'کوئی بھی سوال، تازہ ترین معلومات، سفری فاصلہ یا تاریخ تلاش کریں...',
  'search.privacyBadge': 'نجی شیڈول محفوظ ہے (سرچ استفسار میں نجی ڈیٹا شامل نہیں کیا جاتا)',
  'search.synthesize': 'میرے شیڈول اور ٹاسکس کے ساتھ جوڑیں',
  'search.suggestedPrompts': 'تجویز کردہ تلاشیں',
  'search.liveAnswer': 'لائیو جواب (Live Grounded Answer)',
  'search.sources': 'مصدقہ ذرائع اور لنکس (Sources)',
  'search.suggestedActions': 'تجویز کردہ ٹاسکس اور کیلنڈر اپائنٹمنٹس',
  'search.suggestedActionsSub': 'Gemini نے اس تلاش کے نتائج میں سے درج ذیل ممکنہ کام دریافت کیے ہیں:',
  'search.locationNotice': 'موجودہ مقام درکار ہے',
  'search.locationNoticeDesc': 'اصل سڑک کا فاصلہ اور سفر کا درست وقت معلوم کرنے کے لیے براؤزر کی لوکیشن اجازت درکار ہے۔',
  'search.routeDetails': 'سفری تفصیلات اور راستہ',
  'search.distance': 'فاصلہ:',
  'search.estTime': 'تخمینہ وقت:',
  'search.mode': 'طریقہ:',
  'search.driving': 'ڈرائیونگ',
  'search.walking': 'پیدل',
  'search.transit': 'ٹرانزٹ',

  // Settings
  'settings.title': 'ترتیبات اور ترجیحات (Settings)',
  'settings.language': 'زبان (Language)',
  'settings.languageAuto': 'خودکار تشخیص (Auto Detect)',
  'settings.languageUrdu': 'اردو (Urdu)',
  'settings.languageEnglish': 'English (US)',
  'settings.saveSuccess': 'ترجیحات کامیابی سے محفوظ ہو گئیں',
};

/**
 * Translation helper function
 */
export function t(key: string, language: string = 'en', fallback?: string): string {
  const isUrdu = language === 'ur' || language.startsWith('ur-');
  if (isUrdu && TRANSLATIONS_URDU[key]) {
    return TRANSLATIONS_URDU[key];
  }
  return fallback || key;
}
