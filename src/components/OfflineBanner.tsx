import { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const on = () => { setOnline(true); setDismissed(false); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  if (online || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 dark:bg-amber-600 text-white text-center py-2.5 px-4 text-sm font-semibold shadow-lg flex items-center justify-center gap-3">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829" />
      </svg>
      <span>You're offline — some features may not work until you reconnect.</span>
      <button onClick={() => setDismissed(true)} className="ml-2 opacity-80 hover:opacity-100" aria-label="Dismiss">✕</button>
    </div>
  );
}
