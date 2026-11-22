import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty({ message: 'Телефон нөмірі бос болмауы тиіс' })
  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: 'Phone must be a valid Uzbekistan phone number',
  })
  phone: string;

  @IsNotEmpty({ message: 'OTP коды бос болмауы тиіс' })
  @IsString({ message: 'OTP коды жолдық (string) форматта болуы тиіс' })
  @Matches(/^\d{6}$/, { message: 'OTP коды тек 6 саннан тұруы тиіс' })
  otp: string;
}
