// ──────────────────────────────────────────────
// Accessibility Infrastructure
// WCAG 2.1 AA, Screen Reader, Keyboard Nav, i18n
// ──────────────────────────────────────────────

import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, type ReactNode, type RefObject, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { announce, generateId } from './a11yUtils';

export type Locale = 'en' | 'hi' | 'gu' | 'mr' | 'bn' | 'ta' | 'te' | 'kn';

// Screen reader announcements moved to a11yUtils.ts
// (non-component exports break Vite HMR)

// ──────────────────────────────────────────────
// 2. Focus Trap Hook (for modals, dialogs)
// ──────────────────────────────────────────────

export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean = true) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableSelector = [
      'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
      'input:not([disabled])', 'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = container.querySelectorAll(focusableSelector);
      if (focusable.length === 0) return;

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, active]);
}

// ──────────────────────────────────────────────
// 3. Keyboard Navigation Hook
// ──────────────────────────────────────────────

export function useKeyboardNav(options: {
  onEscape?: () => void;
  onEnter?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onHome?: () => void;
  onEnd?: () => void;
}) {
  // Memoize options to prevent infinite effect re-runs
  const onEscape = options.onEscape;
  const onEnter = options.onEnter;
  const onArrowUp = options.onArrowUp;
  const onArrowDown = options.onArrowDown;
  const onArrowLeft = options.onArrowLeft;
  const onArrowRight = options.onArrowRight;
  const onHome = options.onHome;
  const onEnd = options.onEnd;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': onEscape?.(); break;
        case 'Enter': onEnter?.(); break;
        case 'ArrowUp': onArrowUp?.(); e.preventDefault(); break;
        case 'ArrowDown': onArrowDown?.(); e.preventDefault(); break;
        case 'ArrowLeft': onArrowLeft?.(); e.preventDefault(); break;
        case 'ArrowRight': onArrowRight?.(); e.preventDefault(); break;
        case 'Home': onHome?.(); e.preventDefault(); break;
        case 'End': onEnd?.(); e.preventDefault(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape, onEnter, onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onHome, onEnd]);
}

// ──────────────────────────────────────────────
// 4. Roving Tabindex (for tab lists, menus)
// ──────────────────────────────────────────────

export function useRovingTabindex(itemCount: number) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = useCallback((e: ReactKeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % itemCount);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + itemCount) % itemCount);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(itemCount - 1);
        break;
    }
  }, [itemCount]);

  return { activeIndex, setActiveIndex, handleKeyDown, getTabindex: (index: number) => index === activeIndex ? 0 : -1 };
}

// ──────────────────────────────────────────────
// 5. Skip to Content Link
// ──────────────────────────────────────────────

export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold focus:shadow-lg"
    >
      Skip to main content
    </a>
  );
}

// ──────────────────────────────────────────────
// 6. Visually Hidden (screen-reader only)
// ──────────────────────────────────────────────

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

// ──────────────────────────────────────────────
// 7. Accessible Label Helpers
// ──────────────────────────────────────────────

// generateId moved to a11yUtils.ts

// ──────────────────────────────────────────────
// 8. i18n / Multi-Language Support
// ──────────────────────────────────────────────

// Locale type defined above

interface I18nConfig {
  locale: Locale;
  fallbackLocale: Locale;
}

const VALID_LOCALES: Locale[] = ['en', 'hi', 'gu', 'mr', 'bn', 'ta', 'te', 'kn'];

const defaultConfig: I18nConfig = {
  locale: VALID_LOCALES.includes(localStorage.getItem('app-locale') as Locale) 
    ? (localStorage.getItem('app-locale') as Locale) 
    : 'en',
  fallbackLocale: 'en',
};

// Translation context
interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  locales: { code: Locale; name: string; nativeName: string }[];
}

const I18nContext = createContext<I18nContextType | null>(null);

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

// Available locales (kept as internal constant to avoid Vite HMR incompatible export error)
const AVAILABLE_LOCALES: { code: Locale; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
];

