import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ForWhom, RentType, ApartmentStatus } from '../enums/apartment.enum';
export type ApartmentDocument = HydratedDocument<Apartment>;

@Schema({ timestamps: true })
export class Apartment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;
  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  ownerName: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ required: true, trim: true })
  orienteer: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true, min: 1 })
  rooms: number;

  @Prop({ required: true, enum: RentType })
  rentType: RentType;

  @Prop({ required: true, enum: ForWhom })
  forWhom: ForWhom;

  @Prop({
    required: true,
    enum: ApartmentStatus,
    default: ApartmentStatus.ACTIVE,
  })
  status: ApartmentStatus;

  @Prop({ type: [String], default: [] })
  amenities: string[];

  @Prop({
    type: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
    default: [],
  })
  images: {
    url: string;
    publicId: string;
  }[];
}

export const ApartmentSchema = SchemaFactory.createForClass(Apartment);

ApartmentSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
