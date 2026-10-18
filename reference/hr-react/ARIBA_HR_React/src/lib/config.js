export const SUPA = import.meta.env.VITE_SUPABASE_URL || 'https://iwviydmapqpqihcdazpe.supabase.co';
export const KEY = import.meta.env.VITE_SUPABASE_KEY || 'REDACTED_PUBLISHABLE_KEY';
export const DOMAIN = import.meta.env.VITE_AUTH_EMAIL_DOMAIN || '@accounts.hr.ariba.com.sa';
export const IDLE_MS = 5 * 60 * 1000;      // تنبيه الخمول بعد 5 دقائق
export const WARN_MS = 3 * 60 * 1000;      // مهلة القرار 3 دقائق
export const MAX_LIFETIME_MS = 24 * 3600 * 1000;
export const PROMPT_AT = 150000;           // قبل انتهاء الـJWT بـ150 ثانية
