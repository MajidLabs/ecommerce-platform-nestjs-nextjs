import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.STAFF)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('summary')
  summary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.salesSummary(startDate, endDate);
  }

  @Get('revenue-by-day')
  revenueByDay(@Query('days') days?: string) {
    return this.reportsService.revenueByDay(days ? Number(days) : undefined);
  }

  @Get('top-products')
  topProducts(@Query('limit') limit?: string) {
    return this.reportsService.topProducts(limit ? Number(limit) : undefined);
  }

  @Get('low-stock')
  lowStock() {
    return this.reportsService.lowStock();
  }
}
