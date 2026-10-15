'use client'
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionHeading } from '@/components/SectionHeading';

/*
 * The questions are unchanged — they carry FAQPage structured data that
 * search results may already show — but several answers described things the
 * site does not have: a "Verified" badge on listings, a team that checks
 * ownership documents, "legal experts" and "consulting services". Structured
 * data is supposed to match the page, and the page is supposed to be true, so
 * the answers now describe what actually happens.
 */
const FAQS = [
  {
    question: 'How do I verify a property listing on Property Dealer?',
    answer:
      'Every listing is checked before it goes live: an automatic review flags phone numbers in the text, prices that do not fit the area and duplicate posts, and anything it is unsure about waits for a person on our team. If a listing still looks wrong, use “Report this listing” on its page — and always see the property and the papers before paying anything.',
  },
  {
    question: 'Are there any service charges for using the platform?',
    answer:
      'Searching, browsing and contacting dealers is free. Agents can list one property free of charge; paid plans add more listings and featured placement.',
  },
  {
    question: 'What legal documents should I check before renting a house?',
    answer:
      'Check the owner’s CNIC and proof of ownership — the registry, fard or allotment letter — and put the terms in a written rent agreement signed by both sides. If anything is unclear, have a lawyer look at the papers before you pay an advance.',
  },
  {
    question: 'Can I list my property for sale or rent for free?',
    answer:
      'Yes. Every account can list one property for free. If you have more to list, the agent plans add more listings and featured placement.',
  },
  {
    question: 'Which cities in Pakistan do you cover?',
    answer:
      'Listings are live in Lahore, Islamabad, Rawalpindi, Karachi, Multan, Faisalabad, Gujranwala, Sahiwal, Bahawalpur and other cities across Pakistan, and the construction material rates are published for the major cities every day.',
  },
];

const FAQSection = () => {
  const [open, setOpen] = useState<number | null>(0);

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };

  return (
    <section className="border-t border-slate-100 bg-white py-6 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="container mx-auto grid gap-6 px-4 lg:grid-cols-[320px_1fr] lg:gap-12">
        <SectionHeading
          title="Frequently asked questions"
          description="Buying, renting and listing property in Pakistan."
          className="mb-0 items-start"
        />

        <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {FAQS.map((faq, index) => {
            const isOpen = open === index;
            return (
              <div key={faq.question}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left hover:bg-slate-50 sm:px-5"
                >
                  <span className="text-[15px] font-semibold text-slate-900">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-slate-400 transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>
                {/* Always in the HTML, only hidden: FAQPage structured data
                    should match content that is on the page, collapsed or not. */}
                <p
                  hidden={!isOpen}
                  className="px-4 pb-4 text-[14px] leading-relaxed text-slate-600 sm:px-5"
                >
                  {faq.answer}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
