import * as crypto from 'crypto';

export class OtpUtils {
  static generateOtp(length = 6): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return crypto.randomInt(min, max + 1).toString();
  }

  static hashOtp(code: string, secretSalt = ''): string {
    return crypto.createHmac('sha256', secretSalt).update(code).digest('hex');
  }

  static verifyCodeHash(
    rawCode: string,
    storedHash: string,
    secretSalt = '',
  ): boolean {
    const inputHash = this.hashOtp(rawCode, secretSalt);
    const inputBuffer = Buffer.from(inputHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');

    if (inputBuffer.length !== storedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(inputBuffer, storedBuffer);
  }

  static isExpired(expiresAtTimestamp: string | number): boolean {
    const expiresAt =
      typeof expiresAtTimestamp === 'string'
        ? parseInt(expiresAtTimestamp, 10)
        : expiresAtTimestamp;

    return Date.now() > expiresAt;
  }
}
