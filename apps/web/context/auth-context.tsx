"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api, { getAccessToken, setAccessToken } from "@/lib/api";
import { toast } from "sonner";

interface User {
  _id: string;
  email: string;
  name?: string;
  role?: string;
  isActive: boolean;
  // Add other fields as needed
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  /** Create the account and sign in without a second trip through /login. */
  registerAndSignIn: (data: {
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  /**
   * Re-issue the token and re-read the user.
   *
   * The role lives inside the JWT, so a role change on the server is invisible
   * to this app until a new token is minted — which is what /auth/refresh
   * does, straight from the database.
   */
  refreshSession: () => Promise<void>;
  /** Finish a redirect-based sign-in (Google) once the API has set its cookies. */
  completeSocialSignIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Reads the claims out of a JWT without verifying it.
 *
 * Used only to render the dashboard shell immediately instead of waiting on
 * /auth/profile — never as an authorisation decision. The API verifies the
 * signature on every request, and `fetchUser()` replaces this with the
 * server's answer as soon as it lands. Returns null for a missing, malformed
 * or expired token so a stale token cannot paint a signed-in shell.
 */
function readUserFromToken(token: string | null): User | null {
  if (!token) return null;
  try {
    const [, payloadSegment] = token.split(".");
    if (!payloadSegment) return null;

    // base64url -> base64, then decode.
    const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
    );

    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
      return null;
    }
    if (!payload.sub || !payload.email) return null;

    return {
      _id: String(payload.sub),
      email: String(payload.email),
      role: payload.role,
      // Absent in older tokens; treat as active and let /auth/profile correct it.
      isActive: payload.isActive !== false,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  /**
   * `/auth/profile` answers straight out of the JWT, so it returns `userId`
   * where every other endpoint returns `_id`. Normalising here means nothing
   * downstream has to know which shape it is holding — before this, anything
   * that needed `user._id` (a link to your own public profile, for instance)
   * silently stopped working after a page reload.
   */
  const normalize = (data: Record<string, unknown> | null | undefined): User | null => {
    if (!data) return null;
    const id = (data._id ?? data.userId) as string | undefined;
    return { ...(data as unknown as User), _id: id ?? "" };
  };

  const fetchUser = async () => {
    try {
      // Try fetching profile using existing token (cookie or in-memory Bearer)
      const response = await api.get("/auth/profile");
      setUser(normalize(response.data));
    } catch (error) {
      // Profile failed — try to refresh to get a new access token
      try {
        const refreshResponse = await api.post("/auth/refresh");
        if (refreshResponse.data?.token) {
          setAccessToken(refreshResponse.data.token);
        }
        // Retry profile with new token
        const profileResponse = await api.get("/auth/profile");
        setUser(normalize(profileResponse.data));
      } catch (refreshError) {
        // Both failed — user is not authenticated
        setUser(null);
        setAccessToken(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    /*
     * 🚀 PERF: seed the user from the stored token before the network call.
     *
     * The dashboard layout blocks on `isLoading` behind a full-screen spinner,
     * so every cold load used to wait on a round trip to /auth/profile — and
     * on an expired access token, on profile → refresh → profile, three trips
     * in series — before the page could even start fetching its own data.
     *
     * The access token already carries email, role and isActive (see
     * AuthService.generateToken), so an unexpired one lets the dashboard
     * render immediately. `fetchUser()` still runs and overwrites this with
     * the authoritative answer; nothing here is trusted for authorisation,
     * which the API enforces on every request regardless.
     */
    const seeded = readUserFromToken(getAccessToken());
    if (seeded) {
      setUser(seeded);
      setIsLoading(false);
    }

    fetchUser();
  }, []);

  const login = async (data: any) => {
    const response = await api.post("/auth/login", data);
    // Store access token in memory for Bearer auth
    if (response.data.token) {
      setAccessToken(response.data.token);
    }
    if (response.data.user) {
      setUser(response.data.user);
    } else {
      await fetchUser();
    }
    router.refresh();
  };

  const register = async (data: any) => {
    await api.post("/auth/register", data);
  };

  /**
   * Create the account and sign in, in one step.
   *
   * `/auth/register` already returns the same `{ token, user }` payload as
   * `/auth/login`; the old flow threw it away and sent people to the login
   * page, so signing up ended at a form asking for the password they had just
   * chosen. Nothing new on the server — this just uses what it already sends.
   */
  /* No role: the API makes every new account an AGENT on the Free plan. */
  const registerAndSignIn = async (data: {
    name: string;
    email: string;
    password: string;
  }) => {
    const response = await api.post("/auth/register", data);

    if (response.data?.token) setAccessToken(response.data.token);

    if (response.data?.user) {
      setUser(response.data.user);
    } else {
      // Older API build that only acknowledges the write — fall back to the
      // credentials we already hold rather than bouncing to the login page.
      await login({ email: data.email, password: data.password });
    }
  };

  /**
   * Finish "Continue with Google".
   *
   * Google sends the browser back to the API, which sets the httpOnly cookies
   * and bounces here. The cookies alone are enough for same-domain requests,
   * but the axios client prefers a Bearer token — so trade the refresh cookie
   * for an access token straight away, exactly as a password login would hold
   * one. No token ever travels in a URL.
   */
  const completeSocialSignIn = async () => {
    const response = await api.post("/auth/refresh");

    if (response.data?.token) setAccessToken(response.data.token);

    if (response.data?.user) {
      setUser(response.data.user);
      setIsLoading(false);
    } else {
      await fetchUser();
    }
  };

  const refreshSession = async () => {
    try {
      const response = await api.post("/auth/refresh");
      if (response.data?.token) setAccessToken(response.data.token);
      if (response.data?.user) setUser(normalize(response.data.user));
      else await fetchUser();
    } catch (error) {
      console.error("Could not refresh the session:", error);
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout", {});
    } catch (e) {
      console.error("Logout failed", e);
    }
    setUser(null);
    setAccessToken(null);
    router.push("/");
    router.refresh();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        registerAndSignIn,
        completeSocialSignIn,
        refreshSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
