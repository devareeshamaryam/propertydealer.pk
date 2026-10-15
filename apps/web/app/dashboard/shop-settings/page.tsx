"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard";
import { Field, SaveButton, SettingsCard, TextField, ToggleRow, useSettingsForm } from "@/components/dashboard/settings-form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import type { SiteSettings } from "@/lib/site-settings";

/**
 * Settings → Shop: whether online ordering is open, delivery charges, free
 * delivery threshold, minimum order, payment options and the WhatsApp number
 * orders are confirmed on. The checkout shows these before the buyer
 * commits, and the API applies the same numbers when it prices the order.
 */

const KEYS: (keyof SiteSettings)[] = [
  "shopEnabled", "shopDeliveryFee", "shopFreeDeliveryOver", "shopMinOrder", "shopCodEnabled", "shopOrderNote", "shopWhatsapp",
];

function MoneyField({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: number; onChange: (n: number) => void }) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="relative max-w-xs">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rs</span>
        <Input
          id={id}
          inputMode="numeric"
          value={value ? String(value) : ""}
          placeholder="0"
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0))}
          className="pl-9"
        />
      </div>
    </Field>
  );
}

export default function ShopSettingsPage() {
  const { user } = useAuth();
  const { settings, set, loading, saving, dirty, save } = useSettingsForm();

  if (user && user.role !== "ADMIN") {
    return <p className="p-6 text-sm text-muted-foreground">Only admins can change shop settings.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shop settings"
        description="Online ordering, delivery charges, minimum order and payment options."
        actions={<SaveButton saving={saving} disabled={loading || !dirty} onClick={() => void save(KEYS)} />}
      />
      {loading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <SettingsCard title="Ordering">
            <ToggleRow
              label="Accept online orders"
              hint="Off hides the Add to cart buttons and closes checkout. Rate pages stay up."
              checked={settings.shopEnabled}
              onChange={(v) => set("shopEnabled", v)}
            />
            <ToggleRow
              label="Cash on delivery"
              hint="Off leaves bank transfer / JazzCash as the only option."
              checked={settings.shopCodEnabled}
              onChange={(v) => set("shopCodEnabled", v)}
            />
            <TextField
              id="shopWhatsapp"
              label="Orders WhatsApp number"
              value={settings.shopWhatsapp}
              placeholder="Same as the site's WhatsApp"
              maxLength={30}
              onChange={(v) => set("shopWhatsapp", v)}
              hint="Where “Order on WhatsApp” and “Confirm on WhatsApp” go."
            />
          </SettingsCard>
          <SettingsCard title="Charges">
            <MoneyField id="shopDeliveryFee" label="Delivery charge per order" hint="0 shows “confirmed on call” at checkout." value={settings.shopDeliveryFee} onChange={(n) => set("shopDeliveryFee", n)} />
            <MoneyField id="shopFreeDeliveryOver" label="Free delivery over" hint="0 turns free delivery off." value={settings.shopFreeDeliveryOver} onChange={(n) => set("shopFreeDeliveryOver", n)} />
            <MoneyField id="shopMinOrder" label="Minimum order" hint="0 means no minimum." value={settings.shopMinOrder} onChange={(n) => set("shopMinOrder", n)} />
            <TextField
              id="shopOrderNote"
              label="Note at checkout"
              value={settings.shopOrderNote}
              placeholder="e.g. Delivery within 24 hours in Multan and Lahore"
              maxLength={300}
              onChange={(v) => set("shopOrderNote", v)}
            />
          </SettingsCard>
        </div>
      )}
    </div>
  );
}
