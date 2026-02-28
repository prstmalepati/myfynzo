import { useState } from "react"
import { calculateProjection } from "../../calculations/projection"

interface ProjectionInput {
  years: number;
  isCouple: boolean;
  age1: number;
  age2?: number;
  income1: number;
  income2?: number;
  bonusIncome?: number;
  otherIncome?: number;
  initialInvestment: number;
  monthlyInvestment: number;
  investmentReturn: number;
  incomeGrowth?: number;
  monthlyExpenses: number;
  expenseGrowth: number;
  currentDebt?: number;
  monthlyDebtPayment?: number;
}

type Props = {
  onCalculate: (result: any) => void
}

export default function ProjectionInputs({ onCalculate }: Props) {
  const [isCouple, setIsCouple] = useState(false)

  const [form, setForm] = useState<ProjectionInput>({
    years: 20,
    isCouple: false,

    age1: 30,
    age2: 30,

    income1: 60000,
    income2: 50000,

    bonusIncome: undefined,
    otherIncome: undefined,

    initialInvestment: 20000,
    monthlyInvestment: 1000,
    investmentReturn: 0.06,

    monthlyExpenses: 2500,
    expenseGrowth: 0.02,

    currentDebt: undefined,
    monthlyDebtPayment: undefined,
  })

  function update<K extends keyof ProjectionInput>(key: K, value: ProjectionInput[K]) {
    setForm((prev: ProjectionInput) => ({ ...prev, [key]: value }))
  }

  function handleCalculate() {
    const result = calculateProjection({
      ...form,
      isCouple,
      bonusIncome: form.bonusIncome || 0,
      otherIncome: form.otherIncome || 0,
      currentDebt: form.currentDebt || 0,
      monthlyDebtPayment: form.monthlyDebtPayment || 0,
    })
    onCalculate(result)
  }

  return (
    <div className="space-y-8">

      {/* Mode Toggle */}
      <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-xl border border-slate-200">
        <label className="text-sm font-semibold text-slate-700 mb-3 block">Planning Mode</label>
        <div className="flex gap-3">
          <button
            onClick={() => setIsCouple(false)}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
              !isCouple 
                ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <span className="text-lg">👤</span> Individual
          </button>
          <button
            onClick={() => setIsCouple(true)}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
              isCouple 
                ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <span className="text-lg">👥</span> Couple
          </button>
        </div>
      </div>

      {/* Profile Section */}
      <FormSection 
        title="📋 Profile" 
        description="Your current age and planning timeline"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Your Age"
            value={form.age1}
            onChange={v => update("age1", v)}
            icon="🎂"
          />
          {isCouple && (
            <Input
              label="Partner Age"
              value={form.age2 || 30}
              onChange={v => update("age2", v)}
              icon="🎂"
            />
          )}
          <Input
            label="Years to Project"
            value={form.years}
            onChange={v => update("years", v)}
            icon="📅"
            className={isCouple ? "" : "col-span-2"}
          />
        </div>
      </FormSection>

      {/* Income Section */}
      <FormSection 
        title="💰 Annual Income" 
        description="Your salary and additional income sources"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Your Income"
            value={form.income1}
            onChange={v => update("income1", v)}
            icon="💵"
            suffix="€"
          />
          {isCouple && (
            <Input
              label="Partner Income"
              value={form.income2 || 50000}
              onChange={v => update("income2", v)}
              icon="💵"
              suffix="€"
            />
          )}
          <Input
            label="Bonus Income (Optional)"
            value={form.bonusIncome}
            onChange={v => update("bonusIncome", v)}
            icon="🎁"
            suffix="€"
            placeholder="0"
          />
          <Input
            label="Other Income (Optional)"
            value={form.otherIncome}
            onChange={v => update("otherIncome", v)}
            icon="📊"
            suffix="€"
            placeholder="0"
          />
        </div>
      </FormSection>

      {/* Investments Section */}
      <FormSection 
        title="📈 Investments" 
        description="Your current portfolio and contribution strategy"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Starting Portfolio"
            value={form.initialInvestment}
            onChange={v => update("initialInvestment", v)}
            icon="💼"
            suffix="€"
          />
          <Input
            label="Monthly Contribution"
            value={form.monthlyInvestment}
            onChange={v => update("monthlyInvestment", v)}
            icon="➕"
            suffix="€"
          />
          <Input
            label="Expected Annual Return"
            value={form.investmentReturn * 100}
            onChange={v => update("investmentReturn", v / 100)}
            icon="📊"
            suffix="%"
            step={0.1}
            className="col-span-full"
          />
        </div>
      </FormSection>

      {/* Expenses Section */}
      <FormSection 
        title="🏠 Living Expenses" 
        description="Your monthly costs and inflation assumptions"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Monthly Expenses"
            value={form.monthlyExpenses}
            onChange={v => update("monthlyExpenses", v)}
            icon="💳"
            suffix="€"
          />
          <Input
            label="Annual Expense Growth"
            value={form.expenseGrowth * 100}
            onChange={v => update("expenseGrowth", v / 100)}
            icon="📈"
            suffix="%"
            step={0.1}
          />
        </div>
      </FormSection>

      {/* Debt Section */}
      <FormSection 
        title="💳 Debt (Optional)" 
        description="Outstanding loans and your payoff plan"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Total Debt"
            value={form.currentDebt}
            onChange={v => update("currentDebt", v)}
            icon="⚠️"
            suffix="€"
            placeholder="0"
          />
          <Input
            label="Monthly Payment"
            value={form.monthlyDebtPayment}
            onChange={v => update("monthlyDebtPayment", v)}
            icon="💸"
            suffix="€"
            placeholder="0"
          />
        </div>
      </FormSection>

      {/* Calculate Button */}
      <button
        onClick={handleCalculate}
        className="w-full bg-gradient-to-r from-primary to-teal-600 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-3"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Calculate My Projection
      </button>
    </div>
  )
}

/* ------------------ Enhanced Components ------------------ */

function FormSection({ title, description, children }: { title: string; description: string; children: any }) {
  return (
    <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-6 border border-slate-200 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-secondary mb-1 font-display">
          {title}
        </h3>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </div>
  )
}

function Input({
  label,
  value,
  onChange,
  icon,
  suffix,
  placeholder,
  step = 1,
  className = ""
}: {
  label: string
  value: number | undefined
  onChange: (v: number) => void
  icon?: string
  suffix?: string
  placeholder?: string
  step?: number
  className?: string
}) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        {icon && <span className="text-base">{icon}</span>}
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? undefined as any : Number(e.target.value))}
          placeholder={placeholder}
          step={step}
          className="w-full px-4 py-3 pr-12 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all bg-white font-medium"
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">
            {suffix}
          </span>
        )}
      </div>
    </label>
  )
}
