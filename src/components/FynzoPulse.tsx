/**
 * FynzoPulse.tsx — Floating AI Financial Advisor
 * Premium feature: personalized financial advice powered by Claude API
 * Reads user's complete financial data and provides contextual guidance
 */
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useTier } from '../hooks/useTier';
import { gatherFinancialContext } from '../services/financialContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

const DEFAULT_QUESTIONS = [
  "Am I on track for my financial goals?",
  "How is my portfolio diversified?",
  "What's my biggest expense category?",
  "Should I pay off debt or invest more?",
  "How can I reach FIRE faster?",
  "Analyze my investment performance",
];

const PAGE_QUESTIONS: Record<string, string[]> = {
  '/dashboard': [
    "What's changed in my finances this month?",
    "How is my health score calculated?",
    "What should I focus on improving?",
  ],
  '/investments': [
    "Analyze my portfolio concentration risk",
    "Which holdings are underperforming?",
    "Should I rebalance my portfolio?",
  ],
  '/income-debts': [
    "Should I pay off debt or invest more?",
    "Compare snowball vs avalanche for my debts",
    "How can I increase my savings rate?",
  ],
  '/wealth-projection': [
    "Am I on track for retirement?",
    "What if I increase savings by €200/month?",
    "When will I reach financial independence?",
  ],
  '/lifestyle-basket': [
    "What's my biggest expense category?",
    "Where can I cut spending most effectively?",
    "How do my expenses compare to my income?",
  ],
  '/calculators': [
    "How can I optimize my tax situation?",
    "When can I achieve FIRE?",
    "What return do I need to hit my goals?",
  ],
};

