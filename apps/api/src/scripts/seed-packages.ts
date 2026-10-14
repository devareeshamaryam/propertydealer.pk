import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Package, PackageDocument } from '@rent-ghar/db/schemas/package.schema';

/**
 * The plans, and why they are priced where they are.
 *
 * Zameen's cheapest agency package starts at PKR 14,000 a month, billed
 * annually, for 30 listings; Business is 55,000 and Titanium 200,000. That is
 * priced for city agencies with a sales rep assigned to them. The dealer in
 * Sahiwal or Multan with eleven houses on his books is not that customer, and
 * he is the one this site is for — so the ladder below tops out at less than
 * a third of Zameen's entry price for three times the listings, and starts at
 * Rs 500.
 *
 * Longer plans cost less per month, which is the usual shape and also the
 * honest one: a six-month commitment is worth a discount.
 *
 *   Free         Rs     0   1 month    1 listing
 *   Starter      Rs   500   1 month    5 listings     Rs 500/month
 *   Dealer       Rs 1,200   3 months   15 listings    Rs 400/month
 *   Agency       Rs 2,000   6 months   40 listings    Rs 333/month
 *   Agency Plus  Rs 3,500   12 months  100 listings   Rs 292/month
 *
 * ## Every claim here is enforced
 *
 * The old copy promised "Premium badge", "Premium placement", "Dedicated
 * support" and an "Analytics dashboard" — none of which existed, and the
 * analytics are free for everybody anyway. A feature list that cannot be
 * delivered is worse than a short one: the agent finds out in week two.
 *
 * What is actually enforced: `propertyLimit` (SubscriptionService.
 * canCreateProperty), `duration` (the subscription's end date) and
 * `featuredListings` (PropertyService.setFeatured counts an agent's pinned
 * listings against it). Everything else in the lists below is something the
 * site genuinely does for every account, paid or not, and is written as such.
 *
 * ## Running it
 *
 *   npm run seed:packages --workspace=apps/api
 *   node dist/apps/api/src/scripts/seed-packages.js   (on a server)
 *
 * Safe to run more than once: packages are matched by name and updated in
 * place, so the ids that existing subscriptions point at never change. A
 * package that is no longer offered is deactivated rather than deleted, for
 * the same reason — deleting it would leave live subscriptions pointing at
 * nothing, and `getEffectivePlan` would report "Associated package not found".
 */

/** Said on every tier, because it is true on every tier. */
const INCLUDED_EVERYWHERE = [
  'Photos and a walkthrough video on every listing',
  'Shown on city, area and size pages',
  'Call and WhatsApp buttons on your listings',
  'Your own agent profile page',
  'Views and enquiry stats',
];

interface PlanSeed {
  name: string;
  description: string;
  price: number;
  duration: number;
  propertyLimit: number;
  featuredListings: number;
  photosPerProperty: number;
  isActive: boolean;
  features: string[];
}

const PLANS: PlanSeed[] = [
  {
    name: 'Free',
    description: 'Every account starts here. No card, no expiry.',
    price: 0,
    duration: 30,
    propertyLimit: 1,
    featuredListings: 0,
    photosPerProperty: 20,
    isActive: true,
    features: ['1 live listing at a time', ...INCLUDED_EVERYWHERE],
  },
  {
    name: 'Starter',
    description: 'For the dealer with a handful of properties on the books.',
    price: 500,
    duration: 30,
    propertyLimit: 5,
    featuredListings: 1,
    photosPerProperty: 20,
    isActive: true,
    features: [
      '5 live listings',
      '1 featured listing — pinned above the rest',
      'Valid 1 month',
      ...INCLUDED_EVERYWHERE,
    ],
  },
  {
    name: 'Dealer',
    description: 'A working dealer’s plan, at Rs 400 a month.',
    price: 1200,
    duration: 90,
    propertyLimit: 15,
    featuredListings: 3,
    photosPerProperty: 20,
    isActive: true,
    features: [
      '15 live listings',
      '3 featured listings',
      'Valid 3 months — Rs 400 a month',
      ...INCLUDED_EVERYWHERE,
    ],
  },
  {
    name: 'Agency',
    description: 'For an office running several areas at once.',
    price: 2000,
    duration: 180,
    propertyLimit: 40,
    featuredListings: 10,
    photosPerProperty: 20,
    isActive: true,
    features: [
      '40 live listings',
      '10 featured listings',
      'Valid 6 months — Rs 333 a month',
      ...INCLUDED_EVERYWHERE,
    ],
  },
  {
    name: 'Agency Plus',
    description: 'A full year, and room for a hundred properties.',
    price: 3500,
    duration: 365,
    propertyLimit: 100,
    featuredListings: 25,
    photosPerProperty: 20,
    isActive: true,
    features: [
      '100 live listings',
      '25 featured listings',
      'Valid 12 months — Rs 292 a month',
      ...INCLUDED_EVERYWHERE,
    ],
  },
];

async function seedPackages() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const packageModel = app.get<Model<PackageDocument>>(
      getModelToken(Package.name),
    );

    console.log('\n🌱 Plans\n');

    const keep = new Set<string>();

    for (const plan of PLANS) {
      keep.add(plan.name.toLowerCase());

      // Matched case-insensitively so "basic" and "Basic" do not become two.
      const existing = await packageModel
        .findOne({ name: new RegExp(`^${plan.name}$`, 'i') })
        .exec();

      if (existing) {
        await packageModel.updateOne({ _id: existing._id }, { $set: plan });
        console.log(
          `  updated  ${plan.name.padEnd(12)} Rs ${String(plan.price).padStart(5)}  ` +
            `${String(plan.duration).padStart(3)}d  ${plan.propertyLimit} listings`,
        );
      } else {
        const created = await packageModel.create(plan);
        console.log(
          `  created  ${plan.name.padEnd(12)} Rs ${String(plan.price).padStart(5)}  ` +
            `${String(plan.duration).padStart(3)}d  ${plan.propertyLimit} listings  (${created._id.toString()})`,
        );
      }
    }

    /*
     * Retired plans are switched off, never removed: a subscription somebody
     * is still inside points at this row, and deleting it would break their
     * My Subscription page and their listing allowance.
     */
    const retired = await packageModel
      .find({ isActive: true })
      .select('name')
      .exec();

    for (const row of retired) {
      if (keep.has(String(row.name).toLowerCase())) continue;
      await packageModel.updateOne({ _id: row._id }, { $set: { isActive: false } });
      console.log(
        `  retired  ${String(row.name).padEnd(12)} (hidden from the pricing page; existing subscriptions keep working)`,
      );
    }

    console.log('\n✅ Done.\n');
  } catch (error) {
    console.error('❌ Could not seed packages:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void seedPackages();
