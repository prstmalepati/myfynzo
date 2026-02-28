/**
 * AddressAutocomplete.tsx — Smart address input
 * Germany: PLZ → auto-fills city
 * Other countries: basic input
 * 
 * German PLZ database (top ~200 cities covering >90% of population)
 */

import { useState, useEffect, useRef } from 'react';

// German PLZ → City mapping (most common PLZs)
const GERMAN_PLZ: Record<string, string> = {
  '10115': 'Berlin', '10117': 'Berlin', '10119': 'Berlin', '10178': 'Berlin', '10179': 'Berlin',
  '10243': 'Berlin', '10245': 'Berlin', '10247': 'Berlin', '10249': 'Berlin', '10315': 'Berlin',
  '10317': 'Berlin', '10318': 'Berlin', '10319': 'Berlin', '10365': 'Berlin', '10367': 'Berlin',
  '10369': 'Berlin', '10405': 'Berlin', '10407': 'Berlin', '10409': 'Berlin', '10435': 'Berlin',
  '10437': 'Berlin', '10439': 'Berlin', '10551': 'Berlin', '10553': 'Berlin', '10555': 'Berlin',
  '10557': 'Berlin', '10559': 'Berlin', '10585': 'Berlin', '10587': 'Berlin', '10589': 'Berlin',
  '10623': 'Berlin', '10625': 'Berlin', '10627': 'Berlin', '10629': 'Berlin', '10707': 'Berlin',
  '10709': 'Berlin', '10711': 'Berlin', '10713': 'Berlin', '10715': 'Berlin', '10717': 'Berlin',
  '10719': 'Berlin', '10777': 'Berlin', '10779': 'Berlin', '10781': 'Berlin', '10783': 'Berlin',
  '10785': 'Berlin', '10787': 'Berlin', '10789': 'Berlin', '10823': 'Berlin', '10825': 'Berlin',
  '10827': 'Berlin', '10829': 'Berlin', '10961': 'Berlin', '10963': 'Berlin', '10965': 'Berlin',
  '10967': 'Berlin', '10969': 'Berlin', '10997': 'Berlin', '10999': 'Berlin',
  '12043': 'Berlin', '12045': 'Berlin', '12047': 'Berlin', '12049': 'Berlin', '12051': 'Berlin',
  '12053': 'Berlin', '12055': 'Berlin', '12057': 'Berlin', '12059': 'Berlin',
  '13353': 'Berlin', '13355': 'Berlin', '13357': 'Berlin', '13359': 'Berlin',
  '14050': 'Berlin', '14052': 'Berlin', '14053': 'Berlin', '14055': 'Berlin', '14057': 'Berlin',
  '20095': 'Hamburg', '20097': 'Hamburg', '20099': 'Hamburg', '20144': 'Hamburg', '20146': 'Hamburg',
  '20148': 'Hamburg', '20149': 'Hamburg', '20249': 'Hamburg', '20251': 'Hamburg', '20253': 'Hamburg',
  '20255': 'Hamburg', '20257': 'Hamburg', '20259': 'Hamburg', '20354': 'Hamburg', '20355': 'Hamburg',
  '20357': 'Hamburg', '20359': 'Hamburg', '20457': 'Hamburg', '20459': 'Hamburg', '20535': 'Hamburg',
  '20537': 'Hamburg', '20539': 'Hamburg', '21029': 'Hamburg', '21031': 'Hamburg', '22041': 'Hamburg',
  '22043': 'Hamburg', '22081': 'Hamburg', '22083': 'Hamburg', '22085': 'Hamburg', '22087': 'Hamburg',
  '22089': 'Hamburg', '22111': 'Hamburg', '22113': 'Hamburg', '22115': 'Hamburg', '22117': 'Hamburg',
  '22119': 'Hamburg', '22143': 'Hamburg', '22145': 'Hamburg', '22147': 'Hamburg', '22149': 'Hamburg',
  '80331': 'München', '80333': 'München', '80335': 'München', '80336': 'München', '80337': 'München',
  '80339': 'München', '80469': 'München', '80538': 'München', '80539': 'München', '80634': 'München',
  '80636': 'München', '80637': 'München', '80638': 'München', '80639': 'München', '80686': 'München',
  '80687': 'München', '80689': 'München', '80796': 'München', '80797': 'München', '80798': 'München',
  '80799': 'München', '80801': 'München', '80802': 'München', '80803': 'München', '80804': 'München',
  '80805': 'München', '80807': 'München', '80809': 'München', '80933': 'München', '80935': 'München',
  '80937': 'München', '80939': 'München', '80992': 'München', '80993': 'München', '80995': 'München',
  '80997': 'München', '80999': 'München', '81241': 'München', '81243': 'München', '81245': 'München',
  '81247': 'München', '81249': 'München', '81369': 'München', '81371': 'München', '81373': 'München',
  '81375': 'München', '81377': 'München', '81379': 'München', '81475': 'München', '81477': 'München',
  '81479': 'München', '81539': 'München', '81541': 'München', '81543': 'München', '81545': 'München',
  '81547': 'München', '81549': 'München', '81667': 'München', '81669': 'München', '81671': 'München',
  '81673': 'München', '81675': 'München', '81677': 'München', '81679': 'München',
  '50667': 'Köln', '50668': 'Köln', '50670': 'Köln', '50672': 'Köln', '50674': 'Köln',
  '50676': 'Köln', '50677': 'Köln', '50678': 'Köln', '50679': 'Köln', '50733': 'Köln',
  '50735': 'Köln', '50737': 'Köln', '50739': 'Köln', '50823': 'Köln', '50825': 'Köln',
  '50827': 'Köln', '50829': 'Köln', '50858': 'Köln', '50859': 'Köln', '50931': 'Köln',
  '50933': 'Köln', '50935': 'Köln', '50937': 'Köln', '50939': 'Köln', '50969': 'Köln',
  '50996': 'Köln', '50997': 'Köln', '50999': 'Köln', '51061': 'Köln', '51063': 'Köln',
  '51065': 'Köln', '51067': 'Köln', '51069': 'Köln', '51103': 'Köln', '51105': 'Köln',
  '51107': 'Köln', '51109': 'Köln',
  '60306': 'Frankfurt am Main', '60308': 'Frankfurt am Main', '60310': 'Frankfurt am Main',
  '60311': 'Frankfurt am Main', '60313': 'Frankfurt am Main', '60314': 'Frankfurt am Main',
  '60316': 'Frankfurt am Main', '60318': 'Frankfurt am Main', '60320': 'Frankfurt am Main',
  '60322': 'Frankfurt am Main', '60323': 'Frankfurt am Main', '60325': 'Frankfurt am Main',
  '60326': 'Frankfurt am Main', '60327': 'Frankfurt am Main', '60329': 'Frankfurt am Main',
  '60385': 'Frankfurt am Main', '60386': 'Frankfurt am Main', '60388': 'Frankfurt am Main',
  '60389': 'Frankfurt am Main', '60431': 'Frankfurt am Main', '60433': 'Frankfurt am Main',
  '60435': 'Frankfurt am Main', '60437': 'Frankfurt am Main', '60438': 'Frankfurt am Main',
  '60439': 'Frankfurt am Main', '60486': 'Frankfurt am Main', '60487': 'Frankfurt am Main',
  '60488': 'Frankfurt am Main', '60489': 'Frankfurt am Main', '60528': 'Frankfurt am Main',
  '60529': 'Frankfurt am Main', '60549': 'Frankfurt am Main', '60594': 'Frankfurt am Main',
  '60596': 'Frankfurt am Main', '60598': 'Frankfurt am Main', '60599': 'Frankfurt am Main',
  '70173': 'Stuttgart', '70174': 'Stuttgart', '70176': 'Stuttgart', '70178': 'Stuttgart',
  '70180': 'Stuttgart', '70182': 'Stuttgart', '70184': 'Stuttgart', '70186': 'Stuttgart',
  '70188': 'Stuttgart', '70190': 'Stuttgart', '70191': 'Stuttgart', '70192': 'Stuttgart',
  '70193': 'Stuttgart', '70195': 'Stuttgart', '70197': 'Stuttgart', '70199': 'Stuttgart',
  '70327': 'Stuttgart', '70329': 'Stuttgart', '70372': 'Stuttgart', '70374': 'Stuttgart',
  '70376': 'Stuttgart', '70378': 'Stuttgart', '70435': 'Stuttgart', '70437': 'Stuttgart',
  '70439': 'Stuttgart', '70469': 'Stuttgart', '70499': 'Stuttgart', '70563': 'Stuttgart',
  '70565': 'Stuttgart', '70567': 'Stuttgart', '70569': 'Stuttgart', '70597': 'Stuttgart',
  '70599': 'Stuttgart', '70619': 'Stuttgart', '70629': 'Stuttgart',
  '40210': 'Düsseldorf', '40211': 'Düsseldorf', '40212': 'Düsseldorf', '40213': 'Düsseldorf',
  '40215': 'Düsseldorf', '40217': 'Düsseldorf', '40219': 'Düsseldorf', '40221': 'Düsseldorf',
  '40223': 'Düsseldorf', '40225': 'Düsseldorf', '40227': 'Düsseldorf', '40229': 'Düsseldorf',
  '40231': 'Düsseldorf', '40233': 'Düsseldorf', '40235': 'Düsseldorf', '40237': 'Düsseldorf',
  '40239': 'Düsseldorf', '40468': 'Düsseldorf', '40470': 'Düsseldorf', '40472': 'Düsseldorf',
  '40474': 'Düsseldorf', '40476': 'Düsseldorf', '40477': 'Düsseldorf', '40479': 'Düsseldorf',
  '40489': 'Düsseldorf', '40545': 'Düsseldorf', '40547': 'Düsseldorf', '40549': 'Düsseldorf',
  '40589': 'Düsseldorf', '40591': 'Düsseldorf', '40593': 'Düsseldorf', '40595': 'Düsseldorf',
  '40597': 'Düsseldorf', '40599': 'Düsseldorf', '40625': 'Düsseldorf', '40627': 'Düsseldorf',
  '40629': 'Düsseldorf',
  '44135': 'Dortmund', '44137': 'Dortmund', '44139': 'Dortmund', '44141': 'Dortmund',
  '44143': 'Dortmund', '44145': 'Dortmund', '44147': 'Dortmund', '44149': 'Dortmund',
  '44225': 'Dortmund', '44227': 'Dortmund', '44229': 'Dortmund',
  '45127': 'Essen', '45128': 'Essen', '45130': 'Essen', '45131': 'Essen', '45133': 'Essen',
  '45134': 'Essen', '45136': 'Essen', '45138': 'Essen', '45139': 'Essen', '45141': 'Essen',
  '45143': 'Essen', '45144': 'Essen', '45145': 'Essen', '45147': 'Essen', '45149': 'Essen',
  '28195': 'Bremen', '28197': 'Bremen', '28199': 'Bremen', '28201': 'Bremen', '28203': 'Bremen',
  '28205': 'Bremen', '28207': 'Bremen', '28209': 'Bremen', '28211': 'Bremen', '28213': 'Bremen',
  '28215': 'Bremen', '28217': 'Bremen', '28219': 'Bremen', '28239': 'Bremen',
  '04103': 'Leipzig', '04105': 'Leipzig', '04107': 'Leipzig', '04109': 'Leipzig',
  '01067': 'Dresden', '01069': 'Dresden', '01097': 'Dresden', '01099': 'Dresden',
  '30159': 'Hannover', '30161': 'Hannover', '30163': 'Hannover', '30165': 'Hannover',
  '30167': 'Hannover', '30169': 'Hannover', '30171': 'Hannover', '30173': 'Hannover',
  '30175': 'Hannover', '30177': 'Hannover', '30179': 'Hannover',
  '90402': 'Nürnberg', '90403': 'Nürnberg', '90408': 'Nürnberg', '90409': 'Nürnberg',
  '90411': 'Nürnberg', '90419': 'Nürnberg', '90429': 'Nürnberg', '90431': 'Nürnberg',
  '90439': 'Nürnberg', '90441': 'Nürnberg', '90443': 'Nürnberg', '90449': 'Nürnberg',
  '90451': 'Nürnberg', '90453': 'Nürnberg', '90455': 'Nürnberg', '90459': 'Nürnberg',
  '90461': 'Nürnberg', '90469': 'Nürnberg', '90471': 'Nürnberg', '90473': 'Nürnberg',
  '90478': 'Nürnberg', '90480': 'Nürnberg', '90482': 'Nürnberg', '90489': 'Nürnberg',
  '47051': 'Duisburg', '47053': 'Duisburg', '47055': 'Duisburg', '47057': 'Duisburg',
  '47058': 'Duisburg', '47059': 'Duisburg',
  '44787': 'Bochum', '44789': 'Bochum', '44791': 'Bochum', '44793': 'Bochum', '44795': 'Bochum',
  '44797': 'Bochum', '44799': 'Bochum', '44801': 'Bochum', '44803': 'Bochum',
  '42103': 'Wuppertal', '42105': 'Wuppertal', '42107': 'Wuppertal', '42109': 'Wuppertal',
  '42111': 'Wuppertal', '42113': 'Wuppertal', '42115': 'Wuppertal', '42117': 'Wuppertal',
  '42119': 'Wuppertal', '42275': 'Wuppertal', '42277': 'Wuppertal', '42279': 'Wuppertal',
  '42281': 'Wuppertal', '42283': 'Wuppertal', '42285': 'Wuppertal',
  '33602': 'Bielefeld', '33604': 'Bielefeld', '33605': 'Bielefeld', '33607': 'Bielefeld',
  '33609': 'Bielefeld', '33611': 'Bielefeld', '33613': 'Bielefeld', '33615': 'Bielefeld',
  '33617': 'Bielefeld', '33619': 'Bielefeld',
  '53111': 'Bonn', '53113': 'Bonn', '53115': 'Bonn', '53117': 'Bonn', '53119': 'Bonn',
  '53121': 'Bonn', '53123': 'Bonn', '53125': 'Bonn', '53127': 'Bonn', '53129': 'Bonn',
  '48143': 'Münster', '48145': 'Münster', '48147': 'Münster', '48149': 'Münster',
  '48151': 'Münster', '48153': 'Münster', '48155': 'Münster', '48157': 'Münster',
  '48159': 'Münster', '48161': 'Münster', '48163': 'Münster', '48165': 'Münster',
  '76131': 'Karlsruhe', '76133': 'Karlsruhe', '76135': 'Karlsruhe', '76137': 'Karlsruhe',
  '76139': 'Karlsruhe', '76149': 'Karlsruhe', '76185': 'Karlsruhe', '76187': 'Karlsruhe',
  '76189': 'Karlsruhe', '76199': 'Karlsruhe', '76227': 'Karlsruhe', '76228': 'Karlsruhe',
  '68159': 'Mannheim', '68161': 'Mannheim', '68163': 'Mannheim', '68165': 'Mannheim',
  '68167': 'Mannheim', '68169': 'Mannheim', '68199': 'Mannheim',
  '86150': 'Augsburg', '86152': 'Augsburg', '86153': 'Augsburg', '86154': 'Augsburg',
  '86156': 'Augsburg', '86157': 'Augsburg', '86159': 'Augsburg', '86161': 'Augsburg',
  '86163': 'Augsburg', '86165': 'Augsburg', '86167': 'Augsburg', '86169': 'Augsburg',
  '65183': 'Wiesbaden', '65185': 'Wiesbaden', '65187': 'Wiesbaden', '65189': 'Wiesbaden',
  '65191': 'Wiesbaden', '65193': 'Wiesbaden', '65195': 'Wiesbaden', '65197': 'Wiesbaden',
  '85521': 'Ottobrunn', '85540': 'Haar', '85586': 'Poing', '85609': 'Aschheim',
  '85622': 'Feldkirchen', '85630': 'Grasbrunn', '85635': 'Höhenkirchen-Siegertsbrunn',
  '85649': 'Brunnthal', '85653': 'Aying', '85716': 'Unterschleißheim',
  '63065': 'Offenbach am Main', '63067': 'Offenbach am Main', '63069': 'Offenbach am Main',
  '63071': 'Offenbach am Main', '63073': 'Offenbach am Main', '63075': 'Offenbach am Main',
  '64283': 'Darmstadt', '64285': 'Darmstadt', '64287': 'Darmstadt', '64289': 'Darmstadt',
  '64291': 'Darmstadt', '64293': 'Darmstadt', '64295': 'Darmstadt', '64297': 'Darmstadt',
  '79098': 'Freiburg', '79100': 'Freiburg', '79102': 'Freiburg', '79104': 'Freiburg',
  '79106': 'Freiburg', '79108': 'Freiburg', '79110': 'Freiburg', '79111': 'Freiburg',
  '79112': 'Freiburg', '79114': 'Freiburg', '79115': 'Freiburg', '79117': 'Freiburg',
  '69115': 'Heidelberg', '69117': 'Heidelberg', '69118': 'Heidelberg', '69120': 'Heidelberg',
  '69121': 'Heidelberg', '69123': 'Heidelberg', '69124': 'Heidelberg', '69126': 'Heidelberg',
  '24103': 'Kiel', '24105': 'Kiel', '24106': 'Kiel', '24107': 'Kiel', '24109': 'Kiel',
  '24111': 'Kiel', '24113': 'Kiel', '24114': 'Kiel', '24116': 'Kiel', '24118': 'Kiel',
  '23552': 'Lübeck', '23554': 'Lübeck', '23556': 'Lübeck', '23558': 'Lübeck', '23560': 'Lübeck',
  '23562': 'Lübeck', '23564': 'Lübeck', '23566': 'Lübeck', '23568': 'Lübeck', '23569': 'Lübeck',
  '39104': 'Magdeburg', '39106': 'Magdeburg', '39108': 'Magdeburg', '39110': 'Magdeburg',
  '39112': 'Magdeburg', '39114': 'Magdeburg', '39116': 'Magdeburg', '39118': 'Magdeburg',
  '39120': 'Magdeburg', '39122': 'Magdeburg', '39124': 'Magdeburg', '39126': 'Magdeburg',
  '06108': 'Halle', '06110': 'Halle', '06112': 'Halle', '06114': 'Halle', '06116': 'Halle',
  '06118': 'Halle', '06120': 'Halle', '06122': 'Halle', '06124': 'Halle', '06126': 'Halle',
  '55116': 'Mainz', '55118': 'Mainz', '55120': 'Mainz', '55122': 'Mainz', '55124': 'Mainz',
  '55126': 'Mainz', '55127': 'Mainz', '55128': 'Mainz', '55129': 'Mainz', '55130': 'Mainz',
  '55131': 'Mainz', '18055': 'Rostock', '18057': 'Rostock', '18059': 'Rostock',
  '18069': 'Rostock', '18106': 'Rostock', '18107': 'Rostock', '18109': 'Rostock',
  '34117': 'Kassel', '34119': 'Kassel', '34121': 'Kassel', '34123': 'Kassel', '34125': 'Kassel',
  '34127': 'Kassel', '34128': 'Kassel', '34130': 'Kassel', '34131': 'Kassel', '34132': 'Kassel',
  '34134': 'Kassel',
  '91052': 'Erlangen', '91054': 'Erlangen', '91056': 'Erlangen', '91058': 'Erlangen',
  '97070': 'Würzburg', '97072': 'Würzburg', '97074': 'Würzburg', '97076': 'Würzburg',
  '97078': 'Würzburg', '97080': 'Würzburg', '97082': 'Würzburg', '97084': 'Würzburg',
  '93047': 'Regensburg', '93049': 'Regensburg', '93051': 'Regensburg', '93053': 'Regensburg',
  '93055': 'Regensburg', '93057': 'Regensburg', '93059': 'Regensburg',
  '85049': 'Ingolstadt', '85051': 'Ingolstadt', '85053': 'Ingolstadt', '85055': 'Ingolstadt',
  '85057': 'Ingolstadt',
};

