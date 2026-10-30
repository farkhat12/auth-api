// common/phone-throttler.guard.ts
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { normalizePhone } from '../shared/utils/phone-normalizer';

@Injectable()
export class PhoneThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return normalizePhone(String(req.body?.phone ?? '')) ?? req.ip;
  }
}
