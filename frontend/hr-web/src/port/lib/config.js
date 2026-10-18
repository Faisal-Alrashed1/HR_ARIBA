// ADAPTED: no Supabase address or key — the site talks only to our server (NEXT_PUBLIC_API_URL, src/lib/api.ts).
export const IDLE_MS = 5 * 60 * 1000;      // تنبيه الخمول بعد 5 دقائق
export const WARN_MS = 3 * 60 * 1000;      // مهلة القرار 3 دقائق
export const MAX_LIFETIME_MS = 24 * 3600 * 1000;
export const PROMPT_AT = 150000;           // قبل انتهاء الـJWT بـ150 ثانية
