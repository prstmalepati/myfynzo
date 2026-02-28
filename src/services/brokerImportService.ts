// =============================================================
// services/brokerImportService.ts — Import from broker depots
// =============================================================
//
// APPROACH: Two strategies depending on broker:
//
// 1. CSV/PDF Import (works TODAY — no API keys needed)
//    User downloads export from broker → uploads to myfynzo → we parse it.
//    Supported: Scalable Capital, Trade Republic, Interactive Brokers,
//               comdirect, DKB, Consorsbank, Degiro, Coinbase, Kraken
//
// 2. API Import (future — requires broker partnership or Open Banking)
//    Direct API connection via OAuth. Planned via:
//    - Tink (Visa) — PSD2 Open Banking for EU investment accounts
//    - Plaid — US/CA broker connections
//    - Broker-native APIs (IBKR, Coinbase)
//
// For now, we implement CSV import which covers 90% of use cases.

export type BrokerID = 
  | 'scalable_capital' | 'trade_republic' | 'interactive_brokers'
  | 'comdirect' | 'dkb' | 'consorsbank' | 'degiro'
  | 'coinbase' | 'kraken' | 'binance'
  | 'charles_schwab' | 'fidelity' | 'vanguard'
  | 'wealthsimple' | 'questrade'
  | 'zerodha' | 'groww' | 'kite'
  | 'generic_csv';

export interface BrokerConfig {
  id: BrokerID;
  name: string;
  country: string[];
  type: 'stocks' | 'crypto' | 'both';
  importMethod: 'csv' | 'api' | 'both';
  logo: string; // emoji for now
  csvInstructions: string;
  color: string;
}

export interface ParsedInvestment {
  name: string;
  ticker: string;
  type: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;
  currency: string;
  broker: string;
  notes: string;
}

export interface ImportResult {
  success: boolean;
  investments: ParsedInvestment[];
  errors: string[];
  warnings: string[];
  broker: string;
}

// ─── Supported Brokers ────────────────────────────────────────
export const BROKERS: BrokerConfig[] = [
  // Germany
  {
    id: 'scalable_capital', name: 'Scalable Capital', country: ['DE', 'AT'],
    type: 'both', importMethod: 'csv', logo: '🟢', color: 'bg-emerald-500',
    csvInstructions: 'Go to Scalable Capital → Portfolio → Export → Download CSV. Upload the file here.',
  },
  {
    id: 'trade_republic', name: 'Trade Republic', country: ['DE', 'AT', 'FR', 'ES', 'IT', 'NL'],
    type: 'both', importMethod: 'csv', logo: '⚫', color: 'bg-slate-900',
    csvInstructions: 'Go to Trade Republic app → Profile → Tax → Export Activity Statement (CSV). Upload the file here.',
  },
  {
    id: 'comdirect', name: 'comdirect', country: ['DE'],
    type: 'stocks', importMethod: 'csv', logo: '🟡', color: 'bg-yellow-500',
    csvInstructions: 'Log in to comdirect → Depot → Depotübersicht → Export as CSV. Upload the file here.',
  },
  {
    id: 'dkb', name: 'DKB', country: ['DE'],
    type: 'stocks', importMethod: 'csv', logo: '🔵', color: 'bg-blue-600',
    csvInstructions: 'Log in to DKB → Depot → Depotbestand → CSV Export. Upload the file here.',
  },
  {
    id: 'consorsbank', name: 'Consorsbank', country: ['DE'],
    type: 'stocks', importMethod: 'csv', logo: '🟠', color: 'bg-orange-500',
    csvInstructions: 'Log in to Consorsbank → Depot → Positionen → Export CSV. Upload the file here.',
  },

  // Europe
  {
    id: 'degiro', name: 'DEGIRO', country: ['DE', 'NL', 'FR', 'ES', 'IT', 'GB'],
    type: 'stocks', importMethod: 'csv', logo: '🔷', color: 'bg-cyan-600',
    csvInstructions: 'Go to DEGIRO → Activity → Account Statement → Export CSV. Upload the file here.',
  },
  {
    id: 'interactive_brokers', name: 'Interactive Brokers', country: ['US', 'CA', 'GB', 'DE', 'IN'],
    type: 'both', importMethod: 'csv', logo: '🔴', color: 'bg-red-600',
    csvInstructions: 'Go to IBKR → Reports → Flex Queries → Activity → Export CSV. Upload the file here.',
  },

  // US
  {
    id: 'charles_schwab', name: 'Charles Schwab', country: ['US'],
    type: 'stocks', importMethod: 'csv', logo: '🟦', color: 'bg-blue-700',
    csvInstructions: 'Go to Schwab → Accounts → Positions → Export. Upload the file here.',
  },
  {
    id: 'fidelity', name: 'Fidelity', country: ['US'],
    type: 'stocks', importMethod: 'csv', logo: '🟩', color: 'bg-green-700',
    csvInstructions: 'Go to Fidelity → Positions → Download Positions. Upload the CSV file here.',
  },
  {
    id: 'vanguard', name: 'Vanguard', country: ['US'],
    type: 'stocks', importMethod: 'csv', logo: '🟥', color: 'bg-red-700',
    csvInstructions: 'Go to Vanguard → My Accounts → Download center → Positions CSV.',
  },

  // Canada
  {
    id: 'wealthsimple', name: 'Wealthsimple', country: ['CA'],
    type: 'both', importMethod: 'csv', logo: '⬛', color: 'bg-slate-800',
    csvInstructions: 'Go to Wealthsimple → Activity → Download activity CSV. Upload the file here.',
  },
  {
    id: 'questrade', name: 'Questrade', country: ['CA'],
    type: 'stocks', importMethod: 'csv', logo: '🟢', color: 'bg-green-600',
    csvInstructions: 'Go to Questrade → Reports → Account activity → Export CSV.',
  },

  // India
  {
    id: 'zerodha', name: 'Zerodha (Kite)', country: ['IN'],
    type: 'stocks', importMethod: 'csv', logo: '🔵', color: 'bg-blue-500',
    csvInstructions: 'Go to Kite → Portfolio → Holdings → Download CSV. Upload the file here.',
  },
  {
    id: 'groww', name: 'Groww', country: ['IN'],
    type: 'both', importMethod: 'csv', logo: '🟢', color: 'bg-green-500',
    csvInstructions: 'Go to Groww app → Investments → Download statement (CSV). Upload the file here.',
  },

  // Crypto
  {
    id: 'coinbase', name: 'Coinbase', country: ['US', 'GB', 'DE', 'CA'],
    type: 'crypto', importMethod: 'csv', logo: '🔵', color: 'bg-blue-600',
    csvInstructions: 'Go to Coinbase → Taxes → Generate report → Transaction history CSV. Upload the file here.',
  },
  {
    id: 'kraken', name: 'Kraken', country: ['US', 'GB', 'DE', 'CA'],
    type: 'crypto', importMethod: 'csv', logo: '🟣', color: 'bg-purple-600',
    csvInstructions: 'Go to Kraken → History → Export → Select trades → Download CSV. Upload the file here.',
  },
  {
    id: 'binance', name: 'Binance', country: ['DE', 'IN', 'GB'],
    type: 'crypto', importMethod: 'csv', logo: '🟡', color: 'bg-yellow-500',
    csvInstructions: 'Go to Binance → Orders → Spot Order → Trade History → Export. Upload the file here.',
  },

  // Generic
  {
    id: 'generic_csv', name: 'Custom CSV', country: [],
    type: 'both', importMethod: 'csv', logo: '📄', color: 'bg-slate-500',
    csvInstructions: 'Upload any CSV with columns: Name, Ticker, Type, Quantity, Buy Price, Date, Currency.',
  },
];

// Get brokers available for a specific country
export function getBrokersForCountry(countryCode: string): BrokerConfig[] {
  return BROKERS.filter(b => 
    b.country.length === 0 || b.country.includes(countryCode)
  );
}

// ─── CSV Parsers ──────────────────────────────────────────────

// Generic CSV parser — handles most formats
function parseCSVRows(text: string): string[][] {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  return lines.map(line => {
    // Handle quoted fields
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if ((char === ',' || char === ';' || char === '\t') && !inQuotes) {
        result.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    result.push(current.trim());
    return result;
  });
}

// Find header index by trying multiple possible names
function findCol(headers: string[], ...names: string[]): number {
  const lower = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const name of names) {
    const idx = lower.findIndex(h => h.includes(name.toLowerCase().replace(/[^a-z0-9]/g, '')));
    if (idx >= 0) return idx;
  }
  return -1;
}

// Scalable Capital CSV parser
function parseScalableCapital(text: string): ImportResult {
  const rows = parseCSVRows(text);
  if (rows.length < 2) return { success: false, investments: [], errors: ['File is empty or has no data rows.'], warnings: [], broker: 'Scalable Capital' };
  
  const headers = rows[0];
  const nameIdx = findCol(headers, 'instrument', 'name', 'wertpapier', 'asset');
  const isinIdx = findCol(headers, 'isin', 'ticker', 'symbol');
  const qtyIdx = findCol(headers, 'quantity', 'stück', 'stueck', 'anzahl', 'shares');
  const priceIdx = findCol(headers, 'price', 'kurs', 'avgprice', 'averageprice', 'kaufkurs');
  const valueIdx = findCol(headers, 'value', 'wert', 'marketvalue', 'marktwert');
  const dateIdx = findCol(headers, 'date', 'datum', 'kaufdatum', 'purchasedate');
  
  const investments: ParsedInvestment[] = [];
  const errors: string[] = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;
    try {
      const name = nameIdx >= 0 ? row[nameIdx] : row[0];
      const ticker = isinIdx >= 0 ? row[isinIdx] : '';
      const qty = parseFloat((qtyIdx >= 0 ? row[qtyIdx] : row[2] || '0').replace(',', '.'));
      let price = parseFloat((priceIdx >= 0 ? row[priceIdx] : row[3] || '0').replace(',', '.'));
      
      if (!name || isNaN(qty) || qty <= 0) continue;
      if (isNaN(price) && valueIdx >= 0) {
        const val = parseFloat(row[valueIdx].replace(',', '.'));
        price = val / qty;
      }
      
      investments.push({
        name, ticker, type: 'Stocks / ETFs', quantity: qty,
        purchasePrice: price || 0, currentPrice: price || 0,
        purchaseDate: dateIdx >= 0 ? row[dateIdx] : new Date().toISOString().split('T')[0],
        currency: 'EUR', broker: 'Scalable Capital', notes: `Imported from Scalable Capital`,
      });
    } catch (e) {
      errors.push(`Row ${i + 1}: Could not parse — ${(e as Error).message}`);
    }
  }
  
  return { success: investments.length > 0, investments, errors, warnings: [], broker: 'Scalable Capital' };
}

