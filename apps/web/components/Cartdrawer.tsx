 'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, X, Plus, Minus, Trash2 } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

function getImageUrl(image?: string): string | undefined {
  if (!image) return undefined;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  const api =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
    'http://localhost:3005';
  return `${api}${image.startsWith('/') ? '' : '/'}${image}`;
}

export default function CartDrawer() {
  const [open, setOpen] = useState(false);
  const { items, count, total, removeItem, updateQuantity, clearCart } = useCart();
  const router = useRouter();

  const handleCheckout = () => {
    setOpen(false);
    router.push('/today-cement-rate-in-pakistan/checkout');
  };

  return (
    <>
      {/* Floating Cart Button — smaller, less radius */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 bg-gray-900 hover:bg-black text-white rounded-lg w-11 h-11 flex items-center justify-center shadow-lg transition-all hover:scale-105"
        title="View Cart"
      >
        <ShoppingCart className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold rounded w-4 h-4 flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-[998]" onClick={() => setOpen(false)} />
      )}

      {/* Drawer — narrower */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-xs bg-white z-[999] shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-900 text-white">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            <h2 className="font-semibold text-sm">Cart ({count})</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="hover:bg-white/20 rounded p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <ShoppingCart className="w-12 h-12 opacity-20" />
              <p className="text-sm font-medium">Your cart is empty</p>
              <p className="text-xs text-gray-400">Browse cement rates and add items</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="bg-gray-50 border border-gray-100 rounded p-2.5 flex gap-2.5 items-start">
                {/* Image */}
                <div className="w-12 h-12 rounded overflow-hidden bg-gray-200 flex-shrink-0">
                  {item.image ? (
                    <img
                      src={getImageUrl(item.image)}
                      alt={item.brand}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const t = e.currentTarget as HTMLImageElement;
                        t.style.display = 'none';
                        const fb = t.nextElementSibling as HTMLElement;
                        if (fb) fb.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className="w-full h-full items-center justify-center text-gray-400 text-xs font-bold"
                    style={{ display: item.image ? 'none' : 'flex' }}
                  >
                    {item.brand.slice(0, 2).toUpperCase()}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-xs truncate">{item.brand}</p>
                  <p className="text-[10px] text-gray-400">{item.city} · {item.weightKg} Kg</p>
                  <p className="text-gray-800 font-bold text-xs mt-0.5">Rs {item.price.toLocaleString()}</p>

                  {/* Qty Controls */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="text-xs font-semibold w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <p className="text-xs font-bold text-gray-900">
                    Rs {(item.price * item.quantity).toLocaleString()}
                  </p>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors mt-1"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Total ({count} bags)</span>
              <span className="text-lg font-black text-gray-900">Rs {total.toLocaleString()}</span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full bg-gray-900 hover:bg-black text-white font-semibold text-sm py-2.5 rounded transition-colors"
            >
              Proceed to Payment
            </button>
            <button
              onClick={clearCart}
              className="w-full text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}