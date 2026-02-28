import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useToast } from '../context/ToastContext';
import { usePartner } from '../context/PartnerContext';
import { useTier } from '../hooks/useTier';
import SidebarLayout from '../components/SidebarLayout';
import PartnerToggle from '../components/PartnerToggle';
import SmartDateInput from '../components/SmartDateInput';
import DividendTracker from '../components/DividendTracker';
import BenchmarkComparison from '../components/BenchmarkComparison';
import GeographyAllocation from '../components/GeographyAllocation';
import DownloadReportButton from '../components/DownloadReportButton';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, getDoc, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import BrokerImportModal from '../components/BrokerImportModal';
import { searchSymbols, fetchLivePrice, fetchPriceOnDate, fetchMultiplePrices, searchIndianMF, fetchIndianMFNav, fetchIndianMFNavOnDate, SymbolResult } from '../services/marketDataService';
import { usePageTitle } from '../hooks/usePageTitle';

interface Investment {
  id: string;
  name: string;
  symbol: string;
  type: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;
  currency: string;
  exchange: string;
  notes: string;
  dividendYield?: number;
  dividendPerShare?: number;
  dividendFrequency?: 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
  lastDividendDate?: string;
}

interface MIP {
  id: string;
  name: string;
  symbol?: string;
  category: string;
  monthlyAmount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  purchasePrice?: number;
  currentPrice?: number;
  notes: string;
  startDate?: string;
  entries?: MIPEntry[];
}

interface MIPEntry {
  id: string;
  date: string;
  amount: number;
  nav?: number;
  units?: number;
}

interface CashSaving {
  id: string;
  name: string;
  type: 'Bank Savings' | 'Cash' | 'Other';
  amount: number;
  notes: string;
}

interface PhysicalAsset {
  id: string;
  name: string;
  type: 'Real Estate' | 'Vehicle' | 'Land' | 'Jewelry' | 'Art' | 'Other';
  purchasePrice: number;
  currentValue: number;
  purchaseDate?: string;
  notes: string;
}

const MIP_CATEGORIES = [
  { id: 'ETF', label: 'ETF', icon: '📊' },
  { id: 'Mutual Fund', label: 'Mutual Fund', icon: '🏦' },
  { id: 'Stocks', label: 'Stocks', icon: '📈' },
  { id: 'Crypto', label: 'Crypto', icon: '₿' },
];

