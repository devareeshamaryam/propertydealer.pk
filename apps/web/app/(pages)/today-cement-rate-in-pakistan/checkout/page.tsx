 'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import Link from 'next/link';
import { CheckCircle2, ChevronLeft, Loader2 } from 'lucide-react';
import cementOrderApi from '@/lib/api/cement-order/cement-order.api';
import { toast } from 'sonner';

export default function CheckoutPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [deliveryInstruction, setDeliveryInstruction] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');

  const [loading, setLoading] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName || !customerPhone || !address) {
      toast.error('Please fill in all required customer details.');
      return;
    }

    try {
      setLoading(true);

      const payload = {
        customerName: customerName.trim(),
        customerEmail: user?.email ?? '',
        userId: (user as any)?.userId,
        customerPhone,
        address,
        deliveryInstruction,
        paymentMethod,
      };

      await cementOrderApi.createOrder(payload as any);

      setOrderComplete(true);
      toast.success('Order placed successfully!');
    } catch (err: any) {
      toast.error('Error placing order', {
        description: err?.response?.data?.message || 'Something went wrong.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (orderComplete) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Received!</h2>
        <p className="text-lg text-gray-700 font-medium mb-6">
          The Admin will Contact you for order confirmation
        </p>
        <Link href="/" className="bg-black hover:bg-gray-800 text-white px-8 py-3 rounded font-medium transition-colors">
          Continue Shopping
        </Link>
      </div>
    );
  }

  if (isAuthLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-black mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Checking Session...</h2>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Sign In Required</h2>
        <p className="text-gray-500 mb-6 text-center max-w-sm">
          You must be signed in to place a cement order.
        </p>
        <Link href="/login" className="bg-black hover:bg-gray-800 text-white px-8 py-3 rounded font-medium transition-colors">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="max-w-3xl mx-auto px-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-500 hover:text-black transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-black">Checkout</h1>
        </div>

        <form onSubmit={handlePlaceOrder} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-6">

          {/* Customer Details */}
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <h3 className="font-semibold text-black mb-4 text-sm sm:text-base">Customer Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Full Name *</label>
                <input
                  required
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ali Sher"
                  className="w-full border border-gray-200 rounded p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Phone Number *</label>
                <input
                  required
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0300 1234567"
                  className="w-full border border-gray-200 rounded p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Full Delivery Address *</label>
                <textarea
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House 123, Street 4, Lahore"
                  className="w-full border border-gray-200 rounded p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <h3 className="font-semibold text-black mb-2 text-sm sm:text-base">Delivery Instructions</h3>
            <textarea
              value={deliveryInstruction}
              onChange={(e) => setDeliveryInstruction(e.target.value)}
              placeholder="Instructions for delivery team (Optional)."
              className="w-full border border-gray-200 rounded p-3 text-sm focus:outline-none focus:ring-1 focus:ring-black min-h-20 resize-y"
            />
          </div>

          {/* Payment Method */}
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <h3 className="font-semibold text-black mb-4 text-sm sm:text-base">Payment Method</h3>
            <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-300 bg-gray-50 rounded">
              <input
                type="radio"
                name="payment"
                value="cod"
                checked={paymentMethod === 'cod'}
                onChange={() => setPaymentMethod('cod')}
                className="w-4 h-4 text-black border-gray-400 focus:ring-black"
              />
              <span className="font-medium text-black text-sm">Cash on Delivery (COD)</span>
            </label>
          </div>

          {/* Action Button */}
          <div className="p-4 sm:p-6 bg-gray-50">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white font-bold text-sm sm:text-base py-4 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              <span>PLACE ORDER</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}