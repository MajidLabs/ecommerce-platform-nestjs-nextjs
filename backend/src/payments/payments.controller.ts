import {
  Controller,
  Post,
  Req,
  Headers,
  UseGuards,
  Param,
  RawBodyRequest,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('intent/:orderId')
  createIntent(@Param('orderId') orderId: string, @CurrentUser() user: any) {
    return this.paymentsService.createPaymentIntent(orderId, user.userId);
  }

  @Post('webhook')
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    // `rawBody` is typed optional because it only exists when the request
    // actually arrived with a body Nest could buffer. Stripe's signature
    // check needs the exact unparsed bytes, so a missing body is a bad
    // request, not something to pass through as `undefined` and let the
    // Stripe SDK fail with a confusing internal error.
    if (!req.rawBody) {
      throw new BadRequestException('Missing request body');
    }
    return this.paymentsService.handleWebhook(signature, req.rawBody);
  }
}