export default function FynzoPulse() {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const { isPremium, isFree } = useTier();
  const location = useLocation();
  const SUGGESTED_QUESTIONS = PAGE_QUESTIONS[location.pathname] || DEFAULT_QUESTIONS;
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(false);
  const [financialSummary, setFinancialSummary] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [pulseAnim, setPulseAnim] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Stop pulse animation after 10s
  useEffect(() => {
    const t = setTimeout(() => setPulseAnim(false), 10000);
    return () => clearTimeout(t);
  }, []);

  // Load financial context when chat opens
  useEffect(() => {
    if (isOpen && user && !contextLoaded) {
      loadContext();
    }
  }, [isOpen, user]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const loadContext = async () => {
    if (!user) return;
    try {
      const ctx = await gatherFinancialContext(user.uid);
      setFinancialSummary(ctx.summary);
      setContextLoaded(true);
      
      // Welcome message
      if (messages.length === 0) {
        const welcome: Message = {
          id: 'welcome',
          role: 'assistant',
          content: `Hi! I'm **fynzo Intelligence**, your personal financial advisor. I've analyzed your financial data and I'm ready to help.\n\nI can see your portfolio, expenses, debts, goals, and projections. Ask me anything about your finances — I'll give you personalized, actionable advice.\n\nHere are some things I can help with:`,
          timestamp: new Date(),
        };
        setMessages([welcome]);
      }
    } catch (err) {
      console.error('Error loading financial context:', err);
    }
  };

  const handleOpen = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    if (isFree) {
      setShowPaywall(true);
      return;
    }
    setIsOpen(true);
  };

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading || !user) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let responseText = '';

      // Try Cloud Function first
      try {
        const functions = getFunctions();
        const fynzoPulse = httpsCallable(functions, 'fynzoPulse');
        const history = [...messages.filter(m => m.id !== 'welcome'), userMsg]
          .slice(-10)
          .map(m => ({ role: m.role, content: m.content }));
        const result = await fynzoPulse({
          messages: history,
          financialContext: financialSummary,
          currency,
          locale: navigator.language || 'en',
        });
        const data = result.data as any;
        responseText = data.response || '';
      } catch (cfErr: any) {
        console.error('Cloud Function failed:', cfErr.message);
        // Cloud function is the only supported path — direct API calls from browser fail due to CORS
        const errorMsg = cfErr?.code === 'functions/not-found' 
          ? 'fynzo Intelligence cloud function is not deployed yet. Please deploy Firebase Functions first.'
          : cfErr?.code === 'functions/permission-denied'
          ? 'Premium or Family Premium subscription required for fynzo Intelligence.'
          : cfErr?.code === 'functions/resource-exhausted'
          ? 'Daily message limit reached (30/day). Resets at midnight.'
          : cfErr?.code === 'functions/failed-precondition'
          ? 'AI service not configured. Admin needs to set the Anthropic API key in Firebase (system/api_keys → anthropicKey).'
          : `fynzo Intelligence is temporarily unavailable. ${cfErr?.message || 'Please try again later.'}`;
        throw new Error(errorMsg);
      }

      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: responseText || "I'm sorry, I couldn't process that. Please try again.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Pulse error:', err);
      const errorMsg: Message = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: err?.message || "Something went wrong. Please try again in a moment.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Simple markdown renderer
  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      // Bold
      let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-secondary">$1</strong>');
      // Inline code
      processed = processed.replace(/`(.*?)`/g, '<code class="bg-slate-100 text-primary px-1 py-0.5 rounded text-xs">$1</code>');
      // Bullet points
      if (processed.startsWith('- ') || processed.startsWith('• ')) {
        return <div key={i} className="flex gap-2 mt-1"><span className="text-primary mt-0.5">•</span><span dangerouslySetInnerHTML={{ __html: processed.slice(2) }} /></div>;
      }
      // Numbered lists
      const numMatch = processed.match(/^(\d+)\.\s/);
      if (numMatch) {
        return <div key={i} className="flex gap-2 mt-1"><span className="text-primary font-semibold text-xs min-w-[16px]">{numMatch[1]}.</span><span dangerouslySetInnerHTML={{ __html: processed.slice(numMatch[0].length) }} /></div>;
      }
      // Empty line = paragraph break
      if (!processed.trim()) return <div key={i} className="h-2" />;
      return <p key={i} className="mt-1 first:mt-0" dangerouslySetInnerHTML={{ __html: processed }} />;
    });
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={handleOpen}
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-teal-600 text-white shadow-xl shadow-primary/30 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-primary/40 group ${pulseAnim ? 'animate-pulse' : ''}`}
        title="fynzo Intelligence — AI Financial Advisor"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        )}
        {!isOpen && isFree && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-amber-900" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
          </div>
        )}
      </button>

      {/* Paywall Modal */}
      {showPaywall && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowPaywall(false)}>
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-elevated animate-slideUp text-center" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-teal-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-secondary mb-2 font-display">fynzo Intelligence — Coming with Premium</h3>
            <p className="text-sm text-slate-500 mb-6">Get personalized AI-powered financial advice based on your real portfolio, expenses, and goals.</p>
            <div className="space-y-2 text-left mb-6">
              {['Analyzes your complete financial picture', 'Personalized investment advice', 'Debt payoff optimization', 'Goal tracking insights', 'Tax-aware recommendations'].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  {f}
                </div>
              ))}
            </div>
            <a href="/account" className="block w-full py-3 bg-gradient-to-r from-primary to-teal-600 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity text-center">
              Upgrade to Premium
            </a>
            <button onClick={() => setShowPaywall(false)} className="mt-3 text-xs text-slate-400 hover:text-slate-600 transition-colors">Maybe later</button>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {isOpen && isPremium && (
        <div className="fixed bottom-24 right-6 z-50 w-[400px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-slideUp">
          {/* Header */}
          <div className="bg-gradient-to-r from-secondary to-surface-700 px-5 py-4 flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold text-sm">fynzo Intelligence</h3>
              <p className="text-white/40 text-[10px]">AI Financial Advisor • Powered by Claude</p>
            </div>
            <div className="flex items-center gap-1">
              {contextLoaded && (
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Connected to your data" />
              )}
              <button onClick={() => { setMessages([]); setContextLoaded(false); loadContext(); }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors" title="New conversation">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
              </button>
              <button onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {!contextLoaded && (
              <div className="flex items-center gap-3 text-sm text-slate-400 py-8 justify-center">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Analyzing your financial data...
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${msg.role === 'user'
                  ? 'bg-primary text-white rounded-2xl rounded-br-md px-4 py-3'
                  : 'bg-slate-50 text-slate-700 rounded-2xl rounded-bl-md px-4 py-3 border border-slate-100'
                }`}>
                  <div className="text-[13px] leading-relaxed">
                    {renderContent(msg.content)}
                  </div>
                </div>
              </div>
            ))}

            {/* Suggested questions after welcome */}
            {messages.length === 1 && contextLoaded && (
              <div className="space-y-1.5 px-1">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button key={q} onClick={() => handleSend(q)}
                    className="w-full text-left px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 hover:border-primary/40 hover:bg-primary/5 transition-all">
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-50 rounded-2xl rounded-bl-md px-4 py-3 border border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-100 px-4 py-3 flex-shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your finances..."
                rows={1}
                className="flex-1 resize-none text-sm text-secondary placeholder-slate-400 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 focus:outline-none max-h-24"
                style={{ minHeight: '40px' }}
                disabled={loading || !contextLoaded}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading || !contextLoaded}
                className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${
                  input.trim() && !loading
                    ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
            <p className="text-[9px] text-slate-300 mt-1.5 text-center">fynzo Intelligence provides informational guidance, not financial advice.</p>
          </div>
        </div>
      )}
    </>
  );
}
