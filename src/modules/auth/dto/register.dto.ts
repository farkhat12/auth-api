import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: 'Phone must be a valid Uzbekistan phone number',
  })
  phone: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}
