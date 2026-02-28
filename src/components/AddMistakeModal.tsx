import { useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { AntiPortfolioItem } from '../pages/AntiPortfolio';

interface AddMistakeModalProps {
  onAdd: (item: Omit<AntiPortfolioItem, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}

export default function AddMistakeModal({ onAdd, onClose }: AddMistakeModalProps) {
  const { currency } = useCurrency();
  
  const [formData, setFormData] = useState({
    title: '',
    category: 'stocks' as AntiPortfolioItem['category'],
    wouldHaveInvested: 0,
    dateConsidered: new Date().toISOString().split('T')[0],
    currentValue: 0,
    reasoning: '',
    emotionalTrigger: 'fomo' as AntiPortfolioItem['emotionalTrigger'],
    lessonsLearned: '',
    dodgedBullet: true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || formData.wouldHaveInvested <= 0) {
      console.log('Please fill in required fields');
      return;
    }

    onAdd({
      ...formData,
      dateConsidered: new Date(formData.dateConsidered)
    });
  };

  const categories = [
    { value: 'crypto', label: 'Cryptocurrency', icon: '₿' },
    { value: 'stocks', label: 'Stocks / ETFs', icon: '📈' },
    { value: 'real-estate', label: 'Real Estate', icon: '🏠' },
    { value: 'business', label: 'Business / Startup', icon: '💼' },
    { value: 'other', label: 'Other', icon: '🎯' }
  ];

  const triggers = [
    { value: 'fomo', label: 'FOMO', emoji: '😱', description: 'Fear of missing out' },
    { value: 'greed', label: 'Greed', emoji: '🤑', description: 'Wanted quick profits' },
    { value: 'hype', label: 'Hype', emoji: '🚀', description: 'Media/social media hype' },
    { value: 'peer-pressure', label: 'Peer Pressure', emoji: '👥', description: 'Friends/family influence' },
    { value: 'fear', label: 'Fear', emoji: '😨', description: 'Fear of missing safety' },
    { value: 'overconfidence', label: 'Overconfidence', emoji: '💪', description: 'Thought you had an edge' }
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b-2 border-secondary-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-secondary">Add Anti-Portfolio Entry</h2>
            <p className="text-sm text-secondary-500 mt-1">Document a mistake you almost made</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-secondary-300 hover:text-secondary-500 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Investment Title */}
          <div>
            <label className="block text-sm font-semibold text-secondary-700 mb-2">
              What Investment Did You Almost Make? *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Bitcoin at $60K, GameStop during meme rally, friend's crypto startup"
              className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              required
            />
          </div>

          {/* Category & Date */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-secondary-700 mb-2">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as AntiPortfolioItem['category'] })}
                className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-secondary-700 mb-2">
                When Did You Consider This?
              </label>
              <input
                type="date"
                value={formData.dateConsidered}
                onChange={(e) => setFormData({ ...formData, dateConsidered: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
          </div>

          {/* Investment Amounts */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-secondary-700 mb-2">
                How Much Would You Have Invested? ({currency}) *
              </label>
              <input
                type="number"
                value={formData.wouldHaveInvested || ''}
                onChange={(e) => setFormData({ ...formData, wouldHaveInvested: Number(e.target.value) })}
                placeholder="10000"
                min="0"
                step="100"
                className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-secondary-700 mb-2">
                What Would It Be Worth Now? ({currency}) *
              </label>
              <input
                type="number"
                value={formData.currentValue || ''}
                onChange={(e) => setFormData({ ...formData, currentValue: Number(e.target.value) })}
                placeholder="5000"
                min="0"
                step="100"
                className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                required
              />
              <p className="text-xs text-secondary-400 mt-1">
                If you would have lost money, enter a lower value. If missed gains, enter higher.
              </p>
            </div>
          </div>

          {/* Quick Calculation Preview */}
          {formData.wouldHaveInvested > 0 && formData.currentValue >= 0 && (
            <div className={`p-4 rounded-xl border-2 ${
              formData.currentValue < formData.wouldHaveInvested
                ? 'bg-green-50 border-green-300'
                : 'bg-amber-50 border-amber-300'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  {formData.currentValue < formData.wouldHaveInvested ? (
                    <>
                      <div className="text-sm text-green-900 font-semibold">🎯 Dodged Bullet!</div>
                      <div className="text-lg text-green-700 font-bold">
                        Saved: {currency}{(formData.wouldHaveInvested - formData.currentValue).toLocaleString()}
                      </div>
                    </>
                  ) : formData.currentValue > formData.wouldHaveInvested ? (
                    <>
                      <div className="text-sm text-amber-900 font-semibold">📊 Missed Gain</div>
                      <div className="text-lg text-amber-700 font-bold">
                        Opportunity Cost: {currency}{(formData.currentValue - formData.wouldHaveInvested).toLocaleString()}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-secondary-500">Break-even scenario</div>
                  )}
                </div>
                <div className="text-2xl">
                  {formData.currentValue < formData.wouldHaveInvested ? '✅' : '📊'}
                </div>
              </div>
            </div>
          )}

          {/* Outcome Type */}
          <div>
            <label className="block text-sm font-semibold text-secondary-700 mb-3">
              What Happened?
            </label>
            <div className="grid md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, dodgedBullet: true })}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  formData.dodgedBullet
                    ? 'border-green-500 bg-green-50'
                    : 'border-secondary-200 bg-white hover:border-green-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🎯</span>
                  <span className="font-bold text-green-900">Dodged Bullet</span>
                </div>
                <p className="text-sm text-green-700">
                  You avoided a loss. Smart decision!
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, dodgedBullet: false })}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  !formData.dodgedBullet
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-secondary-200 bg-white hover:border-amber-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">📊</span>
                  <span className="font-bold text-amber-900">Missed Gain</span>
                </div>
                <p className="text-sm text-amber-700">
                  You missed profits. Learning moment.
                </p>
              </button>
            </div>
          </div>

          {/* Emotional Trigger */}
          <div>
            <label className="block text-sm font-semibold text-secondary-700 mb-3">
              What Emotional Trigger Almost Got You? *
            </label>
            <div className="grid md:grid-cols-2 gap-3">
              {triggers.map(trigger => (
                <button
                  key={trigger.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, emotionalTrigger: trigger.value as AntiPortfolioItem['emotionalTrigger'] })}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${
                    formData.emotionalTrigger === trigger.value
                      ? 'border-primary bg-primary/10'
                      : 'border-secondary-200 hover:border-primary'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{trigger.emoji}</span>
                    <span className="font-semibold text-secondary">{trigger.label}</span>
                  </div>
                  <p className="text-xs text-secondary-500">{trigger.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Reasoning */}
          <div>
            <label className="block text-sm font-semibold text-secondary-700 mb-2">
              Why Did You Almost Do It?
            </label>
            <textarea
              value={formData.reasoning}
              onChange={(e) => setFormData({ ...formData, reasoning: e.target.value })}
              placeholder="Describe what made this seem like a good idea at the time..."
              rows={3}
              className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none"
            />
          </div>

          {/* Lessons Learned */}
          <div>
            <label className="block text-sm font-semibold text-secondary-700 mb-2">
              What Did You Learn? *
            </label>
            <textarea
              value={formData.lessonsLearned}
              onChange={(e) => setFormData({ ...formData, lessonsLearned: e.target.value })}
              placeholder="What lesson will you remember next time you feel this trigger..."
              rows={3}
              className="w-full px-4 py-3 border border-secondary-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none"
              required
            />
            <p className="text-xs text-secondary-400 mt-1">
              Be specific. This reminder will help you avoid similar mistakes.
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-primary to-teal-600 text-white rounded-xl hover:shadow-xl transition-all font-bold"
            >
              Add to Anti-Portfolio
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-secondary-200 rounded-xl hover:bg-secondary-50 transition-all font-semibold text-secondary-700"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