export default function Investments() {
  const { user } = useAuth();
  usePageTitle('Investment Hub');
  const { formatAmount, currency } = useCurrency();
  const { isFamily, activeProfile, profileLabel, isPartnerView, isReadOnly, partnerUid, loadPartnerDocs, getCollectionPath } = usePartner();
  const { isFree, limits } = useTier();
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);
  const [userCountry, setUserCountry] = useState('');
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'holdings' | 'mip' | 'cash' | 'assets'>('overview');
  const [allocationChart, setAllocationChart] = useState<'bar' | 'pie'>('bar');

  // Tier 2: Sort & Filter
  const [sortBy, setSortBy] = useState<'name' | 'value' | 'gain' | 'gainPct' | 'cagr' | 'date'>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterGain, setFilterGain] = useState<'all' | 'profit' | 'loss'>('all');
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [mips, setMips] = useState<MIP[]>([]);
  const [cashSavings, setCashSavings] = useState<CashSaving[]>([]);
  const [physicalAssets, setPhysicalAssets] = useState<PhysicalAsset[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showMipModal, setShowMipModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMipId, setEditingMipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteMipId, setDeleteMipId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  
  // Form
  const [assetName, setAssetName] = useState('');
  const [assetSymbol, setAssetSymbol] = useState('');
  const [assetType, setAssetType] = useState('Stocks');
  const [assetExchange, setAssetExchange] = useState('');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [dividendYield, setDividendYield] = useState('');
  const [dividendPerShare, setDividendPerShare] = useState('');
  const [dividendFrequency, setDividendFrequency] = useState<'monthly' | 'quarterly' | 'semi-annual' | 'annual'>('quarterly');
  const [lastDividendDate, setLastDividendDate] = useState('');

  // Symbol search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SymbolResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [fetchingHistorical, setFetchingHistorical] = useState(false);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const autoRefreshedRef = useRef(false);

  // Auto-refresh prices on load if stale (>6 hours since last update)
  useEffect(() => {
    if (!user || autoRefreshedRef.current || investments.length === 0) return;
    autoRefreshedRef.current = true;
    // Check if any investment has a recent lastPriceUpdate
    const now = Date.now();
    const sixHours = 6 * 60 * 60 * 1000;
    const needsRefresh = investments.some(inv => {
      if (!inv.symbol) return false;
      return true; // If we have symbols, always try to refresh on load
    });
    if (needsRefresh) {
      // Silent background refresh — don't show spinner
      const symbols = investments.filter(i => i.symbol).map(i => i.symbol);
      if (symbols.length > 0) {
        fetchMultiplePrices(symbols).then(async priceMap => {
          if (priceMap.size === 0) return;
          let anyUpdated = false;
          for (const inv of investments) {
            const sym = (inv.symbol || '').trim().toUpperCase();
            const live = priceMap.get(sym);
            if (live && live.price > 0 && Math.abs(live.price - inv.currentPrice) > 0.001) {
              await updateDoc(doc(db, 'users', user.uid, 'investments', inv.id), {
                currentPrice: live.price, lastPriceUpdate: new Date(),
              });
              anyUpdated = true;
            }
          }
          if (anyUpdated) {
            loadInvestments(); // Reload with fresh prices
            setLastPriceUpdate(new Date());
          }
        }).catch(() => {});
      }
    }
  }, [investments.length]);

  // Click outside to close dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced symbol search
  const handleSearchChange = useCallback((val: string) => {
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 1) { setSearchResults([]); setShowDropdown(false); return; }
    setShowDropdown(true);
    setSearching(true);
    debounceRef.current = window.setTimeout(async () => {
      const results = await searchSymbols(val);
      setSearchResults(results);
      setSearching(false);
    }, 350);
  }, []);

  // Map Twelve Data instrument types to our asset types
  const mapInstrumentType = (type: string): string => {
    const t = type.toLowerCase();
    if (t.includes('etf')) return 'ETFs';
    if (t.includes('stock') || t.includes('common') || t.includes('equity')) return 'Stocks';
    if (t.includes('crypto') || t.includes('digital')) return 'Cryptocurrency';
    if (t.includes('bond') || t.includes('fixed')) return 'Bonds';
    if (t.includes('fund') || t.includes('mutual')) return 'Mutual Funds';
    if (t.includes('commodity') || t.includes('gold') || t.includes('silver')) return 'Commodities';
    if (t.includes('reit') || t.includes('real estate')) return 'Real Estate';
    return 'Stocks';
  };

  // Select a symbol from search results
  const handleSelectSymbol = async (result: SymbolResult) => {
    setAssetName(result.instrument_name);
    setAssetSymbol(result.symbol);
    setAssetType(mapInstrumentType(result.type));
    setAssetExchange(result.exchange);
    setSearchQuery(result.symbol + ' — ' + result.instrument_name);
    setShowDropdown(false);
    setSearchResults([]);

    // Auto-fetch current price and purchase date price in parallel
    setFetchingPrice(true);
    setFetchingHistorical(!!purchaseDate);
    
    const promises: Promise<void>[] = [];

    // Current price
    promises.push(
      (async () => {
        try {
          const price = await fetchLivePrice(result.symbol, false, result.exchange, result.instrument_name);
          if (price) {
            setCurrentPrice(String(price.price.toFixed(2)));
            // For MFs, also set name from API if available
            if (price.name && price.name !== result.symbol) {
              setAssetName(price.name);
              setSearchQuery(result.symbol + ' — ' + price.name);
            }
          }
        } catch {} finally { setFetchingPrice(false); }
      })()
    );

    // Purchase date price
    if (purchaseDate) {
      promises.push(
        (async () => {
          try {
            const histPrice = await fetchPriceOnDate(result.symbol, purchaseDate, result.exchange);
            if (histPrice) setPurchasePrice(String(histPrice.toFixed(2)));
          } catch {} finally { setFetchingHistorical(false); }
        })()
      );
    }

    await Promise.all(promises);
  };

  // Re-fetch purchase price when purchase date changes (if symbol is set)
  const handleDateChange = async (date: string) => {
    setPurchaseDate(date);
    if (assetSymbol && date) {
      setFetchingHistorical(true);
      try {
        const histPrice = await fetchPriceOnDate(assetSymbol, date);
        if (histPrice) setPurchasePrice(String(histPrice.toFixed(2)));
      } catch {} finally { setFetchingHistorical(false); }
    }
  };

  // Refresh all investment prices
  const handleRefreshPrices = async () => {
    if (!user || refreshingPrices) return;
    setRefreshingPrices(true);
    try {
      let updated = 0;
      for (const inv of investments) {
        const sym = inv.symbol || '';
        if (!sym) continue;
        const price = await fetchLivePrice(sym, true); // force bypass cache
        if (price && price.price > 0) {
          await updateDoc(doc(db, 'users', user.uid, 'investments', inv.id), {
            currentPrice: price.price, updatedAt: new Date(),
          });
          updated++;
        }
        // Rate limit: 250ms between calls
        await new Promise(r => setTimeout(r, 250));
      }
      if (updated > 0) { await loadInvestments(); setLastPriceUpdate(new Date()); showToast('success', `Updated ${updated} of ${investments.length} prices`); }
      else { showToast('error', 'Could not fetch prices. Check browser console for details.'); }
    } catch (err) { console.error('Error refreshing prices:', err); showToast('error', 'Refresh failed — check console'); }
    finally { setRefreshingPrices(false); }
  };

  useEffect(() => { if (user) { loadInvestments(); loadMips(); loadCashSavings(); loadAssets(); checkProfileComplete(); } }, [user, activeProfile]);

  // Check if profile is complete (DoB + nationality required)
  const checkProfileComplete = async () => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        const hasDoB = !!data.dateOfBirth;
        const hasNationality = !!data.nationality;
        if (!hasDoB || !hasNationality) {
          setShowProfilePrompt(true);
        }
        if (data.country) setUserCountry(data.country);
      }
    } catch {}
  };

  // Click outside to close MIP search dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mipSearchRef.current && !mipSearchRef.current.contains(e.target as Node)) setMipShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadInvestments = async () => {
    if (!user) return;
    try {
      const sortFn = (a: any, b: any) => (b.purchaseDate || '1970-01-01').localeCompare(a.purchaseDate || '1970-01-01');
      if (activeProfile === 'household') {
        const [selfSnap, partnerDocs] = await Promise.all([
          getDocs(collection(db, 'users', user.uid, 'investments')),
          loadPartnerDocs('investments'),
        ]);
        setInvestments([
          ...selfSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          ...partnerDocs,
        ].sort(sortFn) as Investment[]);
      } else if (isPartnerView && partnerUid) {
        const snap = await getDocs(collection(db, 'users', partnerUid, 'investments'));
        setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(sortFn) as Investment[]);
      } else {
        const snap = await getDocs(collection(db, 'users', user.uid, 'investments'));
        setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(sortFn) as Investment[]);
      }
    } catch (err) {
      console.error('Error loading investments:', err);
    } finally {
      setPageLoading(false);
    }
  };

  // MIP state
  const [mipName, setMipName] = useState('');
  const [mipSymbol, setMipSymbol] = useState('');
  const [mipExchange, setMipExchange] = useState('');
  const [mipCategory, setMipCategory] = useState('ETF');
  const [mipAmount, setMipAmount] = useState('');
  const [mipFrequency, setMipFrequency] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [mipStartDate, setMipStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [mipPurchasePrice, setMipPurchasePrice] = useState('');
  const [mipCurrentPrice, setMipCurrentPrice] = useState('');
  const [mipNotes, setMipNotes] = useState('');
  const [mipSearchMode, setMipSearchMode] = useState(true);
  const [mipSearchQuery, setMipSearchQuery] = useState('');
  const [mipSearchResults, setMipSearchResults] = useState<SymbolResult[]>([]);
  const [mipSearching, setMipSearching] = useState(false);
  const [mipShowDropdown, setMipShowDropdown] = useState(false);
  const [mipFetchingPrice, setMipFetchingPrice] = useState(false);
  const mipSearchRef = useRef<HTMLDivElement>(null);
  const mipDebounceRef = useRef<number | null>(null);

  // Physical Assets state
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [assetEditId, setAssetEditId] = useState<string | null>(null);
  const [paName, setPaName] = useState('');
  const [paType, setPaType] = useState<PhysicalAsset['type']>('Real Estate');
  const [paPurchasePrice, setPaPurchasePrice] = useState('');
  const [paCurrentValue, setPaCurrentValue] = useState('');
  const [paPurchaseDate, setPaPurchaseDate] = useState('');
  const [paNotes, setPaNotes] = useState('');
  const resetAssetForm = () => { setPaName(''); setPaType('Real Estate'); setPaPurchasePrice(''); setPaCurrentValue(''); setPaPurchaseDate(''); setPaNotes(''); setAssetEditId(null); };

  const loadMips = async () => {
    if (!user) return;
    try {
      const loadMipsFromUid = async (uid: string, isPartnerData = false) => {
        const snap = await getDocs(collection(db, 'users', uid, 'monthlyInvestments'));
        const mipData: MIP[] = [];
        for (const d of snap.docs) {
          const mip = { id: isPartnerData ? `p_${d.id}` : d.id, ...d.data(), _isPartner: isPartnerData } as MIP;
          try {
            const entrySnap = await getDocs(collection(db, 'users', uid, 'monthlyInvestments', d.id, 'entries'));
            mip.entries = entrySnap.docs.map(e => ({ id: e.id, ...e.data() })) as MIPEntry[];
            mip.entries.sort((a, b) => b.date.localeCompare(a.date));
          } catch { mip.entries = []; }
          mipData.push(mip);
        }
        return mipData;
      };

      if (activeProfile === 'household' && partnerUid) {
        const [selfMips, partnerMips] = await Promise.all([
          loadMipsFromUid(user.uid),
          loadMipsFromUid(partnerUid, true),
        ]);
        setMips([...selfMips, ...partnerMips]);
      } else if (isPartnerView && partnerUid) {
        setMips(await loadMipsFromUid(partnerUid, true));
      } else {
        setMips(await loadMipsFromUid(user.uid));
      }
    } catch (err) { console.error('Error loading MIPs:', err); }
  };

  // Cash & Savings
  const loadCashSavings = async () => {
    if (!user) return;
    try {
      if (activeProfile === 'household') {
        const [s1, partnerDocs] = await Promise.all([getDocs(collection(db, 'users', user.uid, 'cashSavings')), loadPartnerDocs('cashSavings')]);
        setCashSavings([...s1.docs.map(d => ({ id: d.id, ...d.data() })), ...partnerDocs] as CashSaving[]);
      } else if (isPartnerView && partnerUid) {
        const snap = await getDocs(collection(db, 'users', partnerUid, 'cashSavings'));
        setCashSavings(snap.docs.map(d => ({ id: d.id, ...d.data() })) as CashSaving[]);
      } else {
        const snap = await getDocs(collection(db, 'users', user.uid, 'cashSavings'));
        setCashSavings(snap.docs.map(d => ({ id: d.id, ...d.data() })) as CashSaving[]);
      }
    } catch (err) { console.error('Error loading cash:', err); }
  };

  const totalCashSavings = cashSavings.reduce((s, c) => s + c.amount, 0);

  // Physical Assets
  const loadAssets = async () => {
    if (!user) return;
    try {
      if (activeProfile === 'household') {
        const [s1, partnerDocs] = await Promise.all([getDocs(collection(db, 'users', user.uid, 'physicalAssets')), loadPartnerDocs('physicalAssets')]);
        setPhysicalAssets([...s1.docs.map(d => ({ id: d.id, ...d.data() })), ...partnerDocs] as PhysicalAsset[]);
      } else if (isPartnerView && partnerUid) {
        const snap = await getDocs(collection(db, 'users', partnerUid, 'physicalAssets'));
        setPhysicalAssets(snap.docs.map(d => ({ id: d.id, ...d.data() })) as PhysicalAsset[]);
      } else {
        const snap = await getDocs(collection(db, 'users', user.uid, 'physicalAssets'));
        setPhysicalAssets(snap.docs.map(d => ({ id: d.id, ...d.data() })) as PhysicalAsset[]);
      }
    } catch (err) { console.error('Error loading assets:', err); }
  };

  const totalAssetValue = physicalAssets.reduce((s, a) => s + (a.currentValue || 0), 0);
  const totalAssetCost = physicalAssets.reduce((s, a) => s + (a.purchasePrice || 0), 0);

  const handleSaveAsset = async () => {
    if (!user || !paName.trim() || !paCurrentValue) return;
    setLoading(true);
    try {
      const data = { name: paName.trim(), type: paType, purchasePrice: Number(paPurchasePrice) || 0, currentValue: Number(paCurrentValue), purchaseDate: paPurchaseDate, notes: paNotes.trim(), updatedAt: new Date() };
      if (assetEditId) {
        await updateDoc(doc(db, 'users', user.uid, 'physicalAssets', assetEditId), data);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'physicalAssets'), { ...data, createdAt: new Date() });
      }
      resetAssetForm(); setShowAssetModal(false); await loadAssets();
    } catch (err) { console.error('Error saving asset:', err); }
    finally { setLoading(false); }
  };

  const ASSET_TYPES: { id: PhysicalAsset['type']; label: string; icon: string }[] = [
    { id: 'Real Estate', label: 'House/Flat', icon: '🏠' },
    { id: 'Vehicle', label: 'Vehicle', icon: '🚗' },
    { id: 'Land', label: 'Land', icon: '🏞️' },
    { id: 'Jewelry', label: 'Jewelry', icon: '💎' },
    { id: 'Art', label: 'Art', icon: '🎨' },
    { id: 'Other', label: 'Other', icon: '📦' },
  ];

  // MIP search handler
  const handleMipSearch = useCallback((val: string) => {
    setMipSearchQuery(val);
    if (mipDebounceRef.current) clearTimeout(mipDebounceRef.current);
    if (val.trim().length < 1) { setMipSearchResults([]); setMipShowDropdown(false); return; }
    setMipShowDropdown(true);
    setMipSearching(true);
    mipDebounceRef.current = window.setTimeout(async () => {
      const results = await searchSymbols(val);
      setMipSearchResults(results);
      setMipSearching(false);
    }, 350);
  }, []);

  const handleMipSelectSymbol = async (result: SymbolResult) => {
    setMipName(result.instrument_name);
    setMipSymbol(result.symbol);
    setMipExchange(result.exchange || '');
    setMipSearchQuery(result.symbol + ' — ' + result.instrument_name);
    setMipShowDropdown(false);
    setMipSearchResults([]);
    setMipFetchingPrice(true);
    try {
      // Fetch current price and purchase price in parallel, passing exchange for non-US
      const [livePrice, histPrice] = await Promise.all([
        fetchLivePrice(result.symbol, false, result.exchange, result.instrument_name),
        mipStartDate ? fetchPriceOnDate(result.symbol, mipStartDate, result.exchange) : Promise.resolve(null),
      ]);
      if (livePrice) {
        setMipCurrentPrice(String(livePrice.price.toFixed(2)));
        if (livePrice.name && livePrice.name !== result.symbol) setMipName(livePrice.name);
      }
      if (histPrice) {
        setMipPurchasePrice(String(histPrice.toFixed(2)));
      }
    } catch {} finally { setMipFetchingPrice(false); }
  };

  const resetMipForm = () => {
    setMipName(''); setMipSymbol(''); setMipExchange(''); setMipCategory('ETF'); setMipAmount(''); setMipFrequency('monthly'); setMipStartDate(new Date().toISOString().split('T')[0]); setMipPurchasePrice(''); setMipCurrentPrice(''); setMipNotes(''); setEditingMipId(null); setMipSearchQuery(''); setMipSearchMode(true);
  };

  const openMipEdit = (mip: MIP) => {
    setMipName(mip.name); setMipSymbol(mip.symbol || ''); setMipExchange((mip as any).exchange || ''); setMipCategory(mip.category); setMipAmount(String(mip.monthlyAmount));
    setMipFrequency(mip.frequency || 'monthly');
    setMipStartDate(mip.startDate || new Date().toISOString().split('T')[0]);
    setMipPurchasePrice(mip.purchasePrice ? String(mip.purchasePrice) : '');
    setMipCurrentPrice(mip.currentPrice ? String(mip.currentPrice) : '');
    setMipNotes(mip.notes || ''); setEditingMipId(mip.id); setShowMipModal(true);
    setMipSearchQuery(mip.symbol ? `${mip.symbol} — ${mip.name}` : '');
    setMipSearchMode(!!mip.symbol);
  };

  const handleSaveMip = async () => {
    if (!user || !mipName.trim() || !mipAmount) return;
    // Free tier recurring limit
    const maxRecurring = limits.maxRecurring || 999;
    if (!editingMipId && isFree && mips.length >= maxRecurring) {
      showToast(`Free plan allows up to ${maxRecurring} recurring investments. Upgrade to Premium for unlimited.`, 'error');
      return;
    }
    setLoading(true);
    try {
      const data = { name: mipName.trim(), symbol: mipSymbol || null, exchange: mipExchange || null, category: mipCategory, monthlyAmount: Number(mipAmount), frequency: mipFrequency, startDate: mipStartDate, purchasePrice: Number(mipPurchasePrice) || null, currentPrice: Number(mipCurrentPrice) || null, notes: mipNotes.trim(), updatedAt: new Date() };
      if (editingMipId) {
        await updateDoc(doc(db, 'users', user.uid, 'monthlyInvestments', editingMipId), data);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'monthlyInvestments'), { ...data, createdAt: new Date() });
      }
      resetMipForm(); setShowMipModal(false); await loadMips();
    } catch (err) { console.error('Error saving MIP:', err); }
    finally { setLoading(false); }
  };

  const handleDeleteMip = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'monthlyInvestments', id));
      setDeleteMipId(null); await loadMips();
    } catch (err) { console.error('Error deleting MIP:', err); }
  };

  const totalMipMonthly = mips.reduce((s, m) => {
    const freq = m.frequency || 'monthly';
    return s + (freq === 'monthly' ? m.monthlyAmount : freq === 'quarterly' ? m.monthlyAmount / 3 : m.monthlyAmount / 12);
  }, 0);
  const totalMipAnnual = mips.reduce((s, m) => {
    const freq = m.frequency || 'monthly';
    return s + (freq === 'monthly' ? m.monthlyAmount * 12 : freq === 'quarterly' ? m.monthlyAmount * 4 : m.monthlyAmount);
  }, 0);

  // Helper: compute auto-generated entries for a MIP based on startDate and frequency
  const getMipGeneratedEntries = (mip: MIP) => {
    const entries: { date: string; amount: number }[] = [];
    if (!mip.startDate) return entries;
    const start = new Date(mip.startDate + 'T00:00:00');
    const today = new Date();
    const current = new Date(start);
    const freq = mip.frequency || 'monthly';
    const step = freq === 'monthly' ? 1 : freq === 'quarterly' ? 3 : 12;
    while (current <= today) {
      entries.push({ date: current.toISOString().split('T')[0], amount: mip.monthlyAmount });
      current.setMonth(current.getMonth() + step);
    }
    return entries;
  };

  // Total invested across all plans (from generated entries)
  const totalMipInvested = mips.reduce((s, m) => {
    return s + getMipGeneratedEntries(m).reduce((es, e) => es + e.amount, 0);
  }, 0);

  // Cash & Savings state
  const [cashName, setCashName] = useState('');
  const [cashType, setCashType] = useState<'Bank Savings' | 'Cash' | 'Other'>('Bank Savings');
  const [cashAmount, setCashAmount] = useState('');
  const [cashNotes, setCashNotes] = useState('');
  const [cashEditId, setCashEditId] = useState<string | null>(null);

  const resetCashForm = () => { setCashName(''); setCashType('Bank Savings'); setCashAmount(''); setCashNotes(''); setCashEditId(null); };

  const handleSaveCash = async () => {
    if (!user || !cashName.trim() || !cashAmount) return;
    try {
      const data = { name: cashName.trim(), type: cashType, amount: Number(cashAmount), notes: cashNotes.trim(), updatedAt: new Date() };
      if (cashEditId) {
        await updateDoc(doc(db, 'users', user.uid, 'cashSavings', cashEditId), data);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'cashSavings'), { ...data, createdAt: new Date() });
      }
      resetCashForm(); setShowCashModal(false); await loadCashSavings();
    } catch (err) { console.error('Error saving cash:', err); }
  };

  const resetForm = () => {
    setAssetName(''); setAssetSymbol(''); setAssetType('Stocks'); setAssetExchange('');
    setQuantity(''); setPurchasePrice(''); setCurrentPrice(''); setNotes('');
    setDividendYield(''); setDividendPerShare(''); setDividendFrequency('quarterly'); setLastDividendDate('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setSearchQuery(''); setSearchResults([]); setShowDropdown(false);
    setEditingId(null);
  };

  const openEdit = (inv: Investment) => {
    setAssetName(inv.name); setAssetSymbol(inv.symbol || ''); setAssetType(inv.type);
    setAssetExchange(inv.exchange || '');
    setQuantity(String(inv.quantity)); setPurchasePrice(String(inv.purchasePrice));
    setCurrentPrice(String(inv.currentPrice)); setPurchaseDate(inv.purchaseDate);
    setNotes(inv.notes || '');
    setDividendYield(inv.dividendYield ? String(inv.dividendYield) : '');
    setDividendPerShare(inv.dividendPerShare ? String(inv.dividendPerShare) : '');
    setDividendFrequency(inv.dividendFrequency || 'quarterly');
    setLastDividendDate(inv.lastDividendDate || '');
    setSearchQuery(inv.symbol ? `${inv.symbol} — ${inv.name}` : inv.name);
    setEditingId(inv.id); setShowModal(true);
  };

  const handleSave = async () => {
    if (!user || !assetName.trim() || !quantity || !purchasePrice) return;

    // Profile completion check — block adding if profile incomplete
    if (showProfilePrompt) {
      return; // Profile prompt is already visible
    }

    // Free tier limit check — only on new additions (not edits)
    if (!editingId && isFree && investments.length >= limits.maxAssets) {
      showToast(`Free plan allows up to ${limits.maxAssets} holdings. Upgrade to Premium for unlimited.`, 'error');
      return;
    }

    setLoading(true);
    try {
      const data = {
        name: assetName.trim(), symbol: assetSymbol.trim().toUpperCase(), type: assetType,
        exchange: assetExchange, quantity: Number(quantity),
        purchasePrice: Number(purchasePrice),
        currentPrice: currentPrice && Number(currentPrice) > 0 ? Number(currentPrice) : Number(purchasePrice),
        purchaseDate, currency, notes: notes.trim(),
        dividendYield: dividendYield ? Number(dividendYield) : null,
        dividendPerShare: dividendPerShare ? Number(dividendPerShare) : null,
        dividendFrequency: dividendYield || dividendPerShare ? dividendFrequency : null,
        lastDividendDate: lastDividendDate || null,
        updatedAt: new Date()
      };
      if (editingId) {
        await updateDoc(doc(db, 'users', user.uid, 'investments', editingId), data);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'investments'), { ...data, createdAt: new Date() });
      }
      resetForm(); setShowModal(false); await loadInvestments();
    } catch (err) {
      console.error('Error saving:', err);
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'investments', id));
      setDeleteConfirmId(null); await loadInvestments();
    } catch (err) { console.error('Error deleting:', err); }
  };

  const calcValue = (inv: Investment) => inv.quantity * inv.currentPrice;
  const calcGain = (inv: Investment) => calcValue(inv) - (inv.quantity * inv.purchasePrice);
  const calcGainPct = (inv: Investment) => {
    const cost = inv.quantity * inv.purchasePrice;
    return cost > 0 ? (calcGain(inv) / cost) * 100 : 0;
  };

  // XIRR: annualized return using Newton-Raphson method
  const calcXIRR = (inv: Investment): number | null => {
    if (!inv.purchaseDate || !inv.purchasePrice || !inv.currentPrice) return null;
    const cost = inv.quantity * inv.purchasePrice;
    if (cost <= 0) return null;
    const value = calcValue(inv);
    const purchaseDate = new Date(inv.purchaseDate + 'T00:00:00');
    const today = new Date();
    const years = (today.getTime() - purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (years < 0.01) return null; // less than ~4 days
    // CAGR formula (good enough for single cash flow):
    const ratio = value / cost;
    if (ratio <= 0) return null;
    return (Math.pow(ratio, 1 / years) - 1) * 100;
    if (ratio <= 0) return null;
    return (Math.pow(ratio, 1 / years) - 1) * 100;
  };

  const totalValue = investments.reduce((s, i) => s + calcValue(i), 0);
  const totalCost = investments.reduce((s, i) => s + i.quantity * i.purchasePrice, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  // Tier 2: Sorted & Filtered holdings
  const sortedFilteredInvestments = useMemo(() => {
    let list = [...investments];
    // Filter by type
    if (filterType !== 'all') list = list.filter(inv => inv.type === filterType);
    // Filter by gain/loss
    if (filterGain === 'profit') list = list.filter(inv => calcGain(inv) >= 0);
    if (filterGain === 'loss') list = list.filter(inv => calcGain(inv) < 0);
    // Sort
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortBy) {
        case 'name': return dir * a.name.localeCompare(b.name);
        case 'value': return dir * (calcValue(a) - calcValue(b));
        case 'gain': return dir * (calcGain(a) - calcGain(b));
        case 'gainPct': return dir * (calcGainPct(a) - calcGainPct(b));
        case 'cagr': return dir * ((calcXIRR(a) || 0) - (calcXIRR(b) || 0));
        case 'date': return dir * ((a.purchaseDate || '').localeCompare(b.purchaseDate || ''));
        default: return 0;
      }
    });
    return list;
  }, [investments, filterType, filterGain, sortBy, sortDir]);

  const investmentTypes = useMemo(() => {
    const types = new Set(investments.map(i => i.type));
    return Array.from(types).sort();
  }, [investments]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const assetTypes = ['Stocks', 'ETFs', 'Cryptocurrency', 'Bonds', 'Gold', 'Silver', 'Real Estate', 'Commodities', 'Mutual Funds', 'Other'];

  return (
    <SidebarLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fadeIn">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-secondary font-display">Investment Hub</h1>
            <p className="text-sm text-slate-500 mt-1">{isPartnerView ? `${profileLabel}'s` : 'Your'} portfolio & monthly investment plans</p>
          </div>
          <div className="flex gap-2">
            {activeTab === 'holdings' && (
              <>
                <button onClick={handleRefreshPrices} disabled={refreshingPrices || investments.length === 0}
                  className={`px-4 py-2.5 border rounded-xl font-semibold hover:bg-slate-50 transition-all flex items-center gap-2 text-sm ${
                    refreshingPrices ? 'border-primary/30 text-primary bg-primary/5' : 'border-slate-200 text-slate-700'
                  }`}>
                  <svg className={`w-4 h-4 ${refreshingPrices ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  {refreshingPrices ? 'Updating...' : 'Refresh'}
                </button>
                <button onClick={() => setShowImport(true)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Import
                </button>
                <button onClick={() => { resetForm(); setShowModal(true); }}
                  className="px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Add Investment
                </button>
              </>
            )}
            {activeTab === 'mip' && (
              <>
                <button onClick={loadMips} disabled={mips.length === 0}
                  className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
                  Refresh
                </button>
                <button onClick={() => setShowImport(true)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                  Import
                </button>
                <button onClick={() => { resetMipForm(); setShowMipModal(true); }}
                  className="px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Add Plan
                </button>
              </>
            )}
            {activeTab === 'cash' && (
              <button onClick={() => { resetCashForm(); setShowCashModal(true); }}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add Account
              </button>
            )}
            {activeTab === 'assets' && (
              <button onClick={() => { resetAssetForm(); setShowAssetModal(true); }}
                className="px-5 py-2.5 bg-amber-600 text-white rounded-xl font-semibold text-sm hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add Asset
              </button>
            )}
          </div>
        </div>

        {/* Partner Toggle — Family Premium only */}
        <PartnerToggle context="Manage investments per person" showHousehold />

        {/* Tab Switcher */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-fit overflow-x-auto">
          <button onClick={() => setActiveTab('overview')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-white text-secondary shadow-sm' : 'text-slate-500 hover:text-secondary'}`}>
            Portfolio Summary
          </button>
          <button onClick={() => setActiveTab('holdings')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'holdings' ? 'bg-white text-secondary shadow-sm' : 'text-slate-500 hover:text-secondary'}`}>
            Holdings
            {investments.length > 0 && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{investments.length}{isFree ? `/${limits.maxAssets}` : ''}</span>}
          </button>
          <button onClick={() => setActiveTab('mip')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'mip' ? 'bg-white text-secondary shadow-sm' : 'text-slate-500 hover:text-secondary'}`}>
            Recurring Investments
            {mips.length > 0 && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{mips.length}{isFree ? `/${limits.maxRecurring || 2}` : ''}</span>}
          </button>
          <button onClick={() => isFree ? null : setActiveTab('cash')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'cash' ? 'bg-white text-secondary shadow-sm' : isFree ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-secondary'}`}>
            Cash & Savings
            {isFree ? <span className="ml-1.5 text-[9px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-md">PRO</span>
              : cashSavings.length > 0 && <span className="ml-1.5 text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full">{cashSavings.length}</span>}
          </button>
          <button onClick={() => isFree ? null : setActiveTab('assets')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'assets' ? 'bg-white text-secondary shadow-sm' : isFree ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-secondary'}`}>
            Assets
            {isFree ? <span className="ml-1.5 text-[9px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-md">PRO</span>
              : physicalAssets.length > 0 && <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">{physicalAssets.length}</span>}
          </button>
        </div>

        {/* Profile completion prompt */}
        {showProfilePrompt && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800 mb-1">Complete your profile first</p>
                <p className="text-xs text-amber-700 mb-3">Please set up your profile (date of birth, nationality) in Settings before exploring your wealth dashboard. This helps us personalize tax calculations and projections for you.</p>
                <div className="flex gap-2">
                  <a href="/account" className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all">Go to Settings</a>
                  <button onClick={() => setShowProfilePrompt(false)} className="px-4 py-2 text-slate-500 text-xs font-semibold rounded-lg hover:bg-slate-100">Later</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Portfolio Summary Tab ───────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* Key Metrics */}
            {(() => {
              // Recurring investments estimated current value
              const mipValuation = mips.reduce((acc, mip) => {
                const invested = getMipGeneratedEntries(mip).reduce((s, e) => s + e.amount, 0);
                if (invested <= 0) return acc;
                if (mip.currentPrice && mip.purchasePrice && mip.purchasePrice > 0) {
                  const growth = mip.currentPrice / mip.purchasePrice;
                  return { cost: acc.cost + invested, value: acc.value + invested * growth };
                }
                return { cost: acc.cost + invested, value: acc.value + invested };
              }, { cost: 0, value: 0 });
              const mipGain = mipValuation.value - mipValuation.cost;
              const mipGainPct = mipValuation.cost > 0 ? (mipGain / mipValuation.cost) * 100 : 0;
              const grandTotal = totalValue + mipValuation.value + totalCashSavings + totalAssetValue;
              return (
                <>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
              <div className="rounded-2xl p-5 bg-gradient-to-br from-secondary to-surface-700 text-white shadow-elevated">
                <div className="text-xs text-white/50 mb-1">Net Worth</div>
                <div className="text-2xl font-bold tracking-tight">{formatAmount(grandTotal)}</div>
                <div className="text-xs text-white/40 mt-1">{investments.length + mips.length} investments · {physicalAssets.length} assets</div>
                {/* Portfolio XIRR */}
                {(() => {
                  const invWithDates = investments.filter(i => i.purchaseDate && i.purchasePrice && i.currentPrice);
                  if (invWithDates.length === 0) return null;
                  const portfolioCost = invWithDates.reduce((s, i) => s + i.quantity * i.purchasePrice, 0);
                  const portfolioValue = invWithDates.reduce((s, i) => s + i.quantity * i.currentPrice, 0);
                  // Weighted average holding period
                  const now = Date.now();
                  let weightedYears = 0;
                  invWithDates.forEach(i => {
                    const yrs = (now - new Date(i.purchaseDate + 'T00:00:00').getTime()) / (365.25 * 24 * 60 * 60 * 1000);
                    const weight = (i.quantity * i.purchasePrice) / portfolioCost;
                    weightedYears += yrs * weight;
                  });
                  if (weightedYears < 0.01 || portfolioCost <= 0) return null;
                  const cagr = (Math.pow(portfolioValue / portfolioCost, 1 / weightedYears) - 1) * 100;
                  if (!isFinite(cagr)) return null;
                  return (
                    <div className={`text-[10px] mt-1.5 font-semibold ${cagr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {cagr >= 0 ? '↑' : '↓'} {Math.abs(cagr).toFixed(1)}% annualized return
                    </div>
                  );
                })()}
              </div>
              <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card">
                <div className="text-xs text-slate-500 mb-1">Direct Investments</div>
                <div className="text-lg font-bold text-secondary">{formatAmount(totalValue)}</div>
                <div className={`text-[10px] mt-1 font-semibold ${totalGain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {totalGain >= 0 ? '+' : ''}{formatAmount(totalGain)} ({totalGainPct >= 0 ? '+' : ''}{totalGainPct.toFixed(1)}%)
                </div>
              </div>
              <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card">
                <div className="text-xs text-slate-500 mb-1">Recurring Investments</div>
                <div className="text-lg font-bold text-secondary">{formatAmount(mipValuation.value)}</div>
                <div className={`text-[10px] mt-1 font-semibold ${mipGain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {mipGain >= 0 ? '+' : ''}{formatAmount(mipGain)} ({mipGainPct >= 0 ? '+' : ''}{mipGainPct.toFixed(1)}%)
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Invested: {formatAmount(mipValuation.cost)}</div>
              </div>
              <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card">
                <div className="text-xs text-slate-500 mb-1">Assets</div>
                <div className="text-lg font-bold text-secondary">{formatAmount(totalAssetValue)}</div>
                {totalAssetCost > 0 && (
                  <div className={`text-[10px] mt-1 font-semibold ${totalAssetValue - totalAssetCost >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {totalAssetValue - totalAssetCost >= 0 ? '+' : ''}{formatAmount(totalAssetValue - totalAssetCost)}
                  </div>
                )}
              </div>
              <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card">
                <div className="text-xs text-slate-500 mb-1">Cash & Savings</div>
                <div className="text-lg font-bold text-secondary">{formatAmount(totalCashSavings)}</div>
                <div className="text-xs text-slate-400 mt-1">{cashSavings.length} accounts</div>
              </div>
            </div>

            {/* Last price update indicator */}
            {lastPriceUpdate && (
              <div className="flex items-center gap-2 mb-4 text-[10px] text-slate-400">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Prices updated {lastPriceUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}

            {/* Allocation Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Asset Type Allocation */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-secondary">Asset Allocation</h3>
                  <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
                    <button onClick={() => setAllocationChart('bar')}
                      className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${allocationChart === 'bar' ? 'bg-white text-secondary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                      Bar
                    </button>
                    <button onClick={() => setAllocationChart('pie')}
                      className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${allocationChart === 'pie' ? 'bg-white text-secondary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                      Pie
                    </button>
                  </div>
                </div>
                {(() => {
                  const allocationMap: Record<string, number> = {};
                  investments.forEach(inv => {
                    const t = inv.type || 'Other';
                    allocationMap[t] = (allocationMap[t] || 0) + calcValue(inv);
                  });
                  mips.forEach(mip => {
                    const invested = getMipGeneratedEntries(mip).reduce((s, e) => s + e.amount, 0);
                    if (invested > 0) {
                      const val = mip.currentPrice && mip.purchasePrice && mip.purchasePrice > 0 ? invested * (mip.currentPrice / mip.purchasePrice) : invested;
                      const cat = `Recurring: ${mip.category}`;
                      allocationMap[cat] = (allocationMap[cat] || 0) + val;
                    }
                  });
                  if (totalCashSavings > 0) allocationMap['Cash & Savings'] = totalCashSavings;
                  physicalAssets.forEach(a => {
                    allocationMap[a.type] = (allocationMap[a.type] || 0) + (a.currentValue || 0);
                  });
                  const total = Object.values(allocationMap).reduce((s, v) => s + v, 0);
                  const hexColors = ['#0f766e', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#f97316', '#14b8a6'];
                  const bgColors = ['bg-primary', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500', 'bg-sky-500', 'bg-orange-500', 'bg-teal-500'];
                  const entries = Object.entries(allocationMap).sort((a, b) => b[1] - a[1]);
                  return (
                    <>
                      {allocationChart === 'pie' ? (
                        <div className="flex items-center gap-5">
                          <svg viewBox="0 0 120 120" className="w-32 h-32 flex-shrink-0">
                            {(() => {
                              const r = 50, c = 2 * Math.PI * r;
                              let offset = 0;
                              return entries.map(([type, val], i) => {
                                const dash = total > 0 ? (val / total) * c : 0;
                                const el = (<circle key={type} cx="60" cy="60" r={r} fill="none" stroke={hexColors[i % hexColors.length]} strokeWidth="20" strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />);
                                offset += dash;
                                return el;
                              });
                            })()}
                            <circle cx="60" cy="60" r="30" fill="white" />
                            <text x="60" y="58" textAnchor="middle" className="text-[8px] fill-slate-400">Total</text>
                            <text x="60" y="68" textAnchor="middle" className="text-[9px] fill-slate-800 font-bold">{formatAmount(total)}</text>
                          </svg>
                          <div className="flex-1 space-y-1.5">
                            {entries.map(([type, val], i) => (
                              <div key={type} className="flex items-center gap-2 text-xs">
                                <div className={`w-2 h-2 rounded-full ${bgColors[i % bgColors.length]}`} />
                                <span className="text-slate-500 flex-1 truncate">{type}</span>
                                <span className="text-slate-400">{total > 0 ? ((val / total) * 100).toFixed(0) : 0}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex rounded-full h-3 overflow-hidden mb-4">
                            {entries.map(([type, val], i) => (
                              <div key={type} className={`${bgColors[i % bgColors.length]} transition-all`}
                                style={{ width: `${total > 0 ? (val / total) * 100 : 0}%` }}
                                title={`${type}: ${((val / total) * 100).toFixed(1)}%`} />
                            ))}
                          </div>
                          <div className="space-y-2">
                            {entries.map(([type, val], i) => (
                              <div key={type} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2.5 h-2.5 rounded-full ${bgColors[i % bgColors.length]}`} />
                                  <span className="text-slate-600">{type}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-secondary">{formatAmount(val)}</span>
                                  <span className="text-slate-400 w-10 text-right">{total > 0 ? ((val / total) * 100).toFixed(1) : 0}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Top Performers */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
                <h3 className="text-sm font-bold text-secondary mb-4">Top Direct Investments</h3>
                {investments.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-8">Add direct investments to see performance</div>
                ) : (
                  <div className="space-y-3">
                    {[...investments].sort((a, b) => calcGainPct(b) - calcGainPct(a)).map(inv => {
                      const gain = calcGain(inv);
                      const gainPct = calcGainPct(inv);
                      const xirr = calcXIRR(inv);
                      return (
                        <div key={inv.id} className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-semibold text-secondary">{inv.name}</div>
                            <div className="text-[10px] text-slate-400">{inv.type} · {formatAmount(calcValue(inv))}</div>
                          </div>
                          <div className="text-right">
                            <div className={`text-xs font-bold ${gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}% abs
                            </div>
                            {xirr !== null && (
                              <div className={`text-[10px] ${xirr >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                {xirr >= 0 ? '+' : ''}{xirr.toFixed(1)}% XIRR
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Portfolio XIRR Summary */}
            {investments.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
                <h3 className="text-sm font-bold text-secondary mb-3">Return Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Total Cost</div>
                    <div className="text-sm font-bold text-secondary">{formatAmount(totalCost)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Current Value</div>
                    <div className="text-sm font-bold text-secondary">{formatAmount(totalValue)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Absolute Return</div>
                    <div className={`text-sm font-bold ${totalGain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {totalGainPct >= 0 ? '+' : ''}{totalGainPct.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Portfolio XIRR</div>
                    <div className={`text-sm font-bold ${(() => {
                      // Weighted XIRR across all holdings
                      let totalWeightedXirr = 0, totalWeight = 0;
                      investments.forEach(inv => {
                        const x = calcXIRR(inv);
                        const v = calcValue(inv);
                        if (x !== null && v > 0) { totalWeightedXirr += x * v; totalWeight += v; }
                      });
                      return totalWeight > 0 ? totalWeightedXirr / totalWeight : 0;
                    })() >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {(() => {
                        let totalWeightedXirr = 0, totalWeight = 0;
                        investments.forEach(inv => {
                          const x = calcXIRR(inv);
                          const v = calcValue(inv);
                          if (x !== null && v > 0) { totalWeightedXirr += x * v; totalWeight += v; }
                        });
                        const pXirr = totalWeight > 0 ? totalWeightedXirr / totalWeight : 0;
                        return `${pXirr >= 0 ? '+' : ''}${pXirr.toFixed(2)}%`;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Phase 2: Premium Insights Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <GeographyAllocation investments={investments} />
              <BenchmarkComparison investments={investments} country={userCountry} />
            </div>

            {/* Dividend Tracker */}
            <div className="mb-6">
              <DividendTracker investments={investments} />
            </div>

            {/* PDF Report Download */}
            <div className="flex justify-end mb-4">
              <DownloadReportButton />
            </div>
                </>
              );
            })()}
          </>
        )}

        {activeTab === 'holdings' && (<>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 stagger">
          <div className="rounded-2xl p-5 bg-gradient-to-br from-secondary to-surface-700 text-white shadow-elevated animate-slideUp">
            <div className="text-sm text-white/50 mb-1">Total Value</div>
            <div className="text-3xl font-bold tracking-tight">{formatAmount(totalValue)}</div>
          </div>
          <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card animate-slideUp">
            <div className="text-sm text-slate-500 mb-1">Total Cost</div>
            <div className="text-3xl font-bold text-secondary tracking-tight">{formatAmount(totalCost)}</div>
          </div>
          <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card animate-slideUp">
            <div className="text-sm text-slate-500 mb-1">Total Gain/Loss</div>
            <div className={`text-3xl font-bold tracking-tight ${totalGain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalGain >= 0 ? '+' : ''}{formatAmount(totalGain)}
              <span className="text-sm font-medium ml-1.5">({totalGainPct >= 0 ? '+' : ''}{totalGainPct.toFixed(1)}%)</span>
            </div>
          </div>
        </div>

        {/* Asset Allocation */}
        {investments.length > 0 && (
          <div className="grid lg:grid-cols-2 gap-4 mb-8">
            {/* Donut/Bar Chart with toggle */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-secondary">Asset Allocation</h3>
                <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
                  <button onClick={() => setAllocationChart('bar')}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${allocationChart === 'bar' ? 'bg-white text-secondary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    Bar
                  </button>
                  <button onClick={() => setAllocationChart('pie')}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${allocationChart === 'pie' ? 'bg-white text-secondary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    Pie
                  </button>
                </div>
              </div>
              {(() => {
                const typeMap: Record<string, number> = {};
                investments.forEach(inv => {
                  const v = calcValue(inv);
                  const t = inv.type || 'Other';
                  typeMap[t] = (typeMap[t] || 0) + v;
                });
                const hexColors = ['#0f766e','#2563eb','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899','#84cc16','#f97316','#6b7280'];
                const bgColors = ['bg-primary', 'bg-blue-600', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500', 'bg-sky-500', 'bg-pink-500', 'bg-lime-500', 'bg-orange-500', 'bg-slate-500'];
                const entries = Object.entries(typeMap).sort((a,b) => b[1] - a[1]);
                const total = entries.reduce((s, [, v]) => s + v, 0);
                return allocationChart === 'pie' ? (
                  <div className="flex items-center gap-5">
                    <svg viewBox="0 0 120 120" className="w-32 h-32 flex-shrink-0">
                      {(() => {
                        const r = 50, c = 2 * Math.PI * r;
                        let offset = 0;
                        return entries.map(([type, val], i) => {
                          const dash = total > 0 ? (val / total) * c : 0;
                          const el = (<circle key={type} cx="60" cy="60" r={r} fill="none" stroke={hexColors[i % hexColors.length]} strokeWidth="20" strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />);
                          offset += dash;
                          return el;
                        });
                      })()}
                      <circle cx="60" cy="60" r="30" fill="white" />
                      <text x="60" y="58" textAnchor="middle" className="text-[8px] fill-slate-400">Total</text>
                      <text x="60" y="68" textAnchor="middle" className="text-[9px] fill-slate-800 font-bold">{investments.length}</text>
                    </svg>
                    <div className="flex-1 space-y-1.5">
                      {entries.map(([type, val], i) => (
                        <div key={type} className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${bgColors[i % bgColors.length]}`} />
                          <span className="text-slate-500 flex-1 truncate">{type}</span>
                          <span className="font-bold text-secondary">{formatAmount(val)}</span>
                          <span className="text-slate-400 w-10 text-right">{total > 0 ? ((val / total) * 100).toFixed(0) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex rounded-full h-3 overflow-hidden mb-4">
                      {entries.map(([type, val], i) => (
                        <div key={type} className={`${bgColors[i % bgColors.length]} transition-all`}
                          style={{ width: `${total > 0 ? (val / total) * 100 : 0}%` }}
                          title={`${type}: ${((val / total) * 100).toFixed(1)}%`} />
                      ))}
                    </div>
                    <div className="space-y-2">
                      {entries.map(([type, val], i) => (
                        <div key={type} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${bgColors[i % bgColors.length]}`} />
                            <span className="text-slate-600">{type}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-secondary">{formatAmount(val)}</span>
                            <span className="text-slate-400 w-10 text-right">{total > 0 ? ((val / total) * 100).toFixed(1) : 0}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* AI Portfolio Insight */}
            <div className="bg-gradient-to-br from-primary/5 to-teal-50 rounded-2xl border border-primary/10 shadow-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                </div>
                <h3 className="text-sm font-bold text-secondary">AI Portfolio Insight</h3>
                <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold ml-auto">BETA</span>
              </div>
              {(() => {
                // Generate insights based on portfolio data
                const typeMap: Record<string, { value: number; cost: number }> = {};
                investments.forEach(inv => {
                  const t = inv.type || 'Other';
                  if (!typeMap[t]) typeMap[t] = { value: 0, cost: 0 };
                  typeMap[t].value += calcValue(inv);
                  typeMap[t].cost += inv.quantity * inv.purchasePrice;
                });
                const entries = Object.entries(typeMap).sort((a,b) => b[1].value - a[1].value);
                const topType = entries[0];
                const topPct = totalValue > 0 && topType ? ((topType[1].value / totalValue) * 100) : 0;
                const hasConcentration = topPct > 60;
                const bestPerf = [...investments].sort((a, b) => calcGainPct(b) - calcGainPct(a))[0];
                const worstPerf = [...investments].sort((a, b) => calcGainPct(a) - calcGainPct(b))[0];

                const insights: { icon: string; text: string; type: 'info' | 'warn' | 'good' }[] = [];

                if (hasConcentration && topType) {
                  insights.push({ icon: '⚠️', text: `${topPct.toFixed(0)}% of your portfolio is in ${topType[0]}. Consider diversifying across asset classes.`, type: 'warn' });
                } else if (entries.length >= 3) {
                  insights.push({ icon: '✅', text: `Good diversification across ${entries.length} asset types. Your portfolio is well-balanced.`, type: 'good' });
                }
                if (bestPerf && calcGainPct(bestPerf) > 20) {
                  insights.push({ icon: '🚀', text: `${bestPerf.name} is your top performer at +${calcGainPct(bestPerf).toFixed(1)}%. Consider rebalancing gains.`, type: 'good' });
                }
                if (worstPerf && calcGainPct(worstPerf) < -15) {
                  insights.push({ icon: '📉', text: `${worstPerf.name} is down ${calcGainPct(worstPerf).toFixed(1)}%. Review if the thesis still holds.`, type: 'warn' });
                }
                if (investments.length === 1) {
                  insights.push({ icon: '💡', text: 'You have a single holding. Adding more investments can reduce risk through diversification.', type: 'info' });
                }
                if (investments.length >= 3 && totalGainPct > 0) {
                  insights.push({ icon: '📊', text: `Your portfolio is up ${totalGainPct.toFixed(1)}% overall. Keep tracking and consider tax-loss harvesting at year-end.`, type: 'info' });
                }
                if (insights.length === 0) {
                  insights.push({ icon: '💡', text: 'Add more investments to get personalised AI insights about your portfolio health and allocation.', type: 'info' });
                }

                return (
                  <div className="space-y-3">
                    {insights.slice(0, 3).map((ins, i) => (
                      <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl text-xs ${
                        ins.type === 'warn' ? 'bg-amber-50 border border-amber-100' : ins.type === 'good' ? 'bg-emerald-50 border border-emerald-100' : 'bg-white border border-slate-100'
                      }`}>
                        <span className="text-sm flex-shrink-0">{ins.icon}</span>
                        <span className="text-slate-700 leading-relaxed">{ins.text}</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-slate-400 mt-2">Insights are generated locally from your portfolio data. Use fynzo Intelligence for personalised AI advice.</p>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Table / Cards */}
        {pageLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : investments.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-secondary mb-2">No investments yet</h3>
            <p className="text-slate-500 mb-6 max-w-sm mx-auto">Add your first investment to start tracking your portfolio performance.</p>
            <button onClick={() => { resetForm(); setShowModal(true); }}
              className="px-6 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all">
              Add Your First Investment
            </button>
          </div>
        ) : (
          <>
            {/* Tier 2: Filter Bar */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                {['all', ...investmentTypes].map(t => (
                  <button key={t} onClick={() => setFilterType(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filterType === t ? 'bg-white text-secondary shadow-sm' : 'text-slate-500 hover:text-secondary'}`}>
                    {t === 'all' ? 'All Types' : t}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                {([['all', 'All'], ['profit', '↑ Profit'], ['loss', '↓ Loss']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setFilterGain(k)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filterGain === k ? 'bg-white text-secondary shadow-sm' : 'text-slate-500 hover:text-secondary'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-400 ml-auto">{sortedFilteredInvestments.length} of {investments.length} holdings</span>
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-primary select-none" onClick={() => toggleSort('name')}>
                      Asset {sortBy === 'name' && (sortDir === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-primary select-none" onClick={() => toggleSort('date')}>
                      Date {sortBy === 'date' && (sortDir === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                    <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Buy Price</th>
                    <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Current</th>
                    <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-primary select-none" onClick={() => toggleSort('value')}>
                      Value {sortBy === 'value' && (sortDir === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-primary select-none" onClick={() => toggleSort('gainPct')}>
                      Gain/Loss {sortBy === 'gainPct' && (sortDir === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-primary select-none" onClick={() => toggleSort('cagr')}>
                      CAGR {sortBy === 'cagr' && (sortDir === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFilteredInvestments.map((inv) => {
                    const gain = calcGain(inv);
                    const gainPct = calcGainPct(inv);
                    const xirr = calcXIRR(inv);
                    return (
                      <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-5">
                          <div className="font-semibold text-secondary">{inv.name}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-1.5">
                            {inv.symbol && <span className="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded text-[10px]">{inv.symbol}</span>}
                            <span>{inv.type}</span>
                            {inv.exchange && <span className="text-slate-300">· {inv.exchange}</span>}
                          </div>
                        </td>
                        <td className="text-right py-4 px-5 text-xs text-slate-500">
                          {inv.purchaseDate ? new Date(inv.purchaseDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="text-right py-4 px-5 text-sm text-secondary">{inv.quantity}</td>
                        <td className="text-right py-4 px-5 text-sm text-slate-600">{formatAmount(inv.purchasePrice)}</td>
                        <td className="text-right py-4 px-5 text-sm text-secondary font-medium">{formatAmount(inv.currentPrice)}</td>
                        <td className="text-right py-4 px-5 text-sm font-semibold text-secondary">{formatAmount(calcValue(inv))}</td>
                        <td className={`text-right py-4 px-5 text-sm font-semibold ${gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {gain >= 0 ? '+' : ''}{formatAmount(gain)}
                          <div className="text-[10px] font-medium opacity-80">{gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%</div>
                        </td>
                        <td className={`text-right py-4 px-5 text-xs font-semibold ${xirr !== null && xirr >= 0 ? 'text-emerald-600' : xirr !== null ? 'text-red-500' : 'text-slate-300'}`}>
                          {xirr !== null ? `${xirr >= 0 ? '+' : ''}${xirr.toFixed(1)}%` : '—'}
                        </td>
                        <td className="text-right py-4 px-5">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(inv)} aria-label="Edit investment" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                              </svg>
                            </button>
                            <button onClick={() => setDeleteConfirmId(inv.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {sortedFilteredInvestments.map((inv) => {
                const gain = calcGain(inv);
                const gainPct = calcGainPct(inv);
                const xirr = calcXIRR(inv);
                return (
                  <div key={inv.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold text-secondary">{inv.name}</div>
                        <div className="text-xs text-slate-400">{inv.type} · {inv.quantity} units</div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(inv)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button onClick={() => setDeleteConfirmId(inv.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-xs text-slate-400">Value</div>
                        <div className="text-lg font-bold text-secondary">{formatAmount(calcValue(inv))}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Gain/Loss</div>
                        <div className={`text-sm font-semibold ${gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {gain >= 0 ? '+' : ''}{formatAmount(gain)} ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}% abs)
                        </div>
                        {xirr !== null && (
                          <div className={`text-[10px] font-medium ${xirr >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                            XIRR: {xirr >= 0 ? '+' : ''}{xirr.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Delete Confirm Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirmId(null)}>
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-elevated" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-secondary mb-2">Delete Investment</h3>
              <p className="text-slate-500 text-sm mb-6">Are you sure? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => handleDelete(deleteConfirmId)} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors">Delete</button>
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowModal(false); resetForm(); }}>
            <div className="bg-white rounded-2xl p-6 lg:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-elevated animate-slideUp" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-secondary font-display">{editingId ? 'Edit' : 'Add'} Investment</h2>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Symbol Search — the main enhancement */}
                <div ref={searchRef} className="relative">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Search Stock / ETF / Crypto
                    <span className="text-xs text-slate-400 font-normal ml-2">Powered by Twelve Data</span>
                  </label>
                  <div className="relative">
                    <input type="text" value={searchQuery}
                      onChange={e => handleSearchChange(e.target.value)}
                      onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                      placeholder="Search by name or ticker, e.g. AAPL, MSCI World, BTC..."
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                    <svg className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    {searching && (
                      <div className="absolute right-3 top-3.5">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {/* Dropdown results */}
                  {showDropdown && (searchResults.length > 0 || searching) && (
                    <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-xl max-h-64 overflow-y-auto">
                      {searching && searchResults.length === 0 && (
                        <div className="px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Searching...
                        </div>
                      )}
                      {searchResults.map((r, i) => (
                        <button key={`${r.symbol}-${r.exchange}-${i}`} type="button"
                          onClick={() => handleSelectSymbol(r)}
                          className="w-full px-4 py-2.5 text-left hover:bg-primary/5 transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-primary text-sm">{r.symbol}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{r.type || 'Stock'}</span>
                            </div>
                            <div className="text-xs text-slate-500 truncate">{r.instrument_name}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className={`text-[10px] font-semibold ${/xetra|frankfurt|fwb|etr|euronext|tradegate/i.test(r.exchange) ? 'text-primary bg-primary/10 px-1.5 py-0.5 rounded' : 'text-slate-400'}`}>{r.exchange}</div>
                            <div className="text-[10px] text-slate-400">{r.currency}</div>
                          </div>
                        </button>
                      ))}
                      {!searching && searchResults.length === 0 && searchQuery.trim().length > 0 && (
                        <div className="px-4 py-3 text-sm text-slate-400">No results found</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Selected symbol badge */}
                {assetSymbol && (
                  <div className="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-mono font-bold text-primary">{assetSymbol}</span>
                      <span className="text-sm text-slate-600">{assetName}</span>
                      {assetExchange && <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded">{assetExchange}</span>}
                    </div>
                    {fetchingPrice && (
                      <div className="flex items-center gap-1 text-[10px] text-primary">
                        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Fetching price...
                      </div>
                    )}
                    <button onClick={() => { setAssetSymbol(''); setAssetName(''); setSearchQuery(''); setAssetExchange(''); }}
                      className="text-slate-400 hover:text-red-500 p-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Manual name entry (if no symbol selected) */}
                {!assetSymbol && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Or enter asset name manually</label>
                    <input type="text" value={assetName} onChange={e => setAssetName(e.target.value)}
                      placeholder="e.g., Gold Bar, Private Investment..." className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Asset Type</label>
                  <select value={assetType} onChange={e => setAssetType(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary bg-white">
                    {assetTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <SmartDateInput
                      label="Purchase Date"
                      value={purchaseDate}
                      onChange={handleDateChange}
                      max={new Date().toISOString().split('T')[0]}
                      compact
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Quantity</label>
                    <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
                      placeholder="0" min="0" step="0.01" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Currency</label>
                    <input type="text" value={currency} disabled className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-slate-700">Purchase Price ({currency})</label>
                      {fetchingHistorical && (
                        <span className="text-[10px] text-primary flex items-center gap-1">
                          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Auto-fetching...
                        </span>
                      )}
                    </div>
                    <input type="number" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)}
                      placeholder="0" min="0" step="0.01" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" />
                    {assetSymbol && purchasePrice && (
                      <div className="text-[10px] text-emerald-600 mt-0.5">Price on {purchaseDate}</div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-slate-700">Current Price ({currency})</label>
                      {fetchingPrice && (
                        <span className="text-[10px] text-primary flex items-center gap-1">
                          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </span>
                      )}
                      {assetSymbol && !fetchingPrice && (
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold">Live</span>
                      )}
                    </div>
                    <input type="number" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)}
                      placeholder="Same as purchase" min="0" step="0.01" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                    placeholder="Optional notes..." className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary resize-none" />
                </div>

                {/* Dividend Fields (collapsible) */}
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    Dividend info (optional)
                  </summary>
                  <div className="grid grid-cols-2 gap-4 mt-3 pl-5 border-l-2 border-primary/10">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Dividend yield (%)</label>
                      <input type="number" step="0.01" value={dividendYield} onChange={e => setDividendYield(e.target.value)}
                        placeholder="e.g. 2.5" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-secondary" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Dividend/share (annual)</label>
                      <input type="number" step="0.01" value={dividendPerShare} onChange={e => setDividendPerShare(e.target.value)}
                        placeholder="e.g. 1.20" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-secondary" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Frequency</label>
                      <select value={dividendFrequency} onChange={e => setDividendFrequency(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-secondary bg-white">
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="semi-annual">Semi-Annual</option>
                        <option value="annual">Annual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Last dividend date</label>
                      <input type="date" value={lastDividendDate} onChange={e => setLastDividendDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-secondary" />
                    </div>
                  </div>
                </details>

                {quantity && purchasePrice && Number(quantity) > 0 && Number(purchasePrice) > 0 && (
                  <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-primary">Total Cost</span>
                      <span className="text-xl font-bold text-primary">{formatAmount(Number(quantity) * Number(purchasePrice))}</span>
                    </div>
                    {currentPrice && Number(currentPrice) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Current Value</span>
                        <span className="text-sm font-bold text-secondary">{formatAmount(Number(quantity) * Number(currentPrice))}</span>
                      </div>
                    )}
                    {currentPrice && purchasePrice && Number(currentPrice) > 0 && Number(purchasePrice) > 0 && (
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-slate-500">Gain/Loss</span>
                        {(() => {
                          const gain = (Number(currentPrice) - Number(purchasePrice)) * Number(quantity);
                          const pct = ((Number(currentPrice) - Number(purchasePrice)) / Number(purchasePrice)) * 100;
                          return (
                            <span className={`text-xs font-bold ${gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {gain >= 0 ? '+' : ''}{formatAmount(gain)} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
                            </span>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={handleSave} disabled={loading}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all text-white ${loading ? 'bg-slate-300 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20'}`}>
                    {loading ? 'Saving...' : editingId ? 'Update Investment' : 'Add Investment'}
                  </button>
                  <button onClick={() => { setShowModal(false); resetForm(); }} disabled={loading}
                    className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Broker Import Modal */}
        <BrokerImportModal open={showImport} onClose={() => setShowImport(false)} onImported={loadInvestments} />

        </>)}

        {/* ─── MIP TAB ──────────────────────────────────── */}
        {activeTab === 'mip' && (
          <>
            {/* MIP Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 stagger">
              <div className="rounded-2xl p-5 bg-gradient-to-br from-secondary to-surface-700 text-white shadow-elevated animate-slideUp">
                <div className="text-xs text-white/50 mb-1">Total Invested</div>
                <div className="text-2xl font-bold tracking-tight">{formatAmount(totalMipInvested)}</div>
                <div className="text-xs text-white/40 mt-1">{mips.length} plan{mips.length !== 1 ? 's' : ''} · ~{formatAmount(totalMipMonthly)}/mo</div>
              </div>
              <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card animate-slideUp">
                <div className="text-xs text-slate-500 mb-1">Annual Investment</div>
                <div className="text-2xl font-bold text-secondary tracking-tight">{formatAmount(totalMipAnnual)}</div>
                <div className="text-xs text-slate-400 mt-1">per year</div>
              </div>
              <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card animate-slideUp">
                <div className="text-xs text-slate-500 mb-1">Categories</div>
                <div className="text-2xl font-bold text-secondary tracking-tight">{new Set(mips.map(m => m.category)).size}</div>
                <div className="text-xs text-slate-400 mt-1">active categories</div>
              </div>
            </div>

            {/* MIP List */}
            {mips.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-card">
                <div className="text-5xl mb-4">💹</div>
                <h3 className="text-lg font-bold text-secondary mb-2">No recurring investments yet</h3>
                <p className="text-sm text-slate-400 mb-6">Track your recurring investments — ETF savings plans, stock purchases, crypto DCA, and more.</p>
                <button onClick={() => { resetMipForm(); setShowMipModal(true); }}
                  className="px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                  Add Your First Plan
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
                <div className="divide-y divide-slate-50">
                  {mips.map(mip => {
                    const cat = MIP_CATEGORIES.find(c => c.id === mip.category) || MIP_CATEGORIES[3];
                    const freq = mip.frequency || 'monthly';
                    const freqLabel = freq === 'monthly' ? 'mo' : freq === 'quarterly' ? 'qtr' : 'yr';
                    
                    // Auto-generate expected entries from startDate using frequency
                    const generatedEntries = getMipGeneratedEntries(mip);
                    
                    // Merge: use Firestore entries if they exist, otherwise use generated
                    const firestoreEntries = mip.entries || [];
                    const displayEntries = firestoreEntries.length > 0 ? firestoreEntries : generatedEntries.map((e, i) => ({
                      id: `gen-${i}`,
                      date: e.date,
                      amount: e.amount,
                      nav: undefined,
                      units: undefined,
                    }));
                    
                    const totalInvested = generatedEntries.reduce((s, e) => s + e.amount, 0);
                    const entryCount = generatedEntries.length > 0 ? generatedEntries.length : firestoreEntries.length;
                    
                    return (
                      <details key={mip.id} className="group">
                        <summary className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer list-none">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center text-lg">{cat.icon}</div>
                            <div>
                              <div className="text-sm font-semibold text-secondary">{mip.name}</div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-semibold">{mip.category}</span>
                                {mip.startDate && <><span className="text-slate-300">·</span><span>Started {new Date(mip.startDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></>}
                                {entryCount > 0 && <><span className="text-slate-200">·</span><span className="text-primary">{entryCount} months</span></>}
                                {totalInvested > 0 && <><span className="text-slate-200">·</span><span className="font-semibold">Invested: {formatAmount(totalInvested)}</span></>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm font-bold text-secondary">{formatAmount(mip.monthlyAmount)}</div>
                              <div className="text-[10px] text-slate-400">/{freqLabel}</div>
                            </div>
                            <svg className="w-4 h-4 text-slate-300 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                            <div className="flex gap-0.5">
                              <button onClick={(e) => { e.preventDefault(); openMipEdit(mip); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                              </button>
                              <button onClick={(e) => { e.preventDefault(); setDeleteMipId(mip.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                              </button>
                            </div>
                          </div>
                        </summary>
                        {/* Expanded: Monthly entries (auto-generated from start date) */}
                        <div className="px-5 pb-4 bg-slate-50/30">
                          {displayEntries.length > 0 ? (
                            <div className="ml-13 border-l-2 border-primary/10 pl-4">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-slate-400 text-[10px] uppercase">
                                    <th className="text-left py-1.5 font-semibold">#</th>
                                    <th className="text-left py-1.5 font-semibold">Date</th>
                                    <th className="text-right py-1.5 font-semibold">Amount</th>
                                    <th className="text-right py-1.5 font-semibold">Cumulative</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {displayEntries.map((entry, idx) => {
                                    const cumulative = displayEntries.slice(0, idx + 1).reduce((s, e) => s + e.amount, 0);
                                    return (
                                      <tr key={entry.id || idx} className="border-t border-slate-100">
                                        <td className="py-1.5 text-slate-400">{idx + 1}</td>
                                        <td className="py-1.5 text-slate-600">{new Date(entry.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                        <td className="py-1.5 text-right font-semibold text-secondary">{formatAmount(entry.amount)}</td>
                                        <td className="py-1.5 text-right text-primary font-semibold">{formatAmount(cumulative)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t-2 border-slate-200 font-semibold text-secondary">
                                    <td className="py-2" colSpan={2}>Total ({displayEntries.length} months)</td>
                                    <td className="py-2 text-right">{formatAmount(totalInvested)}</td>
                                    <td className="py-2 text-right text-primary">{formatAmount(totalInvested)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          ) : (
                            <div className="ml-13 text-xs text-slate-400 py-3 pl-4 border-l-2 border-slate-100">
                              Set a start date to automatically track monthly investments.
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500">Total Invested: <span className="text-primary">{formatAmount(totalMipInvested)}</span></span>
                  <span className="text-sm font-bold text-primary">~{formatAmount(totalMipMonthly)}/mo → {formatAmount(totalMipAnnual)}/yr</span>
                </div>
              </div>
            )}

            {/* Delete MIP Confirm */}
            {deleteMipId && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDeleteMipId(null)}>
                <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-elevated" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-secondary mb-2">Delete Plan</h3>
                  <p className="text-slate-500 text-sm mb-6">Remove this monthly investment plan?</p>
                  <div className="flex gap-3">
                    <button onClick={() => handleDeleteMip(deleteMipId)} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600">Delete</button>
                    <button onClick={() => setDeleteMipId(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {/* Add/Edit MIP Modal */}
            {showMipModal && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowMipModal(false); resetMipForm(); }}>
                <div className="bg-white rounded-2xl p-6 lg:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-elevated animate-slideUp" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-secondary font-display">{editingMipId ? 'Edit' : 'Add'} Recurring Investment</h2>
                    <button onClick={() => { setShowMipModal(false); resetMipForm(); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Symbol Search */}
                    <div ref={mipSearchRef} className="relative">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Search Stock / ETF / Crypto
                        <span className="text-xs text-slate-400 font-normal ml-2">Powered by Twelve Data</span>
                      </label>
                      <div className="relative">
                        <input type="text" value={mipSearchQuery} onChange={e => handleMipSearch(e.target.value)}
                          onFocus={() => mipSearchResults.length > 0 && setMipShowDropdown(true)}
                          placeholder="Search by name or ticker — e.g. MSCI World, VWCE, BTC..."
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                        <svg className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                        {mipSearching && (
                          <div className="absolute right-3 top-3.5">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      {/* Dropdown results */}
                      {mipShowDropdown && (mipSearchResults.length > 0 || mipSearching) && (
                        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-xl max-h-64 overflow-y-auto">
                          {mipSearching && mipSearchResults.length === 0 && (
                            <div className="px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                              Searching...
                            </div>
                          )}
                          {mipSearchResults.map((r, i) => (
                            <button key={`${r.symbol}-${r.exchange}-${i}`} type="button"
                              onClick={() => handleMipSelectSymbol(r)}
                              className="w-full px-4 py-2.5 text-left hover:bg-primary/5 transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-primary text-sm">{r.symbol}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{r.type || 'Stock'}</span>
                                </div>
                                <div className="text-xs text-slate-500 truncate">{r.instrument_name}</div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className={`text-[10px] font-semibold ${/xetra|frankfurt|fwb|etr|euronext|tradegate/i.test(r.exchange) ? 'text-primary bg-primary/10 px-1.5 py-0.5 rounded' : 'text-slate-400'}`}>{r.exchange}</div>
                                <div className="text-[10px] text-slate-400">{r.currency}</div>
                              </div>
                            </button>
                          ))}
                          {!mipSearching && mipSearchResults.length === 0 && mipSearchQuery.trim().length > 0 && (
                            <div className="px-4 py-3 text-sm text-slate-400">No results found</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected symbol badge */}
                    {mipSymbol && (
                      <div className="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="font-mono font-bold text-primary">{mipSymbol}</span>
                          <span className="text-sm text-slate-600">{mipName}</span>
                        </div>
                        {mipFetchingPrice && (
                          <div className="flex items-center gap-1 text-[10px] text-primary">
                            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            Fetching price...
                          </div>
                        )}
                        <button type="button" onClick={() => { setMipSymbol(''); setMipName(''); setMipSearchQuery(''); setMipCurrentPrice(''); }}
                          className="text-slate-400 hover:text-red-500 p-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Manual name entry (if no symbol selected) */}
                    {!mipSymbol && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Or enter plan name manually</label>
                        <input type="text" value={mipName} onChange={e => setMipName(e.target.value)}
                          placeholder={mipCategory === 'ETF' ? 'e.g., IE00B4L5Y983 or MSCI World ETF' : 'e.g., Gold Bar, Private Investment...'} 
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" />
                      </div>
                    )}

                    {/* Category */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
                      <select value={mipCategory} onChange={e => setMipCategory(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary bg-white">
                        {MIP_CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>)}
                      </select>
                    </div>

                    {/* Amount / Frequency / Start Date row */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount ({currency})</label>
                        <input type="number" value={mipAmount} onChange={e => setMipAmount(e.target.value)}
                          placeholder="0" min="0" step="0.01"
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Frequency</label>
                        <select value={mipFrequency} onChange={e => setMipFrequency(e.target.value as any)}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary bg-white">
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <SmartDateInput label="Start Date" value={mipStartDate} onChange={v => setMipStartDate(v)}
                          max={new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString().split('T')[0]} compact />
                      </div>
                    </div>

                    {/* Purchase Price / Current Price row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Avg. Purchase Price ({currency})</label>
                        <input type="number" value={mipPurchasePrice} onChange={e => setMipPurchasePrice(e.target.value)}
                          placeholder="0" min="0" step="0.01" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-sm font-medium text-slate-700">Current Price ({currency})</label>
                          {mipFetchingPrice && (
                            <span className="text-[10px] text-primary flex items-center gap-1">
                              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </span>
                          )}
                          {mipCurrentPrice && mipSymbol && !mipFetchingPrice && (
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold">Live</span>
                          )}
                        </div>
                        <input type="number" value={mipCurrentPrice} onChange={e => setMipCurrentPrice(e.target.value)}
                          placeholder="Same as purchase" min="0" step="0.01" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary" />
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                      <textarea value={mipNotes} onChange={e => setMipNotes(e.target.value)} rows={2} placeholder="Optional notes..."
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary resize-none" />
                    </div>

                    {/* Summary card */}
                    {mipAmount && Number(mipAmount) > 0 && (
                      <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-primary">Annual Investment</span>
                          <span className="text-xl font-bold text-primary">{formatAmount(Number(mipAmount) * (mipFrequency === 'monthly' ? 12 : mipFrequency === 'quarterly' ? 4 : 1))}</span>
                        </div>
                        {mipPurchasePrice && mipCurrentPrice && Number(mipPurchasePrice) > 0 && Number(mipCurrentPrice) > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500">Price Return</span>
                            {(() => {
                              const pct = ((Number(mipCurrentPrice) - Number(mipPurchasePrice)) / Number(mipPurchasePrice)) * 100;
                              return (
                                <span className={`text-xs font-bold ${pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button onClick={handleSaveMip} disabled={loading || !mipName.trim() || !mipAmount}
                        className={`flex-1 py-3 rounded-xl font-semibold transition-all text-white ${loading || !mipName.trim() || !mipAmount ? 'bg-slate-300 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20'}`}>
                        {loading ? 'Saving...' : editingMipId ? 'Update Plan' : 'Add Recurring Investment'}
                      </button>
                      <button onClick={() => { setShowMipModal(false); resetMipForm(); }} disabled={loading}
                        className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── Cash & Savings Tab ───────────────────── */}
        {activeTab === 'cash' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-elevated">
                <div className="text-xs text-white/50 mb-1">Total Cash & Savings</div>
                <div className="text-2xl font-bold tracking-tight">{formatAmount(totalCashSavings)}</div>
                <div className="text-xs text-white/40 mt-1">{cashSavings.length} account{cashSavings.length !== 1 ? 's' : ''}</div>
              </div>
            </div>

            {cashSavings.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-card">
                <div className="text-5xl mb-4">🏦</div>
                <h3 className="text-lg font-bold text-secondary mb-2">No cash & savings yet</h3>
                <p className="text-sm text-slate-400 mb-6">Track your bank savings, cash reserves, and other liquid assets.</p>
                <button onClick={() => setShowCashModal(true)}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20">
                  Add Cash or Savings
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
                <div className="divide-y divide-slate-50">
                  {cashSavings.map(cs => (
                    <div key={cs.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg">
                          {cs.type === 'Bank Savings' ? '🏦' : cs.type === 'Cash' ? '💵' : '📦'}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-secondary">{cs.name}</div>
                          <div className="text-[10px] text-slate-400">
                            <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded text-[9px] font-semibold">{cs.type}</span>
                            {cs.notes && <span className="ml-1.5">{cs.notes}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-bold text-secondary">{formatAmount(cs.amount)}</div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setCashEditId(cs.id); setCashName(cs.name); setCashType(cs.type); setCashAmount(String(cs.amount)); setCashNotes(cs.notes); setShowCashModal(true); }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                          </button>
                          <button onClick={async () => { if (!user) return; await deleteDoc(doc(db, 'users', user.uid, 'cashSavings', cs.id)); await loadCashSavings(); }}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 bg-emerald-50 border-t border-emerald-100 flex justify-between items-center">
                  <span className="text-xs font-semibold text-emerald-700">Total</span>
                  <span className="text-sm font-bold text-emerald-700">{formatAmount(totalCashSavings)}</span>
                </div>
              </div>
            )}

            {/* Cash Add/Edit Modal */}
            {showCashModal && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowCashModal(false); resetCashForm(); }}>
                <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-elevated animate-slideUp" onClick={e => e.stopPropagation()}>
                  <h2 className="text-xl font-bold text-secondary mb-6">{cashEditId ? 'Edit' : 'Add'} Cash & Savings</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-2">Type</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Bank Savings', 'Cash', 'Other'] as const).map(t => (
                          <button key={t} onClick={() => setCashType(t)}
                            className={`p-3 rounded-xl border-2 text-center transition-all ${cashType === t ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100'}`}>
                            <div className="text-lg mb-0.5">{t === 'Bank Savings' ? '🏦' : t === 'Cash' ? '💵' : '📦'}</div>
                            <div className="text-[10px] font-semibold text-secondary">{t}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Name</label>
                      <input type="text" value={cashName} onChange={e => setCashName(e.target.value)}
                        placeholder="e.g., ING Savings, Emergency Fund..." className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-secondary" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Amount ({currency})</label>
                      <input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)}
                        placeholder="0" min="0" step="0.01" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-secondary" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Notes <span className="text-slate-300">(optional)</span></label>
                      <input type="text" value={cashNotes} onChange={e => setCashNotes(e.target.value)}
                        placeholder="Optional" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-secondary" />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={handleSaveCash} disabled={!cashName.trim() || !cashAmount}
                        className={`flex-1 py-3 rounded-xl font-semibold text-sm text-white ${!cashName.trim() || !cashAmount ? 'bg-slate-300' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                        {cashEditId ? 'Update' : 'Add'}
                      </button>
                      <button onClick={() => { setShowCashModal(false); resetCashForm(); }} className="px-6 py-3 border border-slate-200 rounded-xl text-sm font-semibold">Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── Assets Tab (Physical Assets) ───────────────────── */}
        {activeTab === 'assets' && (
          <>
            {/* Assets Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 stagger">
              <div className="rounded-2xl p-5 bg-gradient-to-br from-secondary to-surface-700 text-white shadow-elevated">
                <div className="text-xs text-white/50 mb-1">Total Asset Value</div>
                <div className="text-2xl font-bold tracking-tight">{formatAmount(totalAssetValue)}</div>
                <div className="text-xs text-white/40 mt-1">{physicalAssets.length} asset{physicalAssets.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card">
                <div className="text-xs text-slate-500 mb-1">Total Purchase Cost</div>
                <div className="text-2xl font-bold text-secondary tracking-tight">{formatAmount(totalAssetCost)}</div>
              </div>
              <div className="rounded-2xl p-5 bg-white border border-slate-200/80 shadow-card">
                <div className="text-xs text-slate-500 mb-1">Appreciation</div>
                <div className={`text-2xl font-bold tracking-tight ${totalAssetValue - totalAssetCost >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {totalAssetValue - totalAssetCost >= 0 ? '+' : ''}{formatAmount(totalAssetValue - totalAssetCost)}
                </div>
              </div>
            </div>

            {/* Asset List */}
            {physicalAssets.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-card">
                <div className="text-5xl mb-4">🏠</div>
                <h3 className="text-lg font-bold text-secondary mb-2">No assets yet</h3>
                <p className="text-sm text-slate-400 mb-6">Track real estate, vehicles, land, jewelry, and other physical assets.</p>
                <button onClick={() => { resetAssetForm(); setShowAssetModal(true); }}
                  className="px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                  Add Your First Asset
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Asset</th>
                        <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Purchase Price</th>
                        <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Value</th>
                        <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Gain/Loss</th>
                        <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {physicalAssets.map(asset => {
                        const aGain = asset.currentValue - asset.purchasePrice;
                        const aGainPct = asset.purchasePrice > 0 ? (aGain / asset.purchasePrice) * 100 : 0;
                        const aType = ASSET_TYPES.find(t => t.id === asset.type);
                        return (
                          <tr key={asset.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-base">{aType?.icon || '📦'}</div>
                                <div>
                                  <div className="font-semibold text-secondary text-sm">{asset.name}</div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                    <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[9px] font-semibold">{asset.type}</span>
                                    {asset.purchaseDate && <span>{new Date(asset.purchaseDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="text-right py-4 px-5 text-sm text-slate-600">{formatAmount(asset.purchasePrice)}</td>
                            <td className="text-right py-4 px-5 text-sm font-semibold text-secondary">{formatAmount(asset.currentValue)}</td>
                            <td className={`text-right py-4 px-5 text-sm font-semibold ${aGain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {aGain >= 0 ? '+' : ''}{formatAmount(aGain)}
                              <div className="text-[10px] font-medium opacity-80">{aGainPct >= 0 ? '+' : ''}{aGainPct.toFixed(1)}%</div>
                            </td>
                            <td className="text-right py-4 px-5">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => {
                                  setPaName(asset.name); setPaType(asset.type); setPaPurchasePrice(String(asset.purchasePrice));
                                  setPaCurrentValue(String(asset.currentValue)); setPaPurchaseDate(asset.purchaseDate || '');
                                  setPaNotes(asset.notes || ''); setAssetEditId(asset.id); setShowAssetModal(true);
                                }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                                </button>
                                <button onClick={async () => {
                                  if (!user) return;
                                  await deleteDoc(doc(db, 'users', user.uid, 'physicalAssets', asset.id));
                                  await loadAssets();
                                }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Add/Edit Asset Modal */}
            {showAssetModal && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowAssetModal(false); resetAssetForm(); }}>
                <div className="bg-white rounded-2xl p-6 lg:p-8 max-w-lg w-full shadow-elevated animate-slideUp" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-secondary font-display">{assetEditId ? 'Edit' : 'Add'} Asset</h2>
                    <button onClick={() => { setShowAssetModal(false); resetAssetForm(); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-2">Asset Type</label>
                      <div className="grid grid-cols-3 gap-2">
                        {ASSET_TYPES.map(t => (
                          <button key={t.id} type="button" onClick={() => setPaType(t.id)}
                            className={`p-2.5 rounded-xl border-2 text-center transition-all ${paType === t.id ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-slate-200'}`}>
                            <div className="text-lg mb-0.5">{t.icon}</div>
                            <div className="text-[10px] font-semibold text-secondary">{t.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Asset Name</label>
                      <input type="text" value={paName} onChange={e => setPaName(e.target.value)}
                        placeholder={paType === 'Real Estate' ? 'e.g., Berlin apartment, Munich house' : paType === 'Vehicle' ? 'e.g., BMW 3 Series, Tesla Model 3' : paType === 'Land' ? 'e.g., Plot in Hamburg' : 'Description'}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Purchase Price ({currency})</label>
                        <input type="number" value={paPurchasePrice} onChange={e => setPaPurchasePrice(e.target.value)}
                          placeholder="0" min="0" step="0.01"
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Current Value ({currency})</label>
                        <input type="number" value={paCurrentValue} onChange={e => setPaCurrentValue(e.target.value)}
                          placeholder="Estimated current market value" min="0" step="0.01"
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                      </div>
                    </div>
                    <SmartDateInput label="Purchase Date (optional)" value={paPurchaseDate} onChange={v => setPaPurchaseDate(v)}
                      max={new Date().toISOString().split('T')[0]} compact />
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Notes <span className="text-slate-300 font-normal">(optional)</span></label>
                      <textarea value={paNotes} onChange={e => setPaNotes(e.target.value)} rows={2} placeholder="Address, registration, other details..."
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-secondary resize-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={handleSaveAsset} disabled={loading || !paName.trim() || !paCurrentValue}
                        className={`flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all ${loading || !paName.trim() || !paCurrentValue ? 'bg-slate-300 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20'}`}>
                        {loading ? 'Saving...' : assetEditId ? 'Update Asset' : 'Add Asset'}
                      </button>
                      <button onClick={() => { setShowAssetModal(false); resetAssetForm(); }} className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50">Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB — contextual add button (hidden on overview) */}
      {activeTab !== 'overview' && (
        <button
          onClick={() => activeTab === 'holdings' ? setShowModal(true) : activeTab === 'mip' ? (() => { resetMipForm(); setShowMipModal(true); })() : activeTab === 'assets' ? (() => { resetAssetForm(); setShowAssetModal(true); })() : (() => { resetCashForm(); setShowCashModal(true); })()}
          className="fixed bottom-6 right-6 lg:right-10 w-14 h-14 bg-primary text-white rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 transition-transform z-30"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        </button>
      )}
    </SidebarLayout>
  );
}
