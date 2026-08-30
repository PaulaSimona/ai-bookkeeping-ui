import { type FC, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicPageShell } from '@/components/Layout/PublicPageShell';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  title: string;
  items: FaqItem[];
}

const FAQ_DATA: FaqCategory[] = [
  {
    title: 'Getting Started',
    items: [
      {
        question: 'What is AI Bookkeeping?',
        answer:
          'AI Bookkeeping is an automated bookkeeping service for small business owners in Canada and the United States. You upload receipts and invoices — our AI extracts and categorizes every transaction, generates your annual Excel workbook, and produces GST/HST ITC and expense reports. Connected bank feeds are part of the Bookkeeping Service. No accounting experience required.',
      },
      {
        question: 'How do I upload my receipts?',
        answer:
          'You can upload receipts directly in the Documents section of the app (drag-and-drop or file picker), or send them to @Accuratebooks_bot on Telegram. Both methods support batch uploads so you can send multiple files at once.',
      },
      {
        question: 'What file formats are supported?',
        answer:
          'We accept JPG, PNG, PDF, and HEIC files. Phone photos, scanned PDFs, and digital invoices all work. For best results, make sure the document is legible and well-lit.',
      },
      {
        question: 'How quickly are receipts processed?',
        answer:
          'Most receipts are extracted within a few seconds. The AI reads vendor name, date, total amount, tax amount, and assigns a business expense category automatically.',
      },
      {
        question: 'Do I need an accountant to use this?',
        answer:
          'No. AI Bookkeeping handles the day-to-day data entry and categorization automatically. Your accountant (if you have one) can review the clean Excel workbook we produce — it saves them hours of data entry at year-end.',
      },
    ],
  },
  {
    title: 'Pricing',
    items: [
      {
        question: 'What plans are available?',
        answer:
          'We offer three active plans: Starter (ideal for sole proprietors with light receipt volume), Growth (for growing businesses with higher volume and reporting needs), and Pro (for businesses that need advanced reporting and priority support). The Bookkeeping Service adds full double-entry bookkeeping, bank and card connections, and financial statements, and is available to purchase.',
      },
      {
        question: 'Is there a free trial?',
        answer:
          'Free trial — 5 documents included, no credit card required. That lets you try the upload and extraction features before committing. Paid plans are billed monthly and you can cancel at any time.',
      },
      {
        question: 'Can I upgrade or downgrade my plan?',
        answer:
          'Yes. You can change your plan at any time from the Subscription page in your account. Upgrades take effect immediately; downgrades apply at the start of your next billing cycle.',
      },
      {
        question: 'Do you offer refunds?',
        answer:
          'We handle refund requests on a case-by-case basis. If you have an issue with a charge, contact us at customerservice@ai-bookkeeping.ai and we will work with you to make it right.',
      },
      {
        question: 'Are prices in Canadian dollars?',
        answer: 'Yes. All prices are in CAD or USD and exclude taxes.',
      },
    ],
  },
  {
    title: 'Canadian Tax',
    items: [
      {
        question: 'Does it track GST/HST input tax credits (ITCs)?',
        answer:
          'Yes. The AI extracts the GST/HST amount from each receipt and tags it as an ITC. Your GST/HST ITC report shows a clean breakdown by period so you can file your return or hand it to your accountant with confidence.',
      },
      {
        question: 'Which provinces are supported?',
        answer:
          'All Canadian provinces and territories are supported. GST and HST amounts are extracted from your receipts and tracked for input tax credits, and provincial sales tax is treated according to the rules that apply in your province.',
      },
      {
        question: 'Can I use the export for my T2125 (business income tax)?',
        answer:
          'Yes. The annual Excel workbook organizes expenses by CRA-recognized categories (advertising, office, travel, meals, etc.) that map directly to the T2125 Statement of Business Activities. Your accountant or tax preparer can use it to file your return.',
      },
      {
        question: 'Does the AI classify expenses to CRA categories?',
        answer:
          'Yes. Every expense is automatically assigned a category aligned with CRA business expense categories. You can review and correct any categorization in the Workbook view before exporting.',
      },
    ],
  },
  {
    title: 'Security',
    items: [
      {
        question: 'Where is my data stored?',
        answer:
          'Your account data is held in a private database, and your financial documents are stored privately and served through expiring signed links rather than public file URLs. Each organization’s data is isolated from every other, and the permission rules are covered by deny-path tests.',
      },
      {
        question: 'Is my data encrypted?',
        answer:
          'All data in transit is protected by TLS/HTTPS. Passwords are hashed and never stored in plaintext, and sensitive credentials such as bank connection tokens are encrypted at rest. No system can be guaranteed 100% secure, but a formal security review program is in place and independent assessment is planned as the platform scales.',
      },
      {
        question: 'Do you sell or share my financial data?',
        answer:
          'No. We do not sell your personal or financial data. We share it only with the service providers needed to operate the app — for example Stripe for payments and SendGrid for email. See our Privacy Policy for the full list.',
      },
      {
        question: 'Are my documents used to train AI models?',
        answer:
          'No. Documents are processed by our AI provider under commercial API terms that do not permit your data to be used for model training.',
      },
      {
        question: 'What happens to my data if I cancel?',
        answer:
          'If you delete your account, your personal data and documents are deleted within 30 days. Extracted financial data may be retained for the legally required period under CRA record-keeping rules (typically 6 years).',
      },
    ],
  },
  {
    title: 'Account',
    items: [
      {
        question: 'How do I link my Telegram account?',
        answer:
          'Go to Settings → Telegram Integration. You will see a unique link token. Open @Accuratebooks_bot on Telegram and send the command shown on the Settings page. Your account links instantly.',
      },
      {
        question: 'Can I export my bookkeeping data?',
        answer:
          'Yes. From the Reports section, download your annual Excel workbook (.xlsx) with all transactions, expense summaries, and GST/HST ITC details. Individual reports can also be exported on demand.',
      },
      {
        question: 'Can I have multiple businesses on one account?',
        answer:
          'Each account manages a single business. If you run more than one, get in touch and we will tell you honestly whether we are a fit today.',
      },
      {
        question: 'How do I cancel my subscription?',
        answer:
          'Go to Subscription in your account and click "Cancel Plan". Your access continues until the end of your current billing period. There are no cancellation fees.',
      },
      {
        question: 'How do I contact support?',
        answer:
          'Use the Support page inside the app to submit a ticket, or email customerservice@ai-bookkeeping.ai. We typically respond within one business day.',
      },
    ],
  },
];

