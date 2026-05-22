import { type FC } from 'react';
import { NavLink } from 'react-router-dom';

const Section: FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <section className="mb-10">
    <h2 className="text-xl font-semibold text-gray-900 mb-4">{n}. {title}</h2>
    <div className="space-y-3 text-gray-600 leading-relaxed">{children}</div>
  </section>
);

const Sub: FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mt-4">
    <h3 className="text-base font-semibold text-gray-800 mb-2">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
);

export const TermsOfService: FC = () => (
  <div className="min-h-screen bg-gray-50 py-10 px-4">
    <div className="max-w-3xl mx-auto">

      {/* Back link */}
      <NavLink to="/login" className="inline-flex items-center gap-1.5 text-sm text-[#0066FF] hover:underline mb-8">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to sign in
      </NavLink>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400">Effective date: May 21, 2026 · Time2Win Inc.</p>
        <p className="mt-4 text-gray-600 leading-relaxed">
          These Terms of Service ("Terms") govern your use of AI Bookkeeping, a service operated by
          Time2Win Inc. ("Company", "we", "us", or "our"). By creating an account or using our service,
          you agree to be bound by these Terms. Please read them carefully.
        </p>
      </div>

      {/* Body */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10">

        <Section n={1} title="Description of Service">
          <p>AI Bookkeeping is a cloud-based bookkeeping and financial document management service that uses
          artificial intelligence to extract, categorize, and organize financial data from uploaded receipts,
          invoices, and other financial documents. The service generates Excel workbooks, expense reports, and
          tax summaries for small businesses and freelancers.</p>
          <p>The service is intended for informational and organizational purposes. It does not constitute
          professional accounting, tax, or legal advice.</p>
        </Section>

        <Section n={2} title="Eligibility">
          <p>You must be at least 18 years old and capable of entering into a binding contract to use this
          service. By using AI Bookkeeping, you represent and warrant that you meet these requirements.</p>
          <p>The service is primarily intended for use by businesses and individuals in Canada and the United
          States. Use of the service from other jurisdictions is at your own risk and subject to applicable
          local laws.</p>
        </Section>

        <Section n={3} title="Account Registration">
          <p>You must create an account with a valid email address. You are responsible for maintaining the
          confidentiality of your account credentials and for all activity that occurs under your account.</p>
          <p>You agree to provide accurate and complete information when creating your account and to keep
          that information up to date. Time2Win Inc. reserves the right to suspend or terminate accounts
          that provide false or misleading information.</p>
          <p>You must verify your email address to activate your account. Unverified accounts may have
          limited functionality.</p>
        </Section>

        <Section n={4} title="Subscription and Billing">
          <Sub title="Plans">
            <p>AI Bookkeeping offers paid subscription plans (Starter, Growth, Pro) with different document
            upload limits and storage quotas. Plan details and pricing are displayed at app.ai-bookkeeping.ai/subscription
            and are subject to change with notice.</p>
          </Sub>
          <Sub title="Free Trial">
            <p>New accounts receive a 5-day free trial with access to 5 document uploads. A valid credit or
            debit card is required to start a trial. You will not be charged until the trial ends. If you
            cancel before the trial ends, no charge will be made.</p>
          </Sub>
          <Sub title="Billing">
            <p>Subscriptions are billed monthly. Payments are processed by Stripe. By providing payment
            information, you authorize Time2Win Inc. to charge your payment method for all subscription fees
            and applicable taxes. All prices are in Canadian dollars (CAD) and exclusive of applicable taxes.</p>
          </Sub>
          <Sub title="Cancellation">
            <p>You may cancel your subscription at any time through the billing portal in Settings. Cancellation
            takes effect at the end of the current billing period. No refunds are provided for unused portions
            of a billing period.</p>
          </Sub>
          <Sub title="Price Changes">
            <p>We may change subscription prices. We will provide at least 30 days' notice of any price increase
            via email. Your continued use of the service after the price change takes effect constitutes
            acceptance of the new price.</p>
          </Sub>
        </Section>

        <Section n={5} title="Acceptable Use">
          <p>You agree not to use AI Bookkeeping to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Upload documents you do not own or have no right to process</li>
            <li>Upload illegal, fraudulent, or falsified financial documents</li>
            <li>Attempt to reverse-engineer, decompile, or extract source code from our service</li>
            <li>Use automated bots or scripts to upload documents at a rate that exceeds normal human use</li>
            <li>Attempt to gain unauthorized access to other users' accounts or our systems</li>
            <li>Resell or sublicense access to the service without our written consent</li>
            <li>Violate any applicable law or regulation</li>
          </ul>
        </Section>

        <Section n={6} title="Your Content">
          <Sub title="Ownership">
            <p>You retain full ownership of all documents and data you upload to AI Bookkeeping. We do not
            claim any ownership rights over your content.</p>
          </Sub>
          <Sub title="License">
            <p>By uploading content to AI Bookkeeping, you grant Time2Win Inc. a limited, non-exclusive,
            royalty-free license to process, store, and display your content solely for the purpose of
            providing the service to you.</p>
          </Sub>
          <Sub title="AI Processing">
            <p>Your uploaded documents are transmitted to Anthropic's Claude API for AI-assisted data
            extraction. By using our service, you consent to this processing. We do not use your documents
            to train AI models. Anthropic's data processing is governed by their terms of service.</p>
          </Sub>
          <Sub title="Human Review">
            <p>We do not have human staff review your financial documents as part of normal service
            operations. However, in limited cases (e.g., investigating reported errors or legal requests),
            authorized Time2Win Inc. personnel may review relevant content.</p>
          </Sub>
        </Section>

        <Section n={7} title="Intellectual Property">
          <p>AI Bookkeeping, including its software, design, logos, and content (excluding your uploaded
          documents), is owned by Time2Win Inc. and protected by intellectual property laws. You may not
          copy, modify, distribute, or create derivative works of our service or content without our
          express written consent.</p>
        </Section>

        <Section n={8} title="Disclaimer of Warranties">
          <p>AI Bookkeeping is provided "as is" and "as available" without warranties of any kind, either
          express or implied. We do not warrant that the service will be error-free, uninterrupted, or that
          AI-extracted data will be accurate or complete.</p>
          <p>The service does not constitute professional accounting, tax, legal, or financial advice. You
          should consult a qualified professional for advice specific to your situation.</p>
        </Section>

        <Section n={9} title="Limitation of Liability">
          <p>To the maximum extent permitted by applicable law, Time2Win Inc. shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages, including loss of profits, data,
          or business opportunities, arising from your use of or inability to use the service.</p>
          <p>Our total liability to you for any claim arising from these Terms or your use of the service
          shall not exceed the amount you paid to us in the 12 months preceding the claim.</p>
        </Section>

        <Section n={10} title="Indemnification">
          <p>You agree to indemnify, defend, and hold harmless Time2Win Inc. and its officers, directors,
          employees, and agents from and against any claims, liabilities, damages, losses, and expenses
          (including reasonable legal fees) arising out of or in any way connected with your use of the
          service, your violation of these Terms, or your violation of any third-party right.</p>
        </Section>

        <Section n={11} title="Third-Party Services">
          <p>AI Bookkeeping integrates with third-party services including Stripe, Anthropic, SendGrid,
          and Telegram. These services are governed by their own terms of service and privacy policies.
          Time2Win Inc. is not responsible for the practices of third-party services.</p>
        </Section>

        <Section n={12} title="Service Availability">
          <p>We aim to provide a reliable service but do not guarantee 100% uptime. We may suspend or
          discontinue the service or features at any time, with or without notice, for maintenance,
          updates, or other operational reasons. We will make reasonable efforts to provide advance
          notice of planned downtime.</p>
        </Section>

        <Section n={13} title="Termination">
          <p>You may close your account at any time. We may suspend or terminate your account if you
          violate these Terms, engage in fraudulent activity, or for any other reason at our discretion
          with reasonable notice where practicable.</p>
          <p>Upon termination, your right to use the service ceases immediately. We will delete or
          anonymize your data within 30 days, except where we are required by law to retain it.</p>
        </Section>

        <Section n={14} title="Governing Law and Dispute Resolution">
          <p>These Terms are governed by the laws of the Province of Ontario and the federal laws of
          Canada applicable therein, without regard to conflict of law principles.</p>
          <p>Any dispute arising from these Terms or your use of the service shall first be addressed
          through good-faith negotiation. If unresolved, disputes shall be submitted to binding
          arbitration in accordance with the Arbitration Act (Ontario). Class actions and jury trials
          are waived to the extent permitted by law.</p>
        </Section>

        <Section n={15} title="Changes to These Terms">
          <p>We may update these Terms from time to time. We will notify you of material changes via
          email and/or a notice within the app at least 14 days before the changes take effect. Your
          continued use of the service after the effective date constitutes your acceptance of the
          updated Terms.</p>
        </Section>

        <Section n={16} title="Miscellaneous">
          <p>These Terms constitute the entire agreement between you and Time2Win Inc. regarding your
          use of the service. If any provision is found unenforceable, the remaining provisions will
          remain in full force. Our failure to enforce any right or provision does not constitute a
          waiver. You may not assign your rights under these Terms without our written consent.</p>
        </Section>

        <Section n={17} title="Contact Us">
          <p>If you have questions about these Terms, please contact us:</p>
          <div className="mt-3 bg-gray-50 rounded-lg px-5 py-4 text-sm">
            <p className="font-semibold text-gray-900">Time2Win Inc.</p>
            <p className="mt-1">Email:{' '}
              <a href="mailto:customerservice@ai-bookkeeping.ai" className="text-[#0066FF] hover:underline">
                customerservice@ai-bookkeeping.ai
              </a>
            </p>
          </div>
        </Section>

      </div>

      <p className="text-center text-xs text-gray-400 mt-8">
        © 2026 Time2Win Inc. ·{' '}
        <NavLink to="/privacy-policy" className="hover:underline">Privacy Policy</NavLink>
      </p>
    </div>
  </div>
);
