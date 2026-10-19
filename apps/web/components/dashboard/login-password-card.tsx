"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataCard, DataCardTitle } from "@/components/dashboard";
import { apiErrorMessage } from "@/components/dashboard/api-error";

interface Status {
  email: string;
  hasPassword: boolean;
  google: boolean;
}

/**
 * My Account → "Login & password".
 *
 * An account made with "Continue with Google" has no password; setting one
 * here lets the same account sign in with email + password as well. An account
 * with a password changes it here (the current one is required).
 */
export function LoginPasswordCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/auth/password")
      .then((res) => setStatus(res.data))
      .catch(() => setStatus(null));
  }, []);

  if (!status) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 6) return toast.error("Use at least 6 characters for your password");
    if (next !== confirm) return toast.error("The two passwords do not match");
    setSaving(true);
    try {
      const res = await api.post("/auth/password", { currentPassword: status.hasPassword ? current : undefined, newPassword: next });
      toast.success(res.data?.message ?? "Password saved");
      setStatus({ ...status, hasPassword: true });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save the password"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DataCard>
      <DataCardTitle hint="How you sign in to this account">Login &amp; password</DataCardTitle>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{status.email}</span>
        {status.google && <Badge variant="secondary">Google connected</Badge>}
        <Badge variant={status.hasPassword ? "secondary" : "outline"}>{status.hasPassword ? "Password set" : "No password yet"}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {status.hasPassword
          ? status.google
            ? "You can sign in with Google or with your email and password — both open this same account."
            : "You sign in with your email and password. “Continue with Google” with this same email also opens this account."
          : "You sign in with Google. Set a password to also sign in with your email and password — it stays one account."}
      </p>
      <form onSubmit={submit} className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
        {status.hasPassword && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pw-current">Current password</Label>
            <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="pw-new">{status.hasPassword ? "New password" : "Password"}</Label>
          <Input id="pw-new" type="password" autoComplete="new-password" minLength={6} value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm">Confirm password</Label>
          <Input id="pw-confirm" type="password" autoComplete="new-password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            {status.hasPassword ? "Change password" : "Set password"}
          </Button>
        </div>
      </form>
    </DataCard>
  );
}
