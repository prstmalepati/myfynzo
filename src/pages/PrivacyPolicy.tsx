// =============================================================
// pages/PrivacyPolicy.tsx — Privacy Policy (GDPR + India DPDP Act)
// =============================================================

import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-100 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-transparent.png" alt="myfynzo" className="w-9 h-9" />
            <span className="text-xl font-bold text-secondary font-display">myfynzo</span>
          </Link>
          <Link to="/" className="text-sm text-slate-500 hover:text-primary transition-colors">← Back</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-secondary font-display mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-8">Last updated: February 2026</p>

        <div className="space-y-8 text-slate-600 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-3">1. Who We Are</h2>
            <p>
              myfynzo ("we", "us", "our") is a financial planning and wealth management platform.
              We are the data controller for the personal data we process.
              {/* TODO: Replace with actual company legal entity name and address */}
            </p>
            <p className="mt-2">
              Contact: <a href="mailto:privacy@myfynzo.com" className="text-primary hover:underline">privacy@myfynzo.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-3">2. Data We Collect</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-secondary">Account Data</h3>
                <p>Email address, name (optional), authentication provider (Google/email), country, and language preference.</p>
              </div>
              <div>
                <h3 className="font-semibold text-secondary">Financial Data (User-Provided)</h3>
                <p>
                  Investment holdings, purchase prices, goals, debts, expenses, income details, and monthly investment plans.
                  This data is entered voluntarily by you and stored in your private, isolated account.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-secondary">Usage Data</h3>
                <p>Login timestamps, feature usage analytics (via Firebase Analytics), and browser/device type.</p>
              </div>
              <div>
                <h3 className="font-semibold text-secondary">Location Data</h3>
                <p>
                  Approximate location (country-level) detected via IP address on first visit to personalize
                  currency, language, and tax calculator settings. Cached locally for 24 hours.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-secondary">AI Interaction Data (Premium)</h3>
                <p>
                  If you use myfynzo Pulse (AI advisor), your questions and a summary of your financial data
                  are sent to Anthropic's Claude API for processing. Conversation previews are stored temporarily
                  for quality improvement and auto-deleted after 90 days.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-3">3. How We Use Your Data</h2>
            <p>We process your data for the following purposes:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Providing the myfynzo service (portfolio tracking, projections, calculators)</li>
              <li>Personalizing your experience (country-specific features, currency, language)</li>
              <li>Generating AI-powered financial insights (Premium feature)</li>
              <li>Improving our service through aggregated, anonymized usage analytics</li>
              <li>Communicating service updates and security notifications</li>
            </ul>
            <p className="mt-3">
              <strong>Legal basis (GDPR Art. 6):</strong> Contract performance (Art. 6(1)(b)) for core features;
              Legitimate interest (Art. 6(1)(f)) for analytics; Consent (Art. 6(1)(a)) for optional cookies and
              marketing communications.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-3">4. Data Storage & Security</h2>
            <p>
              Your data is stored in <strong>Google Firebase (Firestore)</strong> with servers in the EU
              (europe-west1 region). All data is encrypted at rest and in transit.
              Each user's financial data is strictly isolated — no other user or admin can access it
              without explicit Firestore security rules permitting it.
            </p>
            <p className="mt-2">
              We do not store passwords — authentication is handled entirely by Firebase Authentication.
              API keys are stored server-side and never exposed to the client application.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-3">5. Third-Party Services</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-4 font-semibold text-secondary">Service</th>
                    <th className="text-left py-2 pr-4 font-semibold text-secondary">Purpose</th>
                    <th className="text-left py-2 font-semibold text-secondary">Data Shared</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="py-2 pr-4">Google Firebase</td><td className="py-2 pr-4">Authentication, database, hosting</td><td className="py-2">Account data, financial data</td></tr>
                  <tr><td className="py-2 pr-4">Anthropic (Claude API)</td><td className="py-2 pr-4">AI financial advisor (Pulse)</td><td className="py-2">Financial summary, user questions</td></tr>
                  <tr><td className="py-2 pr-4">Twelve Data</td><td className="py-2 pr-4">Stock/ETF price data</td><td className="py-2">Ticker symbols only</td></tr>
                  <tr><td className="py-2 pr-4">CoinGecko</td><td className="py-2 pr-4">Cryptocurrency prices</td><td className="py-2">Crypto symbols only</td></tr>
                  <tr><td className="py-2 pr-4">MFAPI.in</td><td className="py-2 pr-4">Indian mutual fund NAVs</td><td className="py-2">Scheme codes only</td></tr>
                  <tr><td className="py-2 pr-4">ipapi.co</td><td className="py-2 pr-4">Country detection</td><td className="py-2">IP address (auto by request)</td></tr>
                  <tr><td className="py-2 pr-4">exchangerate-api.com</td><td className="py-2 pr-4">Currency exchange rates</td><td className="py-2">None (public API)</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-3">6. Your Rights</h2>
            <div className="space-y-2">
              <p><strong>Under GDPR (EU/Germany):</strong></p>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>Access</strong> — Request a copy of your personal data</li>
                <li><strong>Rectification</strong> — Correct inaccurate data via Settings</li>
                <li><strong>Erasure</strong> — Delete your account and all associated data</li>
                <li><strong>Data Portability</strong> — Export your data in machine-readable format (JSON)</li>
                <li><strong>Restriction / Objection</strong> — Limit or object to certain processing</li>
                <li><strong>Withdraw Consent</strong> — For optional processing (e.g., analytics cookies)</li>
              </ul>
              <p className="mt-3"><strong>Under India DPDP Act 2023:</strong></p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Right to access, correction, and erasure of personal data</li>
                <li>Right to nominate (designate someone to exercise rights on your behalf)</li>
                <li>Right to grievance redressal</li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, email{' '}
                <a href="mailto:privacy@myfynzo.com" className="text-primary hover:underline">privacy@myfynzo.com</a>.
                We will respond within 30 days.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-3">7. Data Retention</h2>
            <ul className="space-y-1 list-disc list-inside">
              <li>Account data: Retained until you delete your account</li>
              <li>Financial data: Retained until you delete your account</li>
              <li>AI conversation history: Auto-deleted after 90 days</li>
              <li>Geolocation cache: 24 hours (localStorage)</li>
            </ul>
            <p className="mt-2">
              When you delete your account, all personal and financial data is permanently removed
              from our systems within 30 days, including all sub-collections and backups.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-3">8. Cookies & Local Storage</h2>
            <p>
              We use minimal cookies and local storage for essential functionality:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><strong>Essential:</strong> Firebase authentication session, language preference, geolocation cache</li>
              <li><strong>Analytics (optional):</strong> Firebase Analytics / Google Analytics for usage patterns</li>
            </ul>
            <p className="mt-2">You can manage cookie preferences via the cookie banner on first visit.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-3">9. Children's Privacy</h2>
            <p>
              myfynzo is not intended for users under 18. We do not knowingly collect personal data from minors.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes
              via email or in-app notification. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-3">11. Contact & Supervisory Authority</h2>
            <p>
              For privacy inquiries: <a href="mailto:privacy@myfynzo.com" className="text-primary hover:underline">privacy@myfynzo.com</a>
            </p>
            <p className="mt-2">
              If you believe your data protection rights have been violated, you have the right to lodge a
              complaint with a supervisory authority. In Germany, the relevant authority depends on the
              Bundesland where the company is registered.
              {/* TODO: Add specific Landesbeauftragte based on registered address */}
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-100">
          <div className="flex gap-4 text-sm text-slate-400">
            <Link to="/impressum" className="hover:text-primary transition-colors">Impressum</Link>
            <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
