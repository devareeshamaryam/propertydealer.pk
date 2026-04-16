'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default function PendingActivationPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Clock className="h-8 w-8 text-primary animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            Account Pending Activation
          </CardTitle>
          <CardDescription>
            Thank you for registering with Property Dealer!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <div className="space-y-3 text-muted-foreground">
            <p>
              Your account has been successfully created and is currently being reviewed by our administrative team.
            </p>
            <p>
              For security and quality assurance, we manually verify all new profiles before granting access to our platform.
            </p>
          </div>

          <div className="bg-muted p-4 rounded-lg flex items-start gap-3 text-left">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">What happens next?</p>
              <p className="text-xs text-muted-foreground mt-1">
                You will receive an email once your account has been activated. This usually takes less than 24 hours.
              </p>
            </div>
          </div>

          <div className="pt-4">
            <Link href="/" passHref>
              <Button variant="outline" className="w-full">
                Return to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