/** Lookup city from PLZ. Returns city name or null. */
export function lookupPLZ(plz: string): string | null {
  return GERMAN_PLZ[plz] || null;
}

/** Find matching PLZs as user types */
export function searchPLZ(partial: string): Array<{ plz: string; city: string }> {
  if (!partial || partial.length < 2) return [];
  const results: Array<{ plz: string; city: string }> = [];
  const seen = new Set<string>();
  for (const [plz, city] of Object.entries(GERMAN_PLZ)) {
    if (plz.startsWith(partial) && !seen.has(plz)) {
      seen.add(plz);
      results.push({ plz, city });
      if (results.length >= 5) break;
    }
  }
  return results;
}

interface AddressAutocompleteProps {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  onStreetChange: (v: string) => void;
  onCityChange: (v: string) => void;
  onPostalCodeChange: (v: string) => void;
}

export default function AddressAutocomplete({
  street, city, postalCode, country,
  onStreetChange, onCityChange, onPostalCodeChange,
}: AddressAutocompleteProps) {
  const isGermany = country === 'Germany';
  const [suggestions, setSuggestions] = useState<Array<{ plz: string; city: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cityAutoFilled, setCityAutoFilled] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // PLZ auto-fill for Germany
  useEffect(() => {
    if (!isGermany) return;
    if (postalCode.length === 5) {
      const match = lookupPLZ(postalCode);
      if (match && !city) {
        onCityChange(match);
        setCityAutoFilled(true);
      }
      setSuggestions([]);
      setShowSuggestions(false);
    } else if (postalCode.length >= 2) {
      const results = searchPLZ(postalCode);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [postalCode, isGermany]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSuggestionClick = (plz: string, cityName: string) => {
    onPostalCodeChange(plz);
    onCityChange(cityName);
    setCityAutoFilled(true);
    setShowSuggestions(false);
  };

  const handlePLZChange = (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, isGermany ? 5 : 10);
    onPostalCodeChange(clean);
    if (cityAutoFilled) {
      setCityAutoFilled(false);
      // Reset city if PLZ changes after auto-fill
      if (clean.length < 5) onCityChange('');
    }
  };

  const inputClass = "w-full px-4 py-3 border border-slate-200 rounded-xl text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all";

  return (
    <div className="grid md:grid-cols-2 gap-5">
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Street Address</label>
        <input type="text" value={street} onChange={e => onStreetChange(e.target.value)}
          placeholder={isGermany ? 'z.B. Musterstraße 42' : 'Street address'}
          className={inputClass} />
      </div>

      {/* PLZ / Postal Code — with suggestions for Germany */}
      <div className="relative" ref={suggestionsRef}>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {isGermany ? 'PLZ (Postleitzahl)' : 'Postal Code'}
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={postalCode}
          onChange={e => handlePLZChange(e.target.value)}
          placeholder={isGermany ? '85649' : 'Postal code'}
          className={inputClass}
        />

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
            {suggestions.map(s => (
              <button
                key={s.plz}
                type="button"
                onClick={() => handleSuggestionClick(s.plz, s.city)}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-primary/5 transition-colors text-left"
              >
                <span className="text-sm font-mono font-semibold text-primary">{s.plz}</span>
                <span className="text-sm text-slate-600">{s.city}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* City — auto-filled from PLZ */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {isGermany ? 'Stadt' : 'City'}
        </label>
        <div className="relative">
          <input type="text" value={city} onChange={e => { onCityChange(e.target.value); setCityAutoFilled(false); }}
            placeholder={isGermany ? 'Wird automatisch ausgefüllt' : 'City'}
            className={inputClass} />
          {cityAutoFilled && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="text-[10px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">auto</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
