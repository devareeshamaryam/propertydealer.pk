'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { setAccessToken } from '@/lib/api';
import { toast } from 'sonner';

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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchUser = async () => {
    try {
      // Try fetching profile using existing token (cookie or in-memory Bearer)
      const response = await api.get('/auth/profile');
      setUser(response.data);
    } catch (error) {
      // Profile failed — try to refresh to get a new access token
      try {
        const refreshResponse = await api.post('/auth/refresh');
        if (refreshResponse.data?.token) {
          setAccessToken(refreshResponse.data.token);
        }
        // Retry profile with new token
        const profileResponse = await api.get('/auth/profile');
        setUser(profileResponse.data);
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
    fetchUser();
  }, []);

  const login = async (data: any) => {
    const response = await api.post('/auth/login', data);
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
    await api.post('/auth/register', data);
    // Auto login after register? Or redirect to login?
    // Let's assume redirect to login or auto-login.
    // For now, doing nothing, let the calling component handle navigation
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (e) {
      console.error("Logout failed", e);
    }
    setUser(null);
    setAccessToken(null);
    router.push('/');
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
