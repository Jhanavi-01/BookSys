'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

export default function MockPaymentPage() {
  const searchParams = useSearchParams();
  const txnId = searchParams.get('txnId') || '';
  const amount = searchParams.get('amount') || '0';
  const orderNumber = searchParams.get('orderNumber') || '';
  const returnUrl = searchParams.get('returnUrl') || '/';

  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const handlePayment = async (success: boolean) => {
    setProcessing(true);

    try {
      // Call server-side API route to send webhook (avoids CORS)
      await fetch('/api/mock-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txnId,
          amount,
          orderNumber,
          status: success ? 'success' : 'failed',
        }),
      });
    } catch (err) {
      console.error('Webhook error:', err);
    }

    setDone(true);

    // Redirect back after a short delay
    setTimeout(() => {
      window.location.href = returnUrl;
    }, 1500);
  };

  const formattedAmount = parseInt(amount).toLocaleString('vi-VN');

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center bg-dark-950 px-4">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl p-8">
          {/* Header */}
          <div className="mb-6 border-b border-white/10 pb-4 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
              <span className="text-2xl">🏦</span>
            </div>
            <h1 className="text-lg font-bold text-gray-100">Mock Payment Gateway</h1>
            <p className="mt-1 text-xs text-gray-500">Development / Testing Only</p>
          </div>

          {!done ? (
            <>
              {/* Order Details */}
              <div className="mb-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Order</span>
                  <span className="font-mono text-gray-300">{orderNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Transaction</span>
                  <span className="font-mono text-xs text-gray-400">{txnId.slice(0, 20)}...</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-3">
                  <span className="font-medium text-gray-300">Amount</span>
                  <span className="text-xl font-bold text-accent-400">₫{formattedAmount}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => handlePayment(true)}
                  disabled={processing}
                  className="flex-1 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-green-500 disabled:opacity-50"
                >
                  {processing ? '...' : '✓ Pay Successfully'}
                </button>
                <button
                  onClick={() => handlePayment(false)}
                  disabled={processing}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                >
                  {processing ? '...' : '✕ Fail Payment'}
                </button>
              </div>
            </>
          ) : (
            <div className="py-4 text-center">
              <CheckCircleIcon className="mx-auto h-12 w-12 text-green-400" />
              <p className="mt-3 text-gray-300">Redirecting back...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
