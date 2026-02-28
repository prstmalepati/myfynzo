import { useState, useRef } from 'react';
import { BROKERS, getBrokersForCountry, importFromCSV, BrokerConfig, BrokerID, ImportResult, ParsedInvestment } from '../services/brokerImportService';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void; // refresh investments list
}

type Step = 'broker' | 'upload' | 'preview' | 'done';

export default function BrokerImportModal({ open, onClose, onImported }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('broker');
  const [selectedBroker, setSelectedBroker] = useState<BrokerConfig | null>(null);
  const [userCountry, setUserCountry] = useState('DE');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  // Load user's country on mount
  useState(() => {
    if (user) {
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        if (snap.exists()) {
          const code = snap.data().countryCode || snap.data().country;
          if (code === 'Germany') setUserCountry('DE');
          else if (code === 'United States') setUserCountry('US');
          else if (code === 'Canada') setUserCountry('CA');
          else if (code === 'India') setUserCountry('IN');
          else if (code) setUserCountry(code);
        }
      });
    }
  });

  const availableBrokers = getBrokersForCountry(userCountry);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBroker) return;
    try {
      const result = await importFromCSV(file, selectedBroker.id);
      setImportResult(result);
      // Select all valid items by default
      setSelectedItems(new Set(result.investments.map((_, i) => i)));
      setStep('preview');
    } catch (err) {
      setImportResult({ success: false, investments: [], errors: ['Failed to parse file.'], warnings: [], broker: selectedBroker.name });
      setStep('preview');
    }
  };

  const handleImport = async () => {
    if (!user || !importResult) return;
    setImporting(true);
    let count = 0;
    try {
      const investmentsRef = collection(db, 'users', user.uid, 'investments');
      for (const idx of selectedItems) {
        const inv = importResult.investments[idx];
        if (!inv) continue;
        await addDoc(investmentsRef, {
          name: inv.name, type: inv.type, quantity: inv.quantity,
          purchasePrice: inv.purchasePrice, currentPrice: inv.currentPrice,
          purchaseDate: inv.purchaseDate, currency: inv.currency,
          ticker: inv.ticker || '', notes: inv.notes,
          source: `import:${selectedBroker?.id}`,
          updatedAt: new Date(),
        });
        count++;
      }
      setImportedCount(count);
      setStep('done');
      onImported();
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setImporting(false);
    }
  };

  const resetAndClose = () => {
    setStep('broker');
    setSelectedBroker(null);
    setImportResult(null);
    setSelectedItems(new Set());
    setImportedCount(0);
    onClose();
  };

  const toggleItem = (idx: number) => {
    const next = new Set(selectedItems);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setSelectedItems(next);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={resetAndClose}>
      <div className="bg-white rounded-2xl shadow-elevated w-full max-w-2xl max-h-[90vh] overflow-hidden animate-slideUp" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-secondary">
              {step === 'broker' && 'Import from Broker'}
              {step === 'upload' && `Import from ${selectedBroker?.name}`}
              {step === 'preview' && 'Review & Import'}
              {step === 'done' && 'Import Complete'}
            </h2>
            <p className="text-xs text-slate-500">
              {step === 'broker' && 'Select your broker or exchange to import positions.'}
              {step === 'upload' && 'Upload your CSV export file.'}
              {step === 'preview' && `${importResult?.investments.length || 0} positions found.`}
              {step === 'done' && `${importedCount} investments imported successfully.`}
            </p>
          </div>
          <button onClick={resetAndClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 130px)' }}>
          {/* ─── Step 1: Broker Selection ──────────────────── */}
          {step === 'broker' && (
            <div className="p-6">
              {/* Country filter */}
              <div className="flex flex-wrap gap-2 mb-5">
                {[
                  { code: 'DE', label: '🇩🇪 Germany' },
                  { code: 'US', label: '🇺🇸 United States' },
                  { code: 'CA', label: '🇨🇦 Canada' },
                  { code: 'IN', label: '🇮🇳 India' },
                  { code: 'GB', label: '🇬🇧 UK' },
                ].map(c => (
                  <button key={c.code} onClick={() => setUserCountry(c.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      userCountry === c.code ? 'bg-secondary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {availableBrokers.map(broker => (
                  <button key={broker.id}
                    onClick={() => { setSelectedBroker(broker); setStep('upload'); }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-primary/30 hover:bg-primary/[0.03] transition-all text-left group">
                    <div className={`w-8 h-8 ${broker.color} rounded-lg flex items-center justify-center text-white text-sm flex-shrink-0`}>
                      {broker.logo}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-secondary truncate">{broker.name}</div>
                      <div className="text-xs text-slate-400 capitalize">{broker.type === 'both' ? 'Stocks + Crypto' : broker.type}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* API import note */}
              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700">
                <strong>Direct API import</strong> (auto-sync via login) is planned for Q3 2026 via Open Banking (PSD2/Tink for EU, Plaid for US/CA). For now, CSV export from your broker works reliably.
              </div>
            </div>
          )}

          {/* ─── Step 2: Upload CSV ───────────────────────── */}
          {step === 'upload' && selectedBroker && (
            <div className="p-6">
              <button onClick={() => setStep('broker')} className="flex items-center gap-1 text-sm text-primary font-medium mb-5 hover:underline">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Back to broker selection
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className={`w-10 h-10 ${selectedBroker.color} rounded-xl flex items-center justify-center text-white text-lg`}>
                  {selectedBroker.logo}
                </div>
                <div>
                  <h3 className="font-bold text-secondary">{selectedBroker.name}</h3>
                  <p className="text-xs text-slate-500">CSV Import</p>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-100">
                <div className="text-xs font-semibold text-slate-700 mb-1.5">How to export from {selectedBroker.name}:</div>
                <p className="text-xs text-slate-600 leading-relaxed">{selectedBroker.csvInstructions}</p>
              </div>

              {/* Upload area */}
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-all"
              >
                <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <div className="text-sm font-semibold text-slate-600 mb-1">Click to upload CSV file</div>
                <div className="text-xs text-slate-400">or drag and drop — .csv, .tsv supported</div>
                <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="hidden" />
              </div>
            </div>
          )}

          {/* ─── Step 3: Preview & Confirm ────────────────── */}
          {step === 'preview' && importResult && (
            <div className="p-6">
              <button onClick={() => setStep('upload')} className="flex items-center gap-1 text-sm text-primary font-medium mb-4 hover:underline">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div className="bg-red-50 rounded-xl p-3 mb-4 border border-red-100">
                  <div className="text-xs font-semibold text-red-700 mb-1">Errors:</div>
                  {importResult.errors.slice(0, 5).map((e, i) => (
                    <div key={i} className="text-xs text-red-600">{e}</div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {importResult.warnings.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-3 mb-4 border border-amber-100">
                  <div className="text-xs font-semibold text-amber-700 mb-1">Warnings:</div>
                  {importResult.warnings.slice(0, 3).map((w, i) => (
                    <div key={i} className="text-xs text-amber-600">{w}</div>
                  ))}
                </div>
              )}

              {importResult.investments.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-3xl mb-2">😕</div>
                  <div className="text-sm font-semibold text-slate-600">No positions found</div>
                  <div className="text-xs text-slate-400 mt-1">Please check your CSV format or try a different broker.</div>
                </div>
              ) : (
                <>
                  {/* Select all */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-slate-500">{selectedItems.size} of {importResult.investments.length} selected</span>
                    <button onClick={() => {
                      if (selectedItems.size === importResult.investments.length) setSelectedItems(new Set());
                      else setSelectedItems(new Set(importResult.investments.map((_, i) => i)));
                    }} className="text-xs text-primary font-semibold hover:underline">
                      {selectedItems.size === importResult.investments.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {/* Investment list */}
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {importResult.investments.map((inv, i) => (
                      <label key={i} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                        selectedItems.has(i) ? 'bg-primary/[0.05] border border-primary/20' : 'border border-slate-100 hover:bg-slate-50'
                      }`}>
                        <input type="checkbox" checked={selectedItems.has(i)} onChange={() => toggleItem(i)}
                          className="w-4 h-4 text-primary rounded" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-secondary truncate">{inv.name}</div>
                          <div className="text-xs text-slate-400">
                            {inv.ticker && <span className="mr-2">{inv.ticker}</span>}
                            {inv.quantity} × {inv.currency} {inv.purchasePrice.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-secondary">
                            {inv.currency} {(inv.quantity * inv.purchasePrice).toFixed(0)}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Import button */}
                  <div className="mt-5 flex gap-3">
                    <button onClick={handleImport} disabled={selectedItems.size === 0 || importing}
                      className={`flex-1 py-3 rounded-xl font-semibold transition-all text-sm ${
                        selectedItems.size === 0 || importing
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20'
                      }`}>
                      {importing ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Importing...
                        </span>
                      ) : (
                        `Import ${selectedItems.size} Investment${selectedItems.size !== 1 ? 's' : ''}`
                      )}
                    </button>
                    <button onClick={resetAndClose} className="px-5 py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50">
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── Step 4: Done ─────────────────────────────── */}
          {step === 'done' && (
            <div className="p-6 text-center py-12">
              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-secondary mb-2">Import Successful</h3>
              <p className="text-sm text-slate-500 mb-6">{importedCount} investment{importedCount !== 1 ? 's' : ''} from {selectedBroker?.name} added to your portfolio.</p>
              <button onClick={resetAndClose}
                className="px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
