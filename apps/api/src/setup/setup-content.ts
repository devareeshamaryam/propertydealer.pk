/*
 * Data the setup jobs put in place once (see setup.service.ts). Editable
 * afterwards from the dashboard — these are only the starting values.
 */

/** Benefits per plan, matched by name. Prices and limits are not touched. */
export const PLAN_BENEFITS: Record<string, { perks: Record<string, unknown>; features: string[]; description?: string }> = {
  free: {
    perks: { verifiedBadge: false, teamMembers: 0, socialLinks: false, brandedProfile: false, autoPublish: false, spotlight: false, highlight: false },
    description: 'Start listing today — no card needed. Your listing stays live for a month; renew it for free.',
    features: [
      '1 live listing at a time',
      'Photos and a walkthrough video on every listing',
      'Pinned on the property map when you add a location',
      'Shown on city, area and size pages',
      'Call and WhatsApp buttons on your listing',
      'Your own agent profile page with a share link',
      'Views and enquiry stats',
    ],
  },
  starter: {
    perks: { verifiedBadge: false, teamMembers: 0, socialLinks: true, brandedProfile: false, autoPublish: false, spotlight: false, highlight: false },
    description: 'For owners and new dealers with a few properties.',
    features: [
      '5 live listings',
      '1 featured listing — pinned above the rest, with a Featured tag',
      'Social media links on your profile (Facebook, Instagram, YouTube, TikTok, website)',
      'Photos and a walkthrough video on every listing',
      'Pinned on the property map and society maps',
      'Views and enquiry stats',
      'Valid 1 month',
    ],
  },
  dealer: {
    perks: { verifiedBadge: false, teamMembers: 0, socialLinks: true, brandedProfile: true, autoPublish: false, spotlight: false, highlight: true },
    description: 'For working dealers who list every week.',
    features: [
      '15 live listings',
      '3 featured listings — pinned above the rest, with a Featured tag',
      'Branded profile: cover photo, logo and social links',
      'Profile share button for WhatsApp and Facebook',
      'Pinned on the property map and society maps',
      'Views and enquiry stats per listing',
      'Valid 1 month',
    ],
  },
  agency: {
    perks: { verifiedBadge: true, teamMembers: 3, socialLinks: true, brandedProfile: true, autoPublish: true, spotlight: true, highlight: false },
    description: 'For established agencies with a few agents.',
    features: [
      '40 live listings',
      '10 featured listings — pinned above the rest, with a Featured tag',
      'Verified badge on your profile, every listing and every listing card',
      'Listings go live instantly — no waiting for review',
      'Spotlight in "Verified agencies" on the homepage and agents page',
      'Branded profile: cover photo, logo and social links',
      'Views and enquiry stats per listing',
      'Valid 1 month',
    ],
  },
  'agency plus': {
    perks: { verifiedBadge: true, teamMembers: 10, socialLinks: true, brandedProfile: true, autoPublish: true, spotlight: true, highlight: false },
    description: 'For bigger agencies with a team of agents.',
    features: [
      '100 live listings, shared by your team',
      '25 featured listings — pinned above the rest, with a Featured tag',
      'Up to 10 agent accounts — each agent manages their own listings, you see all of them',
      'Verified badge for you and every agent of your agency',
      'Listings go live instantly — no waiting for review',
      'Spotlight in "Verified agencies" on the homepage and agents page',
      'Agency profile with your team, cover photo, logo and social links',
      'Views and enquiry stats per listing and per agent',
      'Valid 1 month',
    ],
  },
};

const p = (text: string) => `<p>${text}</p>`;

