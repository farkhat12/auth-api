import { IsString, Matches } from 'class-validator';

export class PhoneDto {
  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: 'Phone must be a valid Uzbekistan phone number',
  })
  phone: string;
}
