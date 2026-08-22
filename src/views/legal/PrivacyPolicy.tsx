import { type FC } from 'react';
import { NavLink } from 'react-router-dom';
import SiteFooter from '@/components/Layout/SiteFooter';

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
        <p className="text-sm text-gray-400">Effective date: July 14, 2026 · Time2Win Inc.</p>
      </div>

      {/* Body */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10">

        <Section title="1. Who we are">
          <p>AI Bookkeeping (ai-bookkeeping.ai) is operated by <strong>Time2Win Inc., a corporation organized
          under the laws of British Columbia, Canada</strong>. Time2Win Inc. is responsible for the personal
          information handled through the service and is accountable for it under the Personal Information
          Protection and Electronic Documents Act (PIPEDA). If you have questions about this policy or how your
          information is handled, contact us at{' '}
          <a href="mailto:support@ai-bookkeeping.ai" className="text-[#0066FF] hover:underline">support@ai-bookkeeping.ai</a>.</p>
          <p>This policy applies to the AI Bookkeeping website and application at ai-bookkeeping.ai, our API, and
          our Telegram bot.</p>
        </Section>

        <Section title="2. Your records and our role">
          <p>You and your business decide which financial records to upload to AI Bookkeeping. Those records
          belong to your business. Time2Win Inc. processes them for one purpose: to provide the bookkeeping
          service you signed up for — organizing, categorizing, and preparing your financial documents and
          transactions. We do not sell your information, and we do not use it for advertising.</p>
        </Section>

        <Section title="3. Information we collect">
          <p><strong>Account information.</strong> Your name, email address, password (stored in hashed form),
          and business details you provide, such as your business name and province.</p>
          <p><strong>Financial records you upload or connect.</strong> This is the core of the service and
          includes:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>receipts and invoices,</li>
            <li>bank and credit card transaction data (through our banking connection provider, Plaid),</li>
            <li>supplier and vendor details that appear on your documents,</li>
            <li>the accounting records the service produces from them (categorizations, journal entries, reconciliations).</li>
          </ul>
          <p><strong>Bank connection information.</strong> When you connect a bank account through Plaid, we
          receive transaction and account data. <strong>We never see or store your online banking username or
          password</strong> — the connection is established directly between you and Plaid. The access
          credentials Plaid issues to us are stored encrypted.</p>
          <p><strong>Payment information.</strong> Payments are processed by Stripe. Your card details go directly
          to Stripe and are never stored on our servers.</p>
          <p><strong>Service and technical information.</strong> Log data needed to operate and secure the service
          (such as request logs and error reports), and operational metadata about your bank connection (such as
          when it last synced and whether syncs are failing) so we can keep it healthy.</p>
        </Section>

        <Section title="4. How we use your information">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>To provide the service: reading your documents, extracting their contents, categorizing
            transactions, drafting accounting entries, and keeping your books.</li>
            <li>To operate, secure, and improve the service, including monitoring for errors and outages.</li>
            <li>To communicate with you: account verification, receipts, service and security notices.</li>
            <li>To meet our legal obligations.</li>
          </ul>
        </Section>

        <Section title="5. AI processing">
          <p>AI Bookkeeping is an AI-powered service, and we want to be precise about what that means:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>When you upload a document or connect transactions, the relevant text and images are processed by
            <strong> Anthropic's Claude models</strong> to extract and categorize the information.</li>
            <li>This processing happens under Anthropic's commercial API terms. <strong>Your documents and data
            are not used to train AI models.</strong></li>
            <li>Anthropic is the only AI provider that receives your documents. No other AI company has access to
            your data.</li>
            <li>AI output is subject to review controls inside the service; the AI does not move your money and
            cannot access your bank accounts.</li>
          </ul>
        </Section>

        <Section title="6. Third-party service providers">
          <p>We rely on a small number of service providers, each for a specific job:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Hosting:</strong> Railway (application and database hosting)</li>
            <li><strong>Document storage:</strong> Cloudflare R2</li>
            <li><strong>AI processing:</strong> Anthropic</li>
            <li><strong>Bank connections:</strong> Plaid</li>
            <li><strong>Payments:</strong> Stripe</li>
            <li><strong>Email delivery:</strong> SendGrid</li>
            <li><strong>Error monitoring:</strong> Sentry</li>
          </ul>
          <p>Each provider receives only the information needed for its role, under contractual terms that
          restrict how it may use that information.</p>
        </Section>

        <Section title="7. Where your information is stored (cross-border transfers)">
          <p>Our servers and several of our service providers are located in the <strong>United States</strong>.
          This means your information, including your financial records, is stored and processed outside Canada.
          While it is outside Canada, it is subject to the laws of the jurisdiction where it is held, and may be
          accessible to authorities there under those laws. We use contractual and security safeguards with all
          of our providers to protect your information wherever it is processed. By using the service, you
          acknowledge this transfer.</p>
        </Section>

        <Section title="8. How we protect your information">
          <p>We treat your financial records as highly sensitive and protect them with safeguards that include:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Encryption in transit.</strong> All connections to the service use TLS (HTTPS), enforced
            across the site.</li>
            <li><strong>Encryption at rest for bank credentials.</strong> The access tokens for your bank
            connections are stored encrypted.</li>
            <li><strong>Private document storage.</strong> Your uploaded documents are held in private cloud
            storage. They are never publicly accessible; documents are served only through signed links that
            expire after a short time.</li>
            <li><strong>Role-based access.</strong> Access inside the service is limited by role, and reviewer
            access is scoped to the specific businesses a reviewer is assigned to.</li>
            <li><strong>Audit logging.</strong> Changes to your accounting records are written to append-only
            audit logs.</li>
            <li><strong>Monitoring and alerting.</strong> The service is continuously monitored for errors and
            downtime, with daily operational checks that alert us to problems such as failing bank syncs or
            unreviewed items aging in queues.</li>
            <li><strong>Deletion that actually deletes.</strong> When you delete a document or your account, the
            stored files themselves are erased from storage — not just the database records pointing to them (see
            Section 9).</li>
          </ul>
          <p>No system can be guaranteed 100% secure, but security review and hardening of the service is a
          continuous, ongoing program.</p>
        </Section>

        <Section title="9. Data retention and deletion">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>We retain your information while your account is active, so the service can do its job.</li>
            <li><strong>When you delete a document, the stored file is deleted from our cloud storage,</strong>
            along with its data in the service.</li>
            <li><strong>When you delete your account, your documents and data are erased,</strong> including the
            underlying files in storage.</li>
            <li>Where a law requires us to retain specific records, we will retain them for the period the law
            requires and no longer.</li>
            <li>You may request erasure of your personal information at any time by contacting{' '}
            <a href="mailto:support@ai-bookkeeping.ai" className="text-[#0066FF] hover:underline">support@ai-bookkeeping.ai</a>.</li>
          </ul>
        </Section>

        <Section title="10. Security incidents">
          <p>We maintain documented procedures to detect, investigate, contain, and recover from security
          incidents. If a breach of security safeguards creates a real risk of significant harm to you, we will
          notify you and report to the Office of the Privacy Commissioner of Canada, as required by PIPEDA, as
          soon as feasible. We also keep records of security incidents as PIPEDA requires.</p>
        </Section>

        <Section title="11. Cookies and tracking">
          <p>We do not use advertising cookies, analytics services, or tracking technologies. When you sign in,
          the service uses authentication tokens stored on your device solely to keep you signed in; they are
          removed when you sign out.</p>
        </Section>

        <Section title="12. Your rights">
          <p>Under PIPEDA, you have the right to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>access</strong> the personal information we hold about you,</li>
            <li><strong>correct</strong> it if it is inaccurate,</li>
            <li><strong>withdraw consent</strong> to our handling of your information (which may mean we can no
            longer provide the service),</li>
            <li><strong>request deletion</strong> as described in Section 9,</li>
            <li>and <strong>complain</strong> to us, or to the Office of the Privacy Commissioner of Canada, about
            our information-handling practices.</li>
          </ul>
          <p>To exercise any of these rights, contact{' '}
          <a href="mailto:support@ai-bookkeeping.ai" className="text-[#0066FF] hover:underline">support@ai-bookkeeping.ai</a>.</p>
        </Section>

        <Section title="13. Changes to this policy">
          <p>When we make material changes to this policy, we will update the effective date at the top and, where
          the change is significant, notify you through the service or by email. Prior versions are available on
          request.</p>
        </Section>

      </div>

      <p className="text-center text-xs text-gray-400 mt-8">
        Time2Win Inc. · British Columbia, Canada ·{' '}
        <a href="mailto:support@ai-bookkeeping.ai" className="hover:underline">support@ai-bookkeeping.ai</a>
      </p>
      <p className="text-center text-xs text-gray-400 mt-2">
        <NavLink to="/terms-of-service" className="hover:underline">Terms of Service</NavLink>
      </p>
    </div>

    <SiteFooter />
  </div>
);
