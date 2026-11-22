export enum OtpPurpose {
  REGISTER = 'register',
  FORGOT_PASSWORD = 'forgot-password',
  UPLOAD_APARTMENT = 'upload-apartment',
  PHONE_VERIFICATION = 'phone-verification',
}

export const OtpKeys = {
  otp: (p: OtpPurpose, phone: string) => `otp:${p}:${phone}`,
  attempts: (p: OtpPurpose, phone: string) => `otp:attempts:${p}:${phone}`,
  cooldown: (p: OtpPurpose, phone: string) => `otp:cooldown:${p}:${phone}`,
  block: (p: OtpPurpose, phone: string) => `otp:block:${p}:${phone}`,
  hourlyLimit: (p: OtpPurpose, phone: string) =>
    `otp:hourly_limit:${p}:${phone}`,
};

// TTLs
export const OTP_EXPIRES_IN = 2 * 60;
export const OTP_REDIS_TTL = 10 * 60;
export const OTP_BLOCK_TTL = 15 * 60;
export const OTP_COOLDOWN = (1 * 60) / 2;

export const MAX_VERIFY_ATTEMPTS = 3;
export const OTP_MAX_ATTEMPTS = 5;
export const MAX_RESEND_ATTEMPTS = 5;
export const HOURLY_LIMIT = 5;