// Generic broker parser — works for most CSV formats
function parseGenericCSV(text: string, brokerName: string): ImportResult {
  const rows = parseCSVRows(text);
  if (rows.length < 2) return { success: false, investments: [], errors: ['File appears empty.'], warnings: [], broker: brokerName };
  
  const headers = rows[0];
  const nameIdx = findCol(headers, 'name', 'instrument', 'asset', 'symbol', 'ticker', 'wertpapier', 'description', 'holding');
  const tickerIdx = findCol(headers, 'ticker', 'symbol', 'isin', 'code');
  const qtyIdx = findCol(headers, 'quantity', 'qty', 'shares', 'units', 'stück', 'stueck', 'anzahl', 'amount');
  const priceIdx = findCol(headers, 'price', 'buyprice', 'avgprice', 'cost', 'kurs', 'kaufkurs', 'averagecost', 'avgcostpershare');
  const currentIdx = findCol(headers, 'current', 'currentprice', 'marketprice', 'lastprice', 'ltp');
  const dateIdx = findCol(headers, 'date', 'purchasedate', 'tradedate', 'datum', 'transactiondate');
  const currIdx = findCol(headers, 'currency', 'ccy', 'curr', 'währung');
  const typeIdx = findCol(headers, 'type', 'assettype', 'category', 'assetclass', 'instrumenttype');
  
  if (nameIdx < 0 && tickerIdx < 0) {
    return { success: false, investments: [], errors: ['Could not identify name/ticker column. Please ensure your CSV has a "Name", "Instrument", or "Symbol" column.'], warnings: [], broker: brokerName };
  }
  
  const investments: ParsedInvestment[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2 || row.every(c => !c)) continue;
    try {
      const name = nameIdx >= 0 ? row[nameIdx] : (tickerIdx >= 0 ? row[tickerIdx] : '');
      const ticker = tickerIdx >= 0 ? row[tickerIdx] : '';
      const qtyStr = qtyIdx >= 0 ? row[qtyIdx] : '';
      const qty = parseFloat(qtyStr.replace(/[^0-9.,\-]/g, '').replace(',', '.')) || 0;
      const priceStr = priceIdx >= 0 ? row[priceIdx] : '';
      const price = parseFloat(priceStr.replace(/[^0-9.,\-]/g, '').replace(',', '.')) || 0;
      const currentStr = currentIdx >= 0 ? row[currentIdx] : '';
      const current = parseFloat(currentStr.replace(/[^0-9.,\-]/g, '').replace(',', '.')) || price;
      const date = dateIdx >= 0 ? row[dateIdx] : new Date().toISOString().split('T')[0];
      const curr = currIdx >= 0 ? row[currIdx]?.toUpperCase() : 'EUR';
      const type = typeIdx >= 0 ? row[typeIdx] : 'Stocks / ETFs';
      
      if (!name && !ticker) continue;
      if (qty <= 0) { warnings.push(`Row ${i + 1}: "${name}" has zero or negative quantity, skipped.`); continue; }
      
      investments.push({
        name: name || ticker, ticker, type,
        quantity: qty, purchasePrice: price, currentPrice: current,
        purchaseDate: date, currency: curr || 'EUR',
        broker: brokerName, notes: `Imported from ${brokerName}`,
      });
    } catch (e) {
      errors.push(`Row ${i + 1}: Parse error.`);
    }
  }
  
  return { success: investments.length > 0, investments, errors, warnings, broker: brokerName };
}

// ─── Main Import Function ─────────────────────────────────────
export async function importFromCSV(file: File, brokerId: BrokerID): Promise<ImportResult> {
  const text = await file.text();
  
  switch (brokerId) {
    case 'scalable_capital':
      return parseScalableCapital(text);
    case 'trade_republic':
    case 'comdirect':
    case 'dkb':
    case 'consorsbank':
    case 'degiro':
    case 'interactive_brokers':
    case 'coinbase':
    case 'kraken':
    case 'binance':
    case 'charles_schwab':
    case 'fidelity':
    case 'vanguard':
    case 'wealthsimple':
    case 'questrade':
    case 'zerodha':
    case 'groww':
    case 'generic_csv':
    default:
      return parseGenericCSV(text, BROKERS.find(b => b.id === brokerId)?.name || 'CSV Import');
  }
}
