/**
 * SmartDateInput.tsx — Enhanced date input with day → month → year flow
 * User can type day and month/year auto-fills, or use native date picker.
 * Shows formatted display like "15 Mar 2025".
 */
import { useState, useRef, useEffect } from 'react';

interface SmartDateInputProps {
  value: string; // ISO: YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
  className?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  compact?: boolean;
}

export default function SmartDateInput({
  value, onChange, label, className = '', min, max, placeholder, compact = false,
}: SmartDateInputProps) {
  const [mode, setMode] = useState<'display' | 'edit'>('display');
  const [dayVal, setDayVal] = useState('');
  const [monthVal, setMonthVal] = useState('');
  const [yearVal, setYearVal] = useState('');
  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  // Sync from value prop
  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split('-');
      setYearVal(y || '');
      setMonthVal(m || '');
      setDayVal(d || '');
    }
  }, [value]);

  const emitDate = (d: string, m: string, y: string) => {
    if (d && m && y && y.length === 4) {
      const dd = d.padStart(2, '0');
      const mm = m.padStart(2, '0');
      const iso = `${y}-${mm}-${dd}`;
      // Validate
      const date = new Date(iso);
      if (!isNaN(date.getTime())) {
        onChange(iso);
      }
    }
  };

  const handleDayChange = (v: string) => {
    const num = v.replace(/\D/g, '').slice(0, 2);
    setDayVal(num);
    if (num.length === 2 || (num.length === 1 && parseInt(num) > 3)) {
      // Auto-advance to month
      monthRef.current?.focus();
      monthRef.current?.select();
    }
    if (monthVal && yearVal) emitDate(num, monthVal, yearVal);
  };

  const handleMonthChange = (v: string) => {
    const num = v.replace(/\D/g, '').slice(0, 2);
    setMonthVal(num);
    if (num.length === 2 || (num.length === 1 && parseInt(num) > 1)) {
      yearRef.current?.focus();
      yearRef.current?.select();
    }
    if (dayVal && yearVal) emitDate(dayVal, num, yearVal);
  };

  const handleYearChange = (v: string) => {
    const num = v.replace(/\D/g, '').slice(0, 4);
    setYearVal(num);
    if (dayVal && monthVal && num.length === 4) emitDate(dayVal, monthVal, num);
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: 'day' | 'month' | 'year') => {
    if (e.key === 'Backspace') {
      if (field === 'month' && !monthVal) {
        dayRef.current?.focus();
      } else if (field === 'year' && !yearVal) {
        monthRef.current?.focus();
      }
    }
    if (e.key === '/' || e.key === '-' || e.key === '.') {
      e.preventDefault();
      if (field === 'day') monthRef.current?.focus();
      if (field === 'month') yearRef.current?.focus();
    }
  };

  const formatDisplay = () => {
    if (!value) return '';
    try {
      const date = new Date(value + 'T00:00:00');
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return value; }
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setMode('display');
  };

  // Auto-fill month/year to current if user enters a day
  const handleDayBlur = () => {
    if (dayVal && !monthVal) {
      const now = new Date();
      setMonthVal(String(now.getMonth() + 1).padStart(2, '0'));
      if (!yearVal) setYearVal(String(now.getFullYear()));
      emitDate(dayVal, String(now.getMonth() + 1).padStart(2, '0'), yearVal || String(now.getFullYear()));
    }
  };

  const handleMonthBlur = () => {
    if (dayVal && monthVal && !yearVal) {
      const y = String(new Date().getFullYear());
      setYearVal(y);
      emitDate(dayVal, monthVal, y);
    }
  };

  const inputBase = `bg-transparent text-center font-semibold text-secondary focus:outline-none ${compact ? 'text-sm' : ''}`;
  const py = compact ? 'py-2' : 'py-3';

  return (
    <div className={className}>
      {label && <label className={`block font-medium text-slate-700 mb-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>{label}</label>}

      <div className="relative">
        {/* Segmented date input */}
        <div className="flex items-center gap-0 border border-slate-200 rounded-xl bg-white overflow-hidden focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          <input
            ref={dayRef}
            type="text"
            inputMode="numeric"
            placeholder="DD"
            value={dayVal}
            onChange={e => handleDayChange(e.target.value)}
            onKeyDown={e => handleKeyDown(e, 'day')}
            onBlur={handleDayBlur}
            className={`${inputBase} ${compact ? 'w-9' : 'w-12'} ${py} pl-3 pr-0`}
            maxLength={2}
          />
          <span className="text-slate-300 font-light text-sm">/</span>
          <input
            ref={monthRef}
            type="text"
            inputMode="numeric"
            placeholder="MM"
            value={monthVal}
            onChange={e => handleMonthChange(e.target.value)}
            onKeyDown={e => handleKeyDown(e, 'month')}
            onBlur={handleMonthBlur}
            className={`${inputBase} ${compact ? 'w-9' : 'w-12'} ${py}`}
            maxLength={2}
          />
          <span className="text-slate-300 font-light text-sm">/</span>
          <input
            ref={yearRef}
            type="text"
            inputMode="numeric"
            placeholder="YYYY"
            value={yearVal}
            onChange={e => handleYearChange(e.target.value)}
            onKeyDown={e => handleKeyDown(e, 'year')}
            className={`${inputBase} ${compact ? 'w-12' : 'w-16'} ${py} pr-0`}
            maxLength={4}
          />

          {/* Calendar fallback */}
          <button
            type="button"
            onClick={() => dateRef.current?.showPicker?.()}
            className={`ml-auto px-2 ${py} text-slate-400 hover:text-primary transition-colors`}
            title="Open calendar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </button>

          {/* Hidden native input for calendar picker */}
          <input
            ref={dateRef}
            type="date"
            value={value}
            onChange={handleNativeChange}
            min={min}
            max={max}
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            tabIndex={-1}
          />
        </div>

        {/* Formatted display below */}
        {value && (
          <div className="text-[10px] text-slate-400 mt-1 pl-1">{formatDisplay()}</div>
        )}
      </div>
    </div>
  );
}
