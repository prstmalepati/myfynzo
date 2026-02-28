// =============================================================
// components/PWAInstallPrompt.tsx
// B6 Enhancement: PWA install prompt + offline awareness
// =============================================================

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => setIsInstalled(true);
    window.addEventListener('appinstalled', installedHandler);

    const onlineHandler = () => setIsOnline(true);
    const offlineHandler = () => setIsOnline(false);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }, []);

  const triggerInstall = async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') { setIsInstalled(true); setInstallPrompt(null); }
    return result.outcome === 'accepted';
  };

  return { installPrompt, isInstalled, isOnline, isIOS, triggerInstall, canInstall: !!installPrompt };
}

export default function PWAInstallPrompt({ compact = false }: { compact?: boolean }) {
  const { canInstall, isInstalled, isIOS, triggerInstall } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) return null;
  if (!canInstall && !isIOS) return null;

  if (compact) {
    return (
      <button onClick={canInstall ? triggerInstall : undefined}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary/10 to-teal-50 rounded-xl border border-primary/20 hover:border-primary/40 transition-all text-left group">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-secondary">Install myFynzo</div>
          <div className="text-[10px] text-slate-400">
            {isIOS ? 'Tap Share → Add to Home Screen' : 'Quick access from your home screen'}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="bg-gradient-to-r from-primary/5 via-teal-50/80 to-primary/5 rounded-2xl border border-primary/15 p-5 relative overflow-hidden">
      <button onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/60 text-slate-300 hover:text-slate-500 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-secondary mb-1">Install myFynzo App</h3>
          <p className="text-xs text-slate-500 mb-3">
            {isIOS
              ? 'Add myFynzo to your home screen for quick access and a native app experience. Tap the Share button, then "Add to Home Screen".'
              : 'Get quick access from your home screen with offline support and a native app experience.'}
          </p>
          {canInstall && (
            <button onClick={triggerInstall}
              className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-all shadow-md shadow-primary/20">
              Install Now
            </button>
          )}
          {isIOS && (
            <div className="flex items-center gap-2 text-xs text-primary font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3V15" />
              </svg>
              Tap Share → Add to Home Screen
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {['Offline Access', 'Home Screen', 'Fast Launch', 'No App Store'].map(f => (
          <span key={f} className="px-2.5 py-1 bg-white/60 rounded-full text-[10px] font-medium text-slate-600 border border-slate-200/50">{f}</span>
        ))}
      </div>
    </div>
  );
}
