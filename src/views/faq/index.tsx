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
          'AI Bookkeeping is an automated bookkeeping service designed for Canadian small business owners. You upload receipts, invoices, and bank statements — our AI powered by Claude extracts and categorizes every transaction, generates your annual Excel workbook, and produces GST/HST ITC and expense reports. No accounting experience required.',
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
          'We offer three active plans: Starter (ideal for sole proprietors with light receipt volume), Growth (for growing businesses with higher volume and reporting needs), and Pro (for businesses that need advanced reporting and priority support). An Advanced plan for complex multi-entity needs is in development.',
      },
      {
        question: 'Is there a free trial?',
        answer:
          'We offer a limited free tier so you can try the core upload and extraction features before committing to a paid plan. Paid plans are billed monthly and you can cancel at any time.',
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
        answer: 'Yes. All prices are in CAD and include applicable taxes.',
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
          'All Canadian provinces and territories are supported. GST, HST, and QST (Quebec) rates are applied correctly based on the vendor location and your business province.',
      },
      {
        question: 'Can I use the export for my T2125 (business income tax)?',
        answer:
          'Yes. The annual Excel workbook organizes expenses by CRA-recognized categories (advertising, office, travel, meals, etc.) that map directly to the T2125 Statement of Business Activities. Your accountant or tax preparer can use it to file your return.',
      },
      {
        question: 'Does it handle QST for Quebec businesses?',
        answer:
          'Yes. QST amounts are extracted and reported separately so Quebec businesses can reconcile their QST input tax refunds (ITRs) accurately.',
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
          'Your account data is stored in a secure PostgreSQL database on Railway. Financial documents are stored in Cloudflare R2 object storage with private access — files are never publicly accessible without a signed URL.',
      },
      {
        question: 'Is my data encrypted?',
        answer:
          'Yes. All data in transit is protected by TLS/HTTPS. Passwords are hashed with bcrypt and never stored in plaintext. Database access is restricted to application servers only.',
      },
      {
        question: 'Do you sell or share my financial data?',
        answer:
          'No. We do not sell your personal or financial data. We share data only with service providers needed to operate the app (Anthropic for AI extraction, Stripe for payments, SendGrid for email). See our Privacy Policy for the full list.',
      },
      {
        question: 'Does Anthropic use my documents to train AI models?',
        answer:
          "No. Documents submitted via the Claude API are processed under Anthropic's API terms, which do not use your data to train models.",
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
          'Currently each account is tied to one business entity. Multi-entity support is planned for our Advanced tier. Contact us if you need this sooner.',
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
          <Link to="/blog" className="text-[#0066FF] hover:underline">
            Visit our blog
          </Link>{' '}
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
