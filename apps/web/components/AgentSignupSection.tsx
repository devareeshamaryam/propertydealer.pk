import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

/*
 * One band asking owners and agents to list, the way portals do it.
 *
 * It was a full-height section: blurred blobs, a 60px headline, three
 * 40px-radius cards, a row of cartoon avatars (DiceBear placeholders) above
 * "Join 5,000+ Active Agents Today", and a five-star quote from "Hamza Aziz,
 * Platinum Real Estate Agency". The number is not what the site has and the
 * quote cannot be traced to anyone — the kind of social proof that reads as
 * invented, because it is. A plain band with the three real steps and the
 * real offer (first listing free) asks for the same thing honestly.
 */

const STEPS = [
  'Create a free account',
  'Add your property with photos',
  'Get calls and WhatsApp messages from buyers',
];

const ADD = '/register?next=/dashboard/property/add-property';

export default function AgentSignupSection() {
  return (
    <section className="bg-white py-6 sm:py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col gap-6 rounded-lg bg-navy px-5 py-7 text-white sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Selling or renting out a property?
            </h2>
            <p className="mt-1.5 text-[15px] text-slate-300">
              Owners and agents can post a listing in a few minutes. Your first
              listing is free.
            </p>

            <ol className="mt-4 flex flex-col gap-2 text-[14px] text-slate-200 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15 text-[11px] font-semibold">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              asChild
              className="h-10 gap-1.5 bg-white px-5 font-semibold text-navy hover:bg-slate-100"
            >
              <Link href={ADD}>
                <Plus className="h-4 w-4" />
                Add Property
              </Link>
            </Button>
            <Link
              href="/packages"
              className="inline-flex h-10 items-center justify-center gap-1 px-2 text-sm font-semibold text-white/90 hover:text-white"
            >
              Agent packages
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
