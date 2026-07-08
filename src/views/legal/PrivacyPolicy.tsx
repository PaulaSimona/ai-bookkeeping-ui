import { type FC } from 'react';
import { NavLink } from 'react-router-dom';

const Section: FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mb-10">
    <h2 className="text-xl font-semibold text-gray-900 mb-4">{title}</h2>
    <div className="space-y-3 text-gray-600 leading-relaxed">{children}</div>
  </section>
);

const Sub: FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mt-4">
    <h3 className="text-base font-semibold text-gray-800 mb-2">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
);

export const PrivacyPolicy: FC = () => (
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400">Effective date: May 21, 2026 · Time2Win Inc.</p>
        <p className="mt-4 text-gray-600 leading-relaxed">
          AI Bookkeeping is operated by Time2Win Inc. ("we", "our", or "us"). This Privacy Policy explains how we
          collect, use, disclose, and protect information when you use our service at app.ai-bookkeeping.ai. By
          using our service, you agree to the practices described here.
        </p>
      </div>

      {/* Body */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10">

        <Section title="1. Information We Collect">
          <Sub title="Account Information">
            <p>When you create an account, we collect your name, email address, and password. We also collect your
            business name, business address, province or state, and GST/HST registration number when you complete
            your business profile.</p>
          </Sub>
          <Sub title="Financial Documents">
            <p>You may upload receipts, invoices, and other financial documents. These files are transmitted to our
            AI processing pipeline for data extraction. We store the extracted structured data (vendor names,
            amounts, dates, categories) in our database.</p>
          </Sub>
          <Sub title="Usage Data">
            <p>We automatically collect information about how you interact with our service, including pages
            visited, features used, upload timestamps, and error events. This helps us improve the product.</p>
          </Sub>
          <Sub title="Payment Information">
            <p>Payments are processed by Stripe. We do not store your card number, CVV, or full card details.
            Stripe provides us with a tokenized reference and basic card metadata (last 4 digits, expiry, brand).</p>
          </Sub>
          <Sub title="Telegram Integration (Optional)">
            <p>If you link your Telegram account, we store your Telegram chat ID to enable document submission
            via the bot. Linking is voluntary and can be removed at any time in Settings.</p>
          </Sub>
          <Sub title="Bank Account Data (Optional)">
            <p>If you choose to connect a bank account, we use Plaid Inc. to link it. We receive account
            details (institution, account name, account type, and the last digits of the account number) and
            transaction data in order to provide bookkeeping services. We do not receive or store your bank
            login credentials — you provide those directly to Plaid. Plaid's handling of your data is governed
            by <a href="https://plaid.com/legal/#end-user-privacy-policy" target="_blank" rel="noreferrer" className="text-[#0066FF] hover:underline">Plaid's End User Privacy Policy</a>.</p>
          </Sub>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use your information to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Provide, maintain, and improve the AI Bookkeeping service</li>
            <li>Process your uploaded documents and extract financial data using AI</li>
            <li>Generate Excel workbooks and financial reports for you</li>
            <li>Process subscription payments and manage your account</li>
            <li>Send transactional emails (account verification, password resets, support tickets)</li>
            <li>Respond to support requests and feedback</li>
            <li>Detect and prevent fraud, abuse, and security incidents</li>
            <li>Comply with legal obligations</li>
          </ul>
          <p className="mt-3">We do not use your financial documents or extracted data to train AI models,
          sell advertising, or share with data brokers.</p>
        </Section>

        <Section title="3. How We Share Your Information">
          <p>We do not sell your personal information. We share data only in these circumstances:</p>
          <Sub title="Service Providers">
            <p>We use the following third-party processors to operate our service:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Anthropic (Claude API)</strong> — AI extraction of document data. Documents are transmitted under Anthropic's data processing terms.</li>
              <li><strong>Stripe</strong> — Payment processing and subscription management.</li>
              <li><strong>SendGrid (Twilio)</strong> — Transactional email delivery.</li>
              <li><strong>Telegram</strong> — Bot integration for document submission (only if you opt in).</li>
              <li><strong>Plaid Inc.</strong> — Bank account connections (only if you opt in).</li>
            </ul>
          </Sub>
          <Sub title="Legal Requirements">
            <p>We may disclose information if required by law, court order, or government authority, or to protect
            the rights and safety of our users and the public.</p>
          </Sub>
          <Sub title="Business Transfers">
            <p>If Time2Win Inc. is involved in a merger, acquisition, or sale of assets, your information may be
            transferred. We will notify you via email and/or a notice on our website before your data is
            transferred and becomes subject to a different privacy policy.</p>
          </Sub>
        </Section>

        <Section title="4. Cookies and Tracking">
          <p>We use minimal cookies necessary to operate the service. We do not use third-party advertising
          cookies or cross-site tracking. Specifically:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Authentication tokens</strong> — Stored in your browser's localStorage to keep you signed in.</li>
            <li><strong>Stripe cookies</strong> — Set by Stripe during checkout for fraud prevention.</li>
          </ul>
          <p className="mt-3">We do not use Google Analytics, Facebook Pixel, or similar tracking services.</p>
        </Section>

        <Section title="5. Data Retention">
          <p>We retain your account data and uploaded document data for as long as your account is active.
          If you delete your account, we will delete or anonymize your personal data within 30 days, except
          where we are required by law to retain it (e.g., financial records for tax compliance purposes).</p>
          <p>Uploaded document images are not stored permanently on our servers — only the extracted structured
          data is retained.</p>
        </Section>

        <Section title="6. Data Security">
          <p>We implement industry-standard security measures including:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Encryption in transit (TLS/HTTPS for all connections)</li>
            <li>Encrypted passwords (bcrypt hashing, never stored in plaintext)</li>
            <li>PostgreSQL database with access controls</li>
            <li>Regular security updates and dependency audits</li>
          </ul>
          <p className="mt-3">No method of transmission over the Internet is 100% secure. While we strive to
          protect your data, we cannot guarantee absolute security. Please notify us immediately at{' '}
          <a href="mailto:customerservice@ai-bookkeeping.ai" className="text-[#0066FF] hover:underline">
            customerservice@ai-bookkeeping.ai
          </a>{' '}
          if you suspect a security incident.</p>
        </Section>

        <Section title="7. Your Rights (PIPEDA)">
          <p>As a resident of Canada, you have rights under the Personal Information Protection and Electronic
          Documents Act (PIPEDA), including the right to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Access</strong> — Request a copy of the personal information we hold about you</li>
            <li><strong>Correction</strong> — Ask us to correct inaccurate or incomplete information</li>
            <li><strong>Withdrawal of consent</strong> — Withdraw consent to certain processing (subject to legal or contractual restrictions)</li>
            <li><strong>Deletion</strong> — Request deletion of your account and personal data</li>
            <li><strong>Complaint</strong> — Lodge a complaint with the Office of the Privacy Commissioner of Canada (OPC)</li>
          </ul>
          <p className="mt-3">To exercise these rights, contact us at{' '}
            <a href="mailto:customerservice@ai-bookkeeping.ai" className="text-[#0066FF] hover:underline">
              customerservice@ai-bookkeeping.ai
            </a>.
          </p>
        </Section>

        <Section title="8. Users in the United States">
          <p>If you are using our service from the United States, your data may be processed and stored in
          Canada or other jurisdictions. By using our service, you consent to the transfer of your information
          to Canada and acknowledge that Canadian privacy law governs this policy.</p>
          <p className="mt-2">We do not currently offer services in California and this policy is not intended
          to constitute compliance with the California Consumer Privacy Act (CCPA).</p>
        </Section>

        <Section title="9. Children's Privacy">
          <p>Our service is not directed to individuals under the age of 18. We do not knowingly collect
          personal information from children. If you believe we have inadvertently collected information from
          a minor, please contact us immediately and we will delete it.</p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>We may update this Privacy Policy from time to time. We will notify you of significant changes
          by email or by posting a prominent notice in the app at least 14 days before the change takes effect.
          Your continued use of the service after the effective date constitutes acceptance of the updated policy.</p>
        </Section>

        <Section title="11. Contact Us">
          <p>If you have questions or concerns about this Privacy Policy or our data practices, please contact us:</p>
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
        <NavLink to="/terms-of-service" className="hover:underline">Terms of Service</NavLink>
      </p>
    </div>
  </div>
);
