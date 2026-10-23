"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { cityApi, userApi } from "@/lib/api";
import { apiErrorMessage } from "@/components/dashboard/api-error";

/**
 * Every agent and agency works in a city, and is listed on that city's
 * property dealers page. The sign-up form asks for it; an account made with
 * "Continue with Google", or before the question existed, is asked here once,
 * the first time it opens the dashboard.
 */
export function CityPrompt() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [cities, setCities] = useState<{ _id: string; name: string }[]>([]);
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || user.role === "ADMIN") return;
    let cancelled = false;
    (async () => {
      try {
        const me = (await userApi.getMe()) as { city?: unknown } | null;
        if (cancelled || !me || me.city) return;
        const list = await cityApi.getNames();
        if (cancelled || !list.length) return;
        setCities([...list].sort((a, b) => a.name.localeCompare(b.name)));
        setOpen(true);
      } catch {
        // Not now — the account page still asks.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const save = async () => {
    if (!city) return;
    setSaving(true);
    try {
      await userApi.updateMe({ city });
      setOpen(false);
      toast.success("City saved", { description: "You are now listed on your city's property dealers page." });
    } catch (err) {
      toast.error("Could not save your city", { description: apiErrorMessage(err, "Please try again.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Which city do you work in?
          </DialogTitle>
          <DialogDescription>
            Your profile is listed on that city&apos;s property dealers page, where buyers look for an agent. You can change it later in My Account.
          </DialogDescription>
        </DialogHeader>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          aria-label="Your city"
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Choose your city</option>
          {cities.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button className="h-11 w-full" onClick={() => void save()} disabled={!city || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save my city
        </Button>
      </DialogContent>
    </Dialog>
  );
}
