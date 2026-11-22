import { Controller, Get } from '@nestjs/common';
import { ApartmentsService } from './apartments.service';

@Controller('apartments')
export class ApartmentsController {
  constructor(private readonly apartmentsService: ApartmentsService) {}
  // --------- Get all apartments ---------
  @Get()
  findAll() {
    return this.apartmentsService.findAll();
  }
}