// Translation files (embedded for simplicity - in production use lazy loading)
const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.search': 'Browse',
    'nav.matches': 'Matches',
    'nav.interests': 'Interests',
    'nav.messages': 'Messages',
    'nav.shortlist': 'Shortlist',
    'nav.profile': 'My Profile',
    'nav.settings': 'Settings',
    'nav.logout': 'Sign Out',
    'nav.admin': 'Admin',
    'nav.dashboard': 'Dashboard',
    // Auth
    'auth.login': 'Login',
    'auth.register': 'Register',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.forgot_password': 'Forgot Password?',
    'auth.login_button': 'Sign In',
    'auth.register_button': 'Create Account',
    'auth.invalid_credentials': 'Invalid credentials',
    'auth.account_locked': 'Account temporarily locked',
    // Search
    'search.title': 'Browse Profiles',
    'search.filters': 'Filters',
    'search.clear_filters': 'Clear Filters',
    'search.no_results': 'No profiles found',
    'search.start_searching': 'Start searching',
    'search.loading': 'Loading profiles...',
    'search.results_count': '{count} profiles found',
    // Profile
    'profile.view': 'View Profile',
    'profile.send_interest': 'Send Interest',
    'profile.shortlist': 'Shortlist',
    'profile.about': 'About',
    'profile.education': 'Education & Career',
    'profile.family': 'Family Details',
    'profile.lifestyle': 'Lifestyle',
    'profile.horoscope': 'Horoscope',
    'profile.preferences': 'Partner Preferences',
    'profile.verified': 'Verified',
    'profile.premium': 'Premium',
    'profile.online': 'Online',
    'profile.offline': 'Offline',
    'profile.age': '{age} years',
    'profile.height': 'Height',
    'profile.income': 'Annual Income',
    'profile.match_score': '{score}% Match',
    // Messages
    'messages.title': 'Messages',
    'messages.type_placeholder': 'Type a message...',
    'messages.send': 'Send',
    'messages.typing': '{name} is typing...',
    'messages.no_conversations': 'No conversations yet',
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.loading': 'Loading...',
    'common.error': 'Something went wrong',
    'common.success': 'Success!',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.credits': 'Credits',
    'common.membership': 'Membership',
    // Accessibility
    'a11y.skip_to_content': 'Skip to main content',
    'a11y.menu_open': 'Open navigation menu',
    'a11y.menu_close': 'Close navigation menu',
    'a11y.search_filters': 'Search filters',
    'a11y.profile_card': 'Profile card for {name}',
    'a11y.notification': '{count} unread notifications',
    'a11y.messages_unread': '{count} unread messages',
    'a11y.dialog_close': 'Close dialog',
    'a11y.pagination': 'Page {current} of {total}',
    // GDPR
    'gdpr.export': 'Export My Data',
    'gdpr.delete': 'Delete My Data',
    'gdpr.consent': 'Manage Consent',
    'gdpr.privacy': 'Privacy Settings',
    'gdpr.export_desc': 'Download all your personal data',
    'gdpr.delete_desc': 'Permanently delete your account and data',
    'gdpr.delete_confirm': 'Type DELETE_MY_DATA to confirm',
  },
  hi: {
    'nav.home': 'होम',
    'nav.search': 'खोजें',
    'nav.matches': 'मैच',
    'nav.interests': 'रुचियां',
    'nav.messages': 'संदेश',
    'nav.shortlist': 'शॉर्टलिस्ट',
    'nav.profile': 'मेरी प्रोफ़ाइल',
    'nav.settings': 'सेटिंग्स',
    'nav.logout': 'लॉग आउट',
    'nav.admin': 'एडमिन',
    'nav.dashboard': 'डैशबोर्ड',
    'auth.login': 'लॉगिन',
    'auth.register': 'रजिस्टर',
    'auth.email': 'ईमेल',
    'auth.password': 'पासवर्ड',
    'auth.forgot_password': 'पासवर्ड भूल गए?',
    'auth.login_button': 'साइन इन करें',
    'auth.register_button': 'अकाउंट बनाएं',
    'search.title': 'प्रोफ़ाइल खोजें',
    'search.filters': 'फ़िल्टर',
    'search.clear_filters': 'फ़िल्टर हटाएं',
    'search.no_results': 'कोई प्रोफ़ाइल नहीं मिली',
    'search.start_searching': 'खोजना शुरू करें',
    'search.loading': 'प्रोफ़ाइल लोड हो रही हैं...',
    'search.results_count': '{count} प्रोफ़ाइल मिलीं',
    'profile.view': 'प्रोफ़ाइल देखें',
    'profile.send_interest': 'रुचि भेजें',
    'profile.shortlist': 'शॉर्टलिस्ट',
    'profile.verified': 'सत्यापित',
    'profile.premium': 'प्रीमियम',
    'profile.online': 'ऑनलाइन',
    'profile.offline': 'ऑफलाइन',
    'profile.match_score': '{score}% मैच',
    'messages.title': 'संदेश',
    'messages.type_placeholder': 'संदेश टाइप करें...',
    'messages.send': 'भेजें',
    'common.save': 'सेव करें',
    'common.cancel': 'रद्द करें',
    'common.delete': 'हटाएं',
    'common.edit': 'संपादित करें',
    'common.close': 'बंद करें',
    'common.loading': 'लोड हो रहा है...',
    'common.error': 'कुछ गलत हो गया',
    'common.success': 'सफल!',
    'common.back': 'वापस',
    'common.next': 'अगला',
    'common.previous': 'पिछला',
    'a11y.skip_to_content': 'मुख्य सामग्री पर जाएं',
    'a11y.menu_open': 'नेविगेशन मेनू खोलें',
    'a11y.menu_close': 'नेविगेशन मेनू बंद करें',
    'a11y.profile_card': '{name} की प्रोफ़ाइल कार्ड',
    'a11y.notification': '{count} अपठित सूचनाएं',
    'a11y.messages_unread': '{count} अपठित संदेश',
  },
  gu: {
    'nav.home': 'હોમ',
    'nav.search': 'શોધો',
    'nav.matches': 'મેચ',
    'nav.interests': 'રુચિઓ',
    'nav.messages': 'સંદેશ',
    'nav.shortlist': 'શોર્ટલિસ્ટ',
    'nav.profile': 'મારી પ્રોફાઇલ',
    'nav.settings': 'સેટિંગ્સ',
    'nav.logout': 'લૉગ આઉટ',
    'auth.login': 'લૉગિન',
    'auth.register': 'રજિસ્ટર',
    'auth.email': 'ઈમેલ',
    'auth.password': 'પાસવર્ડ',
    'auth.login_button': 'સાઇન ઇન કરો',
    'auth.register_button': 'એકાઉન્ટ બનાવો',
    'search.title': 'પ્રોફાઇલ શોધો',
    'search.filters': 'ફિલ્ટર',
    'search.clear_filters': 'ફિલ્ટર હટાવો',
    'search.no_results': 'કોઈ પ્રોફાઇલ મળી નહીં',
    'search.loading': 'પ્રોફાઇલ લોડ થઈ રહી છે...',
    'profile.view': 'પ્રોફાઇલ જુઓ',
    'profile.send_interest': 'રુચિ મોકલો',
    'profile.shortlist': 'શોર્ટલિસ્ટ',
    'profile.verified': 'ચકાસાયેલ',
    'profile.online': 'ઓનલાઇન',
    'profile.offline': 'ઓફલાઇન',
    'messages.title': 'સંદેશ',
    'messages.type_placeholder': 'સંદેશ ટાઇપ કરો...',
    'messages.send': 'મોકલો',
    'common.save': 'સેવ કરો',
    'common.cancel': 'રદ કરો',
    'common.delete': 'ડિલીટ',
    'common.close': 'બંધ કરો',
    'common.loading': 'લોડ થઈ રહ્યું છે...',
    'common.error': 'કંઈક ખોટું થયું',
    'common.success': 'સફળ!',
    'a11y.skip_to_content': 'મુખ્ય સામગ્રી પર જાઓ',
    'a11y.profile_card': '{name} નું પ્રોફાઇલ કાર્ડ',
  },
  mr: {
    'nav.home': 'मुख्यपृष्ठ',
    'nav.search': 'शोधा',
    'nav.matches': 'जोडी',
    'nav.interests': 'आवड',
    'nav.messages': 'संदेश',
    'nav.shortlist': 'शॉर्टलिस्ट',
    'nav.profile': 'माझी प्रोफाइल',
    'nav.settings': 'सेटिंग्ज',
    'nav.logout': 'लॉग आउट',
    'auth.login': 'लॉगिन',
    'auth.register': 'नोंदणी',
    'auth.email': 'ईमेल',
    'auth.password': 'पासवर्ड',
    'search.title': 'प्रोफाइल शोधा',
    'search.no_results': 'प्रोफाइल सापडली नाही',
    'profile.view': 'प्रोफाइल पहा',
    'profile.verified': 'पडताळलेले',
    'messages.title': 'संदेश',
    'common.save': 'जतन करा',
    'common.cancel': 'रद्द करा',
    'common.close': 'बंद करा',
    'a11y.skip_to_content': 'मुख्य मजकूरावर जा',
  },
  bn: {
    'nav.home': 'হোম',
    'nav.search': 'অনুসন্ধান',
    'nav.matches': 'ম্যাচ',
    'nav.interests': 'আগ্রহ',
    'nav.messages': 'বার্তা',
    'nav.shortlist': 'শর্টলিস্ট',
    'nav.profile': 'আমার প্রোফাইল',
    'nav.settings': 'সেটিংস',
    'nav.logout': 'লগ আউট',
    'auth.login': 'লগইন',
    'auth.register': 'নিবন্ধন',
    'search.title': 'প্রোফাইল খুঁজুন',
    'search.no_results': 'কোনো প্রোফাইল পাওয়া যায়নি',
    'profile.view': 'প্রোফাইল দেখুন',
    'profile.verified': 'যাচাইকৃত',
    'messages.title': 'বার্তা',
    'common.save': 'সংরক্ষণ',
    'common.cancel': 'বাতিল',
    'common.close': 'বন্ধ',
    'a11y.skip_to_content': 'প্রধান বিষয়বস্তুতে যান',
  },
  ta: {
    'nav.home': 'முகப்பு',
    'nav.search': 'தேடல்',
    'nav.matches': 'பொருத்தம்',
    'nav.interests': 'ஆர்வம்',
    'nav.messages': 'செய்தி',
    'nav.shortlist': 'பட்டியல்',
    'nav.profile': 'என் சுயவிவரம்',
    'nav.settings': 'அமைப்புகள்',
    'nav.logout': 'வெளியேறு',
    'auth.login': 'உள்நுழை',
    'auth.register': 'பதிவு செய்',
    'search.title': 'சுயவிவரம் தேடு',
    'search.no_results': 'சுயவிவரம் எதுவும் கிடைக்கவில்லை',
    'profile.view': 'சுயவிவரம் பார்',
    'profile.verified': 'சரிபார்க்கப்பட்ட',
    'messages.title': 'செய்தி',
    'common.save': 'சேமி',
    'common.cancel': 'ரத்து',
    'common.close': 'மூடு',
    'a11y.skip_to_content': 'முக்கிய உள்ளடக்கத்திற்குச் செல்',
  },
  te: {
    'nav.home': 'హోమ్',
    'nav.search': 'వెతకండి',
    'nav.matches': 'మ్యాచ్',
    'nav.interests': 'ఆసక్తి',
    'nav.messages': 'సందేశం',
    'nav.shortlist': 'షార్ట్‌లిస్ట్',
    'nav.profile': 'నా ప్రొఫైల్',
    'nav.settings': 'సెట్టింగ్స్',
    'nav.logout': 'లాగ్ అవుట్',
    'auth.login': 'లాగిన్',
    'auth.register': 'నమోదు',
    'search.title': 'ప్రొఫైల్ వెతకండి',
    'search.no_results': 'ప్రొఫైల్ ఏదీ కనుగొనబడలేదు',
    'profile.view': 'ప్రొఫైల్ చూడండి',
    'profile.verified': 'ధృవీకరించబడింది',
    'messages.title': 'సందేశం',
    'common.save': 'సేవ్',
    'common.cancel': 'రద్దు',
    'common.close': 'మూసివేయి',
    'a11y.skip_to_content': 'ప్రధాన విషయానికి వెళ్ళండి',
  },
  kn: {
    'nav.home': 'ಮುಖಪುಟ',
    'nav.search': 'ಹುಡುಕು',
    'nav.matches': 'ಹೊಂದಾಣಿಕೆ',
    'nav.interests': 'ಆಸಕ್ತಿ',
    'nav.messages': 'ಸಂದೇಶ',
    'nav.shortlist': 'ಶಾರ್ಟ್‌ಲಿಸ್ಟ್',
    'nav.profile': 'ನನ್ನ ಪ್ರೊಫೈಲ್',
    'nav.settings': 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    'nav.logout': 'ಲಾಗ್ ಔಟ್',
    'auth.login': 'ಲಾಗಿನ್',
    'auth.register': 'ನೋಂದಣಿ',
    'search.title': 'ಪ್ರೊಫೈಲ್ ಹುಡುಕಿ',
    'search.no_results': 'ಯಾವುದೇ ಪ್ರೊಫೈಲ್ ಸಿಗಲಿಲ್ಲ',
    'profile.view': 'ಪ್ರೊಫೈಲ್ ನೋಡಿ',
    'profile.verified': 'ಪರಿಶೀಲಿಸಲಾಗಿದೆ',
    'messages.title': 'ಸಂದೇಶ',
    'common.save': 'ಉಳಿಸಿ',
    'common.cancel': 'ರದ್ದುಮಾಡಿ',
    'common.close': 'ಮುಚ್ಚಿ',
    'a11y.skip_to_content': 'ಮುಖ್ಯ ವಿಷಯಕ್ಕೆ ಹೋಗಿ',
  },
};

