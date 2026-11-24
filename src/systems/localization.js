/**
 * localization.js - EN / AR strings, live DOM translation and RTL support.
 */

export const LANGS = ['en', 'ar'];

const STRINGS = {
  en: {
    'app.title': 'COLORLINK',
    'app.logo1': 'COLOR',
    'app.logo2': 'LINK',
    'app.tagline': 'Connect every pair. Clear the board.',
    'app.version': 'Version 1.0.0',

    'menu.level': 'Level',
    'menu.completed': 'Done',
    'menu.progress': 'Progress',
    'menu.play': 'Play',
    'menu.continue': 'Continue',
    'menu.levels': 'Levels',
    'menu.stats': 'Stats',
    'menu.settings': 'Settings',

    'levels.title': 'Select Level',
    'levels.locked': 'Locked',

    'settings.title': 'Settings',
    'settings.audio': 'Audio',
    'settings.sfx': 'Sound effects',
    'settings.music': 'Background music',
    'settings.vibrate': 'Vibration',
    'settings.language': 'App language',
    'settings.languageGroup': 'Language',
    'settings.theme': 'Appearance',
    'settings.themeGroup': 'Theme',
    'settings.danger': 'Danger zone',
    'settings.reset': 'Reset progress',
    'settings.resetAction': 'Reset',
    'settings.light': 'Light',
    'settings.dark': 'Dark',

    'stats.title': 'Statistics',
    'stats.completed': 'Levels completed',
    'stats.playtime': 'Total playtime',
    'stats.best': 'Best level time',
    'stats.hints': 'Hints used',
    'stats.runs': 'Runs',
    'stats.difficulty': 'By difficulty',
    'stats.easy': 'Easy',
    'stats.normal': 'Normal',
    'stats.hard': 'Hard',
    'stats.expert': 'Expert',

    'game.level': 'Level',
    'game.tip': 'Drag from a dot to its twin. Paths never cross.',

    'win.title': 'Level Complete!',
    'win.replay': 'Replay',
    'win.levels': 'Levels',
    'win.next': 'Next',

    'hint.none': 'No hints left for this level',
    'hint.applied': 'Here is a valid connection',
    'hint.all': 'All pairs are already connected',
    'toast.saved': 'Progress saved',
    'toast.reset': 'Progress has been reset',
    'toast.sound.on': 'Sound on',
    'toast.sound.off': 'Sound off',
    'toast.levelLocked': 'Finish the previous level first',
    'toast.lastLevel': 'You finished every level!',
    'toast.resetConfirm': 'Reset all progress, levels and settings?',
    'dialog.title': 'Reset progress',
    'dialog.cancel': 'Cancel',
    'dialog.confirm': 'Reset',
    'time.hours': 'h',
    'time.minutes': 'm',
    'time.seconds': 's',
  },

  ar: {
    'app.title': 'كولورلينك',
    'app.logo1': 'كولور',
    'app.logo2': 'لينك',
    'app.tagline': 'وصّل كل زوج. أفرغ اللوح.',
    'app.version': 'الإصدار ١.٠.٠',

    'menu.level': 'المستوى',
    'menu.completed': 'مكتمل',
    'menu.progress': 'التقدم',
    'menu.play': 'ابدأ اللعب',
    'menu.continue': 'متابعة',
    'menu.levels': 'المستويات',
    'menu.stats': 'الإحصائيات',
    'menu.settings': 'الإعدادات',

    'levels.title': 'اختر المستوى',
    'levels.locked': 'مقفل',

    'settings.title': 'الإعدادات',
    'settings.audio': 'الصوت',
    'settings.sfx': 'المؤثرات الصوتية',
    'settings.music': 'الموسيقى الخلفية',
    'settings.vibrate': 'الاهتزاز',
    'settings.language': 'لغة التطبيق',
    'settings.languageGroup': 'اللغة',
    'settings.theme': 'المظهر',
    'settings.themeGroup': 'السمة',
    'settings.danger': 'منطقة الخطر',
    'settings.reset': 'مسح التقدم',
    'settings.resetAction': 'مسح',
    'settings.light': 'فاتح',
    'settings.dark': 'داكن',

    'stats.title': 'الإحصائيات',
    'stats.completed': 'المستويات المكتملة',
    'stats.playtime': 'إجمالي وقت اللعب',
    'stats.best': 'أفضل زمن مستوى',
    'stats.hints': 'التلميحات المستخدمة',
    'stats.runs': 'عدد المحاولات',
    'stats.difficulty': 'حسب الصعوبة',
    'stats.easy': 'سهل',
    'stats.normal': 'عادي',
    'stats.hard': 'صعب',
    'stats.expert': 'خبير',

    'game.level': 'المستوى',
    'game.tip': 'اسحب من نقطة إلى نقطتها المتماثلة. المسارات لا تتقاطع.',

    'win.title': 'اكتمل المستوى!',
    'win.replay': 'إعادة',
    'win.levels': 'المستويات',
    'win.next': 'التالي',

    'hint.none': 'لا توجد تلميحات متبقية لهذا المستوى',
    'hint.applied': 'إليك اتصالاً صحيحاً',
    'hint.all': 'جميع الأزواج متصلة بالفعل',
    'toast.saved': 'تم حفظ التقدم',
    'toast.reset': 'تم مسح التقدم',
    'toast.sound.on': 'الصوت يعمل',
    'toast.sound.off': 'الصوت مكتوم',
    'toast.levelLocked': 'أكمل المستوى السابق أولاً',
    'toast.lastLevel': 'أكملت جميع المستويات!',
    'toast.resetConfirm': 'هل تريد مسح كل التقدم والمستويات والإعدادات؟',
    'dialog.title': 'مسح التقدم',
    'dialog.cancel': 'إلغاء',
    'dialog.confirm': 'مسح',
    'time.hours': 'س',
    'time.minutes': 'د',
    'time.seconds': 'ث',
  },
};

let current = 'en';

export function t(key, fallback = '') {
  const dict = STRINGS[current] || STRINGS.en;
  if (dict[key] !== undefined) return dict[key];
  return STRINGS.en[key] !== undefined ? STRINGS.en[key] : (fallback || key);
}

export function getLang() { return current; }
export function isRTL() { return current === 'ar'; }

/** Applies the language to the whole document (text + direction). */
export function setLang(lang) {
  current = LANGS.includes(lang) ? lang : 'en';
  const html = document.documentElement;
  html.lang = current;
  html.dir = isRTL() ? 'rtl' : 'ltr';
  applyTranslations();
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: current } }));
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val !== undefined && val !== '') el.textContent = val;
  });
}
