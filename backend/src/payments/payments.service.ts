import { Injectable, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(private prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2024-06-20',
    });
  }

  async createPaymentIntent(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) throw new BadRequestException('Order not found');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is not payable');
    }

    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(Number(order.totalAmount) * 100),
      currency: 'usd',
      metadata: { orderId: order.id },
    });

    await this.prisma.payment.upsert({
      where: { orderId: order.id },
      update: {
        providerRef: intent.id,
        amount: order.totalAmount,
        status: PaymentStatus.PENDING,
      },
      create: {
        orderId: order.id,
        provider: 'stripe',
        providerRef: intent.id,
        amount: order.totalAmount,
        status: PaymentStatus.PENDING,
      },
    });

    return { clientSecret: intent.client_secret };
  }

  async handleWebhook(signature: string, rawBody: Buffer) {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || '',
      );
    } catch (err) {
      throw new BadRequestException('Invalid webhook signature');
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      await this.markOrderPaid(intent.metadata.orderId);
    } else if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent;
      await this.prisma.payment.update({
        where: { orderId: intent.metadata.orderId },
        data: { status: PaymentStatus.FAILED },
      });
    }

    return { received: true };
  }

  private async markOrderPaid(orderId: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order || order.status === OrderStatus.PAID) return;

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PAID },
      });
      await tx.payment.update({
        where: { orderId },
        data: { status: PaymentStatus.SUCCEEDED },
      });

      for (const item of order.items) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: {
            quantity: { decrement: item.quantity },
            reserved: { decrement: item.quantity },
          },
        });
        const inventory = await tx.inventory.findUnique({
          where: { productId: item.productId },
        });
        if (inventory) {
          await tx.stockMovement.create({
            data: {
              inventoryId: inventory.id,
              type: 'SALE',
              quantity: -item.quantity,
              reason: `Order ${orderId}`,
            },
          });
        }
      }
    });
  }
}
