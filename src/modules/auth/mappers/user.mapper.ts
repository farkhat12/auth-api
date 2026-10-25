import { UserDocument } from '../../users/schemas/user.schema';

export interface UserResponse {
  id: string;
  name: string;
  phone: string;
  role: string;
}

export function toUserResponse(user: UserDocument): UserResponse {
  return {
    id: user._id.toString(),
    name: user.name,
    phone: user.phone,
    role: user.role,
  };
}
