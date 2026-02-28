// =============================================================
// pages/Impressum.tsx — Legal Notice (required by German TMG §5)
// =============================================================
// IMPORTANT: Replace placeholder values with actual company details
// before deploying to production.

import { Link } from 'react-router-dom';

export default function Impressum() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
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
        <h1 className="text-3xl font-bold text-secondary font-display mb-8">Impressum</h1>
        <p className="text-xs text-slate-400 mb-8">Angaben gemäß § 5 TMG</p>

        <div className="space-y-8 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-secondary mb-2">Company Information</h2>
            {/* TODO: Replace with actual company registration details */}
            <p>
              myfynzo<br />
              [Your Full Legal Name / Company Name]<br />
              [Street Address]<br />
              [Postal Code] [City], Germany
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-2">Contact</h2>
            <p>
              Email: hello@myfynzo.com<br />
              {/* TODO: Add phone number if required by your business type */}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-2">Represented by</h2>
            {/* TODO: Replace with actual managing director / owner */}
            <p>[Managing Director / Geschäftsführer Name]</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-2">Registration</h2>
            {/* TODO: Add if applicable */}
            <p>
              {/* Handelsregister: Amtsgericht [City], HRB [Number] */}
              {/* USt-IdNr.: DE [Number] */}
              [Registration details — add when company is registered]
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-2">Responsible for Content (§ 55 Abs. 2 RStV)</h2>
            <p>
              [Name]<br />
              [Address]
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-2">EU Dispute Resolution</h2>
            <p className="text-sm">
              The European Commission provides a platform for online dispute resolution (OS):{' '}
              <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer"
                className="text-primary hover:underline">
                https://ec.europa.eu/consumers/odr/
              </a>
            </p>
            <p className="text-sm mt-2">
              We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-secondary mb-2">Disclaimer</h2>
            <p className="text-sm">
              myfynzo is a financial planning and tracking tool. It does not constitute financial advice,
              investment advice, or tax advice. The tax calculators provide estimates based on publicly
              available tax rules and should not be relied upon as a substitute for professional tax consultation.
              All investment decisions are made at your own risk.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-100">
          <div className="flex gap-4 text-sm text-slate-400">
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
