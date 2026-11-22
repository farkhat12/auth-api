import { Injectable } from '@nestjs/common';
import { Apartment, ApartmentDocument } from './schemas/apartment.schema';
import { ApartmentStatus } from './enums/apartment.enum';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class ApartmentsService {
  constructor(
    @InjectModel(Apartment.name)
    private readonly apartmentModel: Model<ApartmentDocument>,
  ) {}
  async findAll(): Promise<Apartment[]> {
    return this.apartmentModel
      .find({ status: ApartmentStatus.ACTIVE })
      .sort({ createdAt: -1 })
      .lean();
  }
}
