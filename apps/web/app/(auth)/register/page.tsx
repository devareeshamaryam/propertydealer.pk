'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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
import { useAuth } from '@/context/auth-context'
import { safeNextUrl } from '@/lib/auth-intent'
import { GoogleButton } from '@/components/auth/google-button'

export const dynamic = 'force-dynamic'

/**
 * Keep this in step with RegisterDto on the API.
 *
 * Six characters, nothing else. The form previously asked for six while the
 * server demanded eight, so a seven-character password passed validation here
 * and then failed server-side with an unexplained error. There is no
 * "confirm password" field by design — the show/hide toggle does the same job
 * with half the typing.
 */
const registerSchema = z.object({
  name: z.string().min(2, { message: 'Please enter your name' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, { message: 'Use at least 6 characters' }),
})

type FormValues = z.infer<typeof registerSchema>

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { registerAndSignIn } = useAuth()

  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  /*
   * Two kinds of account, one form.
   *
   * Everybody used to be registered as an AGENT — including someone who only
   * wanted to see a phone number — which made the user list meaningless and
   * put a listings dashboard in front of buyers. The kind comes from where
   * they started: "List your property" asks for an agent account, the header
   * and the contact buttons ask for a buyer account. Either way the choice is
   * visible below, and a buyer who later posts a property is upgraded then.
   */
  const [wantsAgent, setWantsAgent] = useState(
    searchParams.get('as') === 'agent',
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  async function onSubmit(values: FormValues) {
    setIsLoading(true)
    try {
      /*
       * Create the account AND sign in, in one step.
       *
       * This used to `router.push('/login')` after registering — so the reward
       * for signing up was a login form asking for the password you had just
       * chosen. The API already returns a token from /auth/register; it simply
       * was not being used.
       */
      await registerAndSignIn({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        role: wantsAgent ? 'AGENT' : 'USER',
      })

      toast.success('Welcome to PropertyDealer', {
        description: wantsAgent
          ? 'Your account is ready — you can list a property right away.'
          : 'Your account is ready — agents\' contact details are now visible.',
      })

      router.replace(safeNextUrl(searchParams.get('next')))
      router.refresh()
    } catch (error) {
      const response = (error as { response?: { status?: number; data?: { message?: string | string[] } } }).response
      const status = response?.status
      const message = response?.data?.message

      // Already registered → the login page, with the email carried over.
      if (status === 409 || /already exists/i.test(String(message))) {
        toast.error('You already have an account', {
          description: 'Signing you in instead — just enter your password.',
        })
        router.push(`/login?email=${encodeURIComponent(values.email.trim().toLowerCase())}`)
        return
      }

      toast.error('Could not create your account', {
        description:
          (Array.isArray(message) ? message[0] : message) ??
          'Please check your details and try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl font-bold">Create your account</CardTitle>
          <CardDescription className="text-center">
            One account to list properties, manage photos and track enquiries.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Nothing to fill in at all, for anyone who would rather not. */}
          <GoogleButton label="Sign up with Google" next={searchParams.get('next')} disabled={isLoading} />

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label>I am here to</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { agent: false, title: 'Find a property', hint: 'Contact agents' },
                  { agent: true, title: 'List a property', hint: 'Post listings' },
                ].map((option) => (
                  <button
                    key={option.title}
                    type="button"
                    onClick={() => setWantsAgent(option.agent)}
                    aria-pressed={wantsAgent === option.agent}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      wantsAgent === option.agent
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{option.title}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                placeholder="Muhammad Ali"
                autoComplete="name"
                {...form.register('name')}
                disabled={isLoading}
                className="h-11"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                {...form.register('email')}
                disabled={isLoading}
                className="h-11"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
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
              </div>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                {...form.register('password')}
                disabled={isLoading}
                className="h-11"
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="h-11 w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating your account…
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 text-center text-sm text-muted-foreground">
          <div>
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </div>
          <div className="text-xs">
            By signing up you agree to our{' '}
            <Link href="/terms" className="hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="hover:underline">
              Privacy Policy
            </Link>
            .
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-muted/40" />}>
      <RegisterForm />
    </Suspense>
  )
}