// Translation function with parameter interpolation
function translate(locale: Locale, fallbackLocale: Locale, key: string, params?: Record<string, string | number>): string {
  let value = translations[locale]?.[key] || translations[fallbackLocale]?.[key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      value = value.replace(`{${k}}`, String(v));
    });
  }
  return value;
}

// I18n Provider Component (memoized context value to prevent app-wide re-renders)
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultConfig.locale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('app-locale', newLocale);
    document.documentElement.lang = newLocale;
    announce(`Language changed to ${AVAILABLE_LOCALES.find(l => l.code === newLocale)?.nativeName || newLocale}`, 'assertive');
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    return translate(locale, defaultConfig.fallbackLocale, key, params);
  }, [locale]);

  // Memoize context value to prevent re-rendering entire app tree
  const contextValue = useMemo(() => ({ locale, setLocale, t, locales: AVAILABLE_LOCALES }), [locale, setLocale, t]);

  // Set initial document lang
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

// Language Switcher Component
export function LanguageSwitcher() {
  const { locale, setLocale, locales } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const currentLocale = locales.find(l => l.code === locale);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Current language: ${currentLocale?.nativeName}. Change language.`}
      >
        <span className="text-base">{locale === 'en' ? '🌐' : locale === 'hi' ? '🇮🇳' : '🌐'}</span>
        <span className="hidden sm:inline">{currentLocale?.nativeName}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50"
          role="listbox"
          aria-label="Select language"
        >
          {locales.map(l => (
            <button
              key={l.code}
              role="option"
              aria-selected={l.code === locale}
              onClick={() => { setLocale(l.code); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                l.code === locale ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="font-medium">{l.nativeName}</span>
              <span className="text-gray-400 text-xs">({l.name})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
