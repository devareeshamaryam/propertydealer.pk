'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/context/auth-context'
import * as z from 'zod'
import { AlertTriangle, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { GoogleButton } from '@/components/auth/google-button'
import { intentReason, registerUrl, safeNextUrl } from '@/lib/auth-intent'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import api from '@/lib/api'  // tumhara axios client (withCredentials: true wala)

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
})

type FormValues = z.infer<typeof formSchema>

function LoginForm() {
  const { login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Set when the Google round trip came back without a usable account.
  const googleFailed = searchParams.get('error') === 'google'

  // "Sign in to list your property" — the reason beats a generic greeting.
  const reason = intentReason(searchParams.get('next'))
  const nextPath = searchParams.get('next')

  useEffect(() => {
    if (searchParams.get('sessionExpired') === 'true') {
      setSessionExpired(true)
    }
  }, [searchParams])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      // Carried over when someone tried to register with an address that
      // already has an account, so they only have to type the password.
      email: searchParams.get('email') ?? "",
      password: "",
    },
  })

  async function onSubmit(values: FormValues) {
    setIsLoading(true)

    try {
      await login(values)

      toast.success("Login Successful", {
        description: "Welcome back! Redirecting...",
      })

      router.push(safeNextUrl(searchParams.get('next')))

    } catch (err: any) {
      console.error(err)

      const errorMessage = err.response?.data?.message || 'Invalid credentials or server error.'

      if (errorMessage === 'Account is pending activation') {
        router.push('/pending-activation')
        return
      }

      toast.error(errorMessage, {
        description: 'Please check your credentials and try again.'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md shadow-lg">
        {sessionExpired && (
          <div className="mx-6 mt-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong>Session expired.</strong> Please log in again to continue.
            </span>
          </div>
        )}
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {reason ?? 'Welcome back'}
          </CardTitle>
          <CardDescription className="text-center">
            {reason
              ? 'Sign in, or create a free account — it takes a few seconds.'
              : 'Enter your email and password to continue'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {googleFailed && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Google sign-in did not complete. Please try again, or use your
                email and password.
              </span>
            </div>
          )}

          <GoogleButton next={searchParams.get('next')} disabled={isLoading} />

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                {...form.register('email')}
                disabled={isLoading}
                className="h-11"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <div className="flex items-center gap-3">
                  {/* Same show/hide as the sign-up form — typing a password
                      blind is how people end up locked out. */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" /> Hide
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5" /> Show
                      </>
                    )}
                  </button>
                  <a
                    href="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
              </div>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...form.register('password')}
                disabled={isLoading}
                className="h-11"
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 text-center text-sm text-muted-foreground">
          {/*
            This used to be one line of grey text, so people who had never
            registered typed their email into the sign-in form, failed, and
            left. It is a button now, and it carries the same ?next= so they
            still end up where they were going.
          */}
          <div className="w-full rounded-lg border bg-muted/40 p-4">
            <p className="font-medium text-foreground">New here?</p>
            <p className="mt-0.5 text-xs">
              Browsing and contacting agents needs no account. Create one to
              list a property of your own.
            </p>
            <Button variant="outline" className="mt-3 h-11 w-full" asChild>
              <Link href={registerUrl(safeNextUrl(nextPath, '/dashboard'))}>
                Create a free account
              </Link>
            </Button>
          </div>
          <div className="text-xs">
            By continuing, you agree to our{' '}
            <a href="/terms" className="hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="hover:underline">
              Privacy Policy
            </a>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}