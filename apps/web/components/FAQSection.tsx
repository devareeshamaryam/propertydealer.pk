'use client'
import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    question: "How do I verify a property listing on Property Dealer?",
    answer: "Property Dealer uses a multi-step verification process. Look for the 'Verified' badge on listings, which means our team has manually checked the property details, ownership documents, and location."
  },
  {
    question: "Are there any service charges for using the platform?",
    answer: "Searching and browsing properties on Property Dealer is completely free for users. We only charge for premium listing packages and specialized consulting services."
  },
  {
    question: "What legal documents should I check before renting a house?",
    answer: "You should typically check the original allotment letter, lease agreement, and CNIC of the owner. We recommend consulting with our legal experts for a comprehensive document review."
  },
  {
    question: "Can I list my property for sale or rent for free?",
    answer: "Yes, you can list your first property for free on our platform. For additional listings or to increase your agency's reach, we offer professional dealer packages tailored to your needs."
  },
  {
    question: "Which cities in Pakistan do you cover?",
    answer: "We currently have extensive listings in Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, and Peshawar, with expansion plans for other major cities across Pakistan."
  }
];

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  // FAQ Schema for SEO
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map(faq => ({
      '@type': 'Question',
      'name': faq.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': faq.answer,
      },
    })),
  };

  return (
    <section className="py-16 bg-gray-50">
      {/* FAQ Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 tracking-tight">Frequently Asked Questions</h2>
            <p className="text-gray-600 font-medium">Everything you need to know about properties in Pakistan.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-300"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-lg font-bold text-gray-900">{faq.question}</span>
                  {openIndex === index ? (
                    <Minus className="w-5 h-5 text-black shrink-0" />
                  ) : (
                    <Plus className="w-5 h-5 text-gray-400 shrink-0" />
                  )}
                </button>
                <div
                  className={`overflow-hidden transition-all duration-500 ease-in-out ${openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                >
                  <div className="p-6 pt-0 text-gray-600 leading-relaxed font-medium border-t border-gray-50">
                    {faq.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
