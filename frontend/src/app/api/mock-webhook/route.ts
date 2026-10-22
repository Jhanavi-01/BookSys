import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { txnId, amount, orderNumber, status } = body;

  const webhookBody = JSON.stringify({
    eventType: 'payment.completed',
    transactionId: txnId,
    amount: parseInt(amount),
    status: status === 'success' ? 'succeeded' : 'failed',
    orderNumber,
  });

  // Use the same secret the backend uses (default: 'mock-secret')
  const secret = process.env.PAYMENT_WEBHOOK_SECRET || 'mock-secret';
  const signature = crypto
    .createHmac('sha256', secret)
    .update(webhookBody)
    .digest('hex');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  try {
    const res = await fetch(`${apiUrl}/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': signature,
      },
      body: webhookBody,
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