export const STATIC_PAGES: { slug: string; title: string; metaTitle: string; metaDescription: string; content: string }[] = [
  {
    slug: 'about',
    title: 'About Property Dealer',
    metaTitle: "About Property Dealer — Pakistan's Property & Construction Portal",
    metaDescription:
      "Who we are: a Pakistani property portal where buyers, sellers and dealers meet, and where today's cement, steel, brick and sand rates are published every day.",
    content: [
      p('Property Dealer is a Pakistani property portal. Owners and dealers list houses, flats, plots and shops for sale or rent, and buyers and tenants contact them directly — by phone or WhatsApp, without signing up.'),
      '<h2>What you will find here</h2>',
      p('Listings across Lahore, Islamabad, Rawalpindi, Karachi, Multan, Faisalabad, Gujranwala, Sahiwal and other cities, searchable by city, area, property type, size and price. Sizes are in marla and kanal and prices in lakh and crore, the way property is bought and sold here.'),
      p("Alongside the listings we publish the day's construction material rates — cement, steel, bricks, sand, bajri, tiles, wood and doors — for anyone building or renovating."),
      '<h2>How listings work</h2>',
      '<ul><li>Every listing is checked — by our system and by our team — and anything that looks suspicious waits for review.</li><li>Each listing shows who posted it, with a link to their profile and their other properties.</li><li>When a property is sold or rented out it is marked as such and its contact details are hidden.</li><li>Anything that looks wrong can be reported from the listing page, and we look at every report.</li></ul>',
      p('We are a listings platform, not a party to any deal. Always see the property and its papers before paying anything.'),
      '<h2>For owners and agents</h2>',
      p('Anyone can create an account and post a property; the first listing is free. Dealers who list more can choose a <a href="/packages">monthly package</a> for more listings, featured placement and a verified badge.'),
    ].join('\n'),
  },
  {
    slug: 'contact',
    title: 'Contact us',
    metaTitle: 'Contact Property Dealer — Phone, WhatsApp & Email',
    metaDescription: 'Get in touch with Property Dealer by phone, WhatsApp or email — for listing help, packages for agents, advertising or to report a problem.',
    content: [
      p('We are happy to help — with posting a property, choosing a package, a problem with a listing, or advertising on the site.'),
      '<h2>The quickest way</h2>',
      p('Message us on WhatsApp or call during office hours; our details are on this page. For anything to do with a particular listing, please include its link.'),
      '<h2>Reporting a listing</h2>',
      p('If a listing looks wrong — a sold property, a wrong price or a suspected scam — use the <strong>Report this listing</strong> button on its page. Every report is reviewed.'),
    ].join('\n'),
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    metaTitle: 'Privacy Policy — Property Dealer',
    metaDescription: 'How Property Dealer collects, uses and protects your information when you browse listings, create an account or post a property.',
    content: [
      p('This policy explains what information Property Dealer collects, how it is used and the choices you have. By using the site you agree to it.'),
      '<h2>Information we collect</h2>',
      '<ul><li><strong>Account details</strong> — your name, email, phone and WhatsApp number, and anything you add to your profile.</li><li><strong>Listings</strong> — the details, photos, videos and location of properties you post. These are public.</li><li><strong>Usage</strong> — pages viewed, searches and clicks on call or WhatsApp buttons, used to show you and listing owners how listings perform.</li><li><strong>Cookies</strong> — to keep you signed in and to measure traffic (Google Analytics).</li></ul>',
      '<h2>How we use it</h2>',
      '<ul><li>To run your account and publish your listings.</li><li>To let buyers and tenants contact you — your phone and WhatsApp number appear on your listings and profile.</li><li>To review listings, prevent fraud and answer reports.</li><li>To improve the site.</li></ul>',
      p('We do not sell your personal information.'),
      '<h2>Sharing</h2>',
      p('Information you publish (listings and profile) is visible to everyone. We share other information only with service providers that help us run the site (hosting, analytics, email), or when required by law.'),
      '<h2>Your choices</h2>',
      p('You can edit your profile and listings at any time from your dashboard, mark a property sold or delete it, and ask us to close your account by contacting us.'),
      '<h2>Contact</h2>',
      p('Questions about this policy: see our <a href="/contact">contact page</a>.'),
    ].join('\n'),
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    metaTitle: 'Terms of Service — Property Dealer',
    metaDescription: 'The terms for using Property Dealer — posting listings, packages for agents, and buying, selling or renting through the site.',
    content: [
      p('These terms apply to everyone who uses Property Dealer. By using the site you agree to them.'),
      '<h2>The service</h2>',
      p('Property Dealer is a listings platform. We are not a broker or a party to any sale, purchase or rental, and we do not guarantee any listing. Always see the property and verify ownership papers before paying anything.'),
      '<h2>Posting listings</h2>',
      '<ul><li>You must own the property or be authorised to market it.</li><li>Listings must be accurate — real photos, price, size and location — and kept up to date. Mark a property sold or rented when it is.</li><li>No duplicate, misleading or offensive listings, and no contact details inside descriptions or photos.</li><li>We may edit, hold or remove any listing, and suspend accounts that break these rules.</li></ul>',
      '<h2>Packages for agents</h2>',
      p("Packages are paid in advance for the period shown and start once payment is verified. Limits and benefits are as described on the <a href=\"/packages\">packages page</a> at the time of purchase. Fees are not refundable once a package is active, unless the law requires otherwise. An agency is responsible for the accounts of its agents."),
      '<h2>Content</h2>',
      p('You keep ownership of what you post, and allow us to show it on the site and in our marketing. Do not upload material you do not have the right to use.'),
      '<h2>Liability</h2>',
      p('The site is provided as it is. To the extent the law allows, Property Dealer is not liable for losses arising from listings, from dealings between users, or from the site being unavailable.'),
      '<h2>Changes</h2>',
      p('We may update these terms; the version on this page applies. Questions: see our <a href="/contact">contact page</a>.'),
    ].join('\n'),
  },
];
