import { useCurrency } from '../context/CurrencyContext';
import { AntiPortfolioItem } from '../pages/AntiPortfolio';

interface AntiPortfolioCardProps {
  item: AntiPortfolioItem;
  onDelete: (id: string) => void;
}

export default function AntiPortfolioCard({ item, onDelete }: AntiPortfolioCardProps) {
  const { formatAmount, formatCompact } = useCurrency();

  const impact = item.currentValue - item.wouldHaveInvested;
  const impactPercent = item.wouldHaveInvested > 0 
    ? ((impact / item.wouldHaveInvested) * 100) 
    : 0;

  const categoryIcons = {
    crypto: '₿',
    stocks: '📈',
    'real-estate': '🏠',
    business: '💼',
    other: '🎯'
  };

  const categoryColors = {
    crypto: 'from-orange-500 to-amber-500',
    stocks: 'from-blue-500 to-cyan-500',
    'real-estate': 'from-green-500 to-emerald-500',
    business: 'from-purple-500 to-pink-500',
    other: 'from-slate-500 to-slate-600'
  };

  const triggerEmojis = {
    fomo: '😱',
    greed: '🤑',
    fear: '😨',
    hype: '🚀',
    'peer-pressure': '👥',
    overconfidence: '💪'
  };

  const triggerLabels = {
    fomo: 'FOMO',
    greed: 'Greed',
    fear: 'Fear',
    hype: 'Hype',
    'peer-pressure': 'Peer Pressure',
    overconfidence: 'Overconfidence'
  };

  return (
    <div className={`bg-white rounded-2xl p-6 border-2 shadow-lg transition-all hover:shadow-xl ${
      item.dodgedBullet 
        ? 'border-green-200 bg-green-50/30' 
        : 'border-amber-200 bg-amber-50/30'
    }`}>
      <div className="flex items-start justify-between mb-4">
        {/* Header */}
        <div className="flex items-start gap-4 flex-1">
          {/* Icon */}
          <div className={`w-14 h-14 bg-gradient-to-br ${categoryColors[item.category]} rounded-xl flex items-center justify-center text-2xl shadow-lg`}>
            {categoryIcons[item.category]}
          </div>

          {/* Title & Meta */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-secondary">{item.title}</h3>
              {item.dodgedBullet && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">
                  🎯 DODGED
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-secondary-500">
              <span>{new Date(item.dateConsidered).toLocaleDateString()}</span>
              <span>•</span>
              <span className="capitalize">{item.category.replace('-', ' ')}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                {triggerEmojis[item.emotionalTrigger]}
                {triggerLabels[item.emotionalTrigger]}
              </span>
            </div>
          </div>
        </div>

        {/* Delete Button */}
        <button
          onClick={() => onDelete(item.id)}
          className="p-2 text-secondary-300 hover:text-red-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Financial Impact */}
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-lg p-4 border border-secondary-200">
          <div className="text-xs text-secondary-400 mb-1">Would Have Invested</div>
          <div className="text-xl font-bold text-secondary-700">
            {formatAmount(item.wouldHaveInvested)}
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-secondary-200">
          <div className="text-xs text-secondary-400 mb-1">Current Value</div>
          <div className="text-xl font-bold text-secondary-700">
            {formatAmount(item.currentValue)}
          </div>
        </div>

        <div className={`rounded-lg p-4 ${
          item.dodgedBullet 
            ? 'bg-green-100 border border-green-300' 
            : 'bg-amber-100 border border-amber-300'
        }`}>
          <div className={`text-xs mb-1 ${
            item.dodgedBullet ? 'text-green-700' : 'text-amber-700'
          }`}>
            {item.dodgedBullet ? 'Saved' : 'Missed Gain'}
          </div>
          <div className={`text-xl font-bold ${
            item.dodgedBullet ? 'text-green-700' : 'text-amber-700'
          }`}>
            {item.dodgedBullet ? '+' : '-'}{formatAmount(Math.abs(impact))}
          </div>
          <div className={`text-xs ${
            item.dodgedBullet ? 'text-green-600' : 'text-amber-600'
          }`}>
            {impactPercent >= 0 ? '+' : ''}{impactPercent.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Reasoning */}
      {item.reasoning && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-xs font-semibold text-blue-900 mb-2">💭 Why You Almost Did It:</div>
          <p className="text-sm text-blue-800">{item.reasoning}</p>
        </div>
      )}

      {/* Lessons Learned */}
      {item.lessonsLearned && (
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="text-xs font-semibold text-purple-900 mb-2">🎓 What You Learned:</div>
          <p className="text-sm text-purple-800">{item.lessonsLearned}</p>
        </div>
      )}

      {/* Reminder */}
      {item.dodgedBullet && impact > 10000 && (
        <div className="mt-4 p-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg text-sm text-center font-semibold">
          🎉 You saved {formatCompact(Math.abs(impact))} by trusting your gut!
        </div>
      )}
    </div>
  );
}
