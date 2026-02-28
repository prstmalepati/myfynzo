import { useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { usePricing } from '../hooks/usePricing';

const TIER_FEATURES = {
  free: ['Up to 3 investments', 'Basic dashboard', 'Portfolio overview'],
  premium: ['Unlimited investments & assets', '50-year wealth projections', 'All tax calculators (DE, IN)', 'fynzo Intelligence AI advisor', 'Debt & Lifestyle tracking', 'Scenario branching', 'Live market prices', 'CSV broker import', 'PDF reports', 'Priority support'],
};

interface PaywallProps {
  feature: string;
  description?: string;
  onClose?: () => void;
  showClose?: boolean;
}

export default function Paywall({ 
  feature, 
  description, 
  onClose, 
  showClose = true 
}: PaywallProps) {
  const { currency, formatAmount } = useCurrency();
  const { getPrice, getAnnualSavings } = usePricing();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  
  const monthlyPrice = getPrice(currency, 'premium', 'monthly');
  const annualPrice = getPrice(currency, 'premium', 'annual');
  const savings = getAnnualSavings(currency, 'premium');

  const handleUpgrade = () => {
    // TODO: Implement Stripe checkout flow
    console.log(`Upgrade to Premium (${billingPeriod}) - Coming soon!`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8 relative shadow-2xl">
        {/* Close Button */}
        {showClose && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-surface-900-300 hover:text-surface-900-500 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
            <span className="text-white font-bold text-4xl">💎</span>
          </div>
          <h2 className="page-title mb-3">
            Unlock Premium Features
          </h2>
          <p className="text-lg text-surface-900-500">
            <span className="font-semibold text-primary">{feature}</span> is a Premium feature
          </p>
          {description && (
            <p className="text-surface-900-500 mt-2">{description}</p>
          )}
        </div>

        {/* Billing Period Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-secondary-100 rounded-xl p-1">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-surface-900 shadow-md'
                  : 'text-surface-900-500 hover:text-surface-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all relative ${
                billingPeriod === 'annual'
                  ? 'bg-white text-surface-900 shadow-md'
                  : 'text-surface-900-500 hover:text-surface-900'
              }`}
            >
              Annual
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                Save {savings}%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Free Tier */}
          <div className="p-6 border border-secondary-200 rounded-xl bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-surface-900">Free</h3>
              <span className="text-xs bg-secondary-100 px-3 py-1 rounded-full text-surface-900-500 font-semibold">
                Current Plan
              </span>
            </div>
            <div className="mb-6">
              <div className="text-3xl lg:text-4xl font-bold text-surface-900-300 mb-1">
                {formatAmount(0, 0)}
              </div>
              <div className="text-sm text-surface-900-400">Forever free</div>
            </div>
            <ul className="space-y-3 text-sm text-surface-900-500">
              {TIER_FEATURES.free.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-surface-900-300 mt-0.5">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Premium Tier */}
          <div className="p-6 border-2 border-primary bg-gradient-to-br from-teal-50 to-white rounded-xl relative shadow-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-teal-600 text-white px-4 py-1 rounded-full text-xs font-bold shadow-md">
              ⭐ RECOMMENDED
            </div>
            
            <div className="flex items-center justify-between mb-4 mt-2">
              <h3 className="text-2xl font-bold text-surface-900">Premium</h3>
              <span className="text-2xl">💎</span>
            </div>
            
            <div className="mb-6">
              <div className="text-3xl lg:text-4xl font-bold text-primary mb-1">
                {billingPeriod === 'monthly' 
                  ? formatAmount(monthlyPrice, 2)
                  : formatAmount(annualPrice, 0)}
              </div>
              <div className="text-sm text-surface-900-500">
                {billingPeriod === 'monthly' 
                  ? 'per month'
                  : `per year (${formatAmount(annualPrice / 12, 2)}/month)`}
              </div>
              {billingPeriod === 'annual' && (
                <div className="text-xs text-green-600 font-semibold mt-1">
                  Save {formatAmount(monthlyPrice * 12 - annualPrice, 0)} annually
                </div>
              )}
            </div>

            <ul className="space-y-3 text-sm text-surface-900-700 mb-6">
              {TIER_FEATURES.premium.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5 font-bold">✓</span>
                  <span className="font-medium">{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={handleUpgrade}
              className="w-full px-6 py-4 bg-gradient-to-r from-primary to-teal-600 text-white rounded-xl hover:from-teal-600 hover:to-teal-700 transition-all font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Upgrade to Premium
            </button>
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-6 border border-blue-200 mb-6">
          <h4 className="font-bold text-surface-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Why Upgrade?
          </h4>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-semibold text-surface-900 mb-1">🏦 Auto Bank Sync</div>
              <div className="text-surface-900-500">Connect your German banks and automatically track your net worth</div>
            </div>
            <div>
              <div className="font-semibold text-surface-900 mb-1">🎯 Advanced Planning</div>
              <div className="text-surface-900-500">Create unlimited scenarios and see 50+ year projections</div>
            </div>
            <div>
              <div className="font-semibold text-surface-900 mb-1">👨‍👩‍👧‍👦 Family Sharing</div>
              <div className="text-surface-900-500">Track wealth across your household with up to 5 members</div>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="text-center text-sm text-surface-900-500 space-y-2">
          <div className="flex items-center justify-center gap-6">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Cancel anytime
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              No commitments
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Secure payments
            </span>
          </div>
          <p className="text-xs text-surface-900-400">
            Join thousands of users managing their wealth with myfynzo Premium
          </p>
        </div>
      </div>
    </div>
  );
}