const AccordionItem: FC<FaqItem> = ({ question, answer }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 py-4 text-left text-sm font-medium text-gray-900 hover:text-[#0066FF] transition-colors"
      >
        <span>{question}</span>
        <svg
          className={`w-5 h-5 shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <p className="pb-4 pr-8 text-sm text-gray-500 leading-relaxed">{answer}</p>
      )}
    </div>
  );
};

const allQuestions = FAQ_DATA.flatMap((cat) => cat.items);

export const FAQ: FC = () => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'FAQ | AI Bookkeeping';

    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const createdDesc = !metaDesc;
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content =
      'Answers to common questions about AI Bookkeeping — pricing, GST/HST tracking, receipt upload, security, and account management.';

    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.id = 'ld-faq';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: allQuestions.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    });
    document.head.appendChild(ld);

    return () => {
      document.title = prevTitle;
      if (createdDesc) metaDesc?.remove();
      document.getElementById('ld-faq')?.remove();
    };
  }, []);

  return (
    <PublicPageShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-400">
          <ol className="flex items-center gap-1.5">
            <li><Link to="/" className="hover:text-gray-700 transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-700 font-medium">FAQ</li>
          </ol>
        </nav>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Frequently Asked Questions</h1>
        <p className="text-gray-500 mb-10">
          Everything you need to know about AI Bookkeeping.{' '}
          <a href="/blog" className="text-[#0066FF] hover:underline">
            Visit our blog
          </a>{' '}
          for in-depth guides.
        </p>

        <div className="space-y-6">
          {FAQ_DATA.map((category) => (
            <section key={category.title} aria-labelledby={`faq-${category.title}`}>
              <h2
                id={`faq-${category.title}`}
                className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1"
              >
                {category.title}
              </h2>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6">
                {category.items.map((item) => (
                  <AccordionItem
                    key={item.question}
                    question={item.question}
                    answer={item.answer}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 bg-blue-50 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-gray-800 mb-1">Still have questions?</p>
          <p className="text-sm text-gray-500 mb-4">Our team responds within one business day.</p>
          <a
            href="mailto:customerservice@ai-bookkeeping.ai"
            className="inline-block text-sm font-medium bg-[#0066FF] text-white px-5 py-2 rounded-lg hover:bg-[#0052cc] transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </PublicPageShell>
  );
};
