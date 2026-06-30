'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart3, TrendingUp, Calendar, Calculator, PieChart, DollarSign, CreditCard, AlertCircle } from 'lucide-react';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { Skeleton } from '@/components/ui/Skeleton';

const fmt = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);

const COLORS: Record<string, string> = {
  Water: '#38bdf8', 'Council Tax': '#a78bfa', Energy: '#fbbf24',
  Internet: '#34d399', Insurance: '#f472b6', Mobile: '#fb923c',
  'TV Licence': '#f87171', Other: '#94a3b8'
};

export default function Reports() {
  const [payments, setPayments] = useState<any[]>([]);
  const [dds, setDDs] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [income, setIncome] = useState('');

  useEffect(() => {
    async function load() {
      try {
        // Load payments with biller info
        const { data: paymentsData } = await supabase
          .from('payments')
          .select(`
            *,
            biller:billers(id, name, category)
          `)
          .order('payment_date', { ascending: false });

        // Load active direct debits with biller info
        const { data: ddsData } = await supabase
          .from('direct_debits')
          .select(`
            *,
            biller:billers(id, name, category)
          `)
          .eq('status', 'active');

        // Load bills with biller info
        const { data: billsData } = await supabase
          .from('bills')
          .select(`
            *,
            biller:billers(id, name, category)
          `);

        setPayments(paymentsData || []);
        setDDs(ddsData || []);
        setBills(billsData || []);
      } catch (error) {
        console.error('Error loading reports data:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const yearPayments = payments.filter(p => new Date(p.payment_date).getFullYear() === year);
  const totalYear = yearPayments.reduce((s, p) => s + (p.amount || 0), 0);

  // Monthly breakdown
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const m = yearPayments.filter(p => new Date(p.payment_date).getMonth() === i);
    return { month: new Date(2000, i).toLocaleDateString('en-GB', { month: 'short' }), total: m.reduce((s, p) => s + (p.amount || 0), 0) };
  });
  const maxMonth = Math.max(...monthlyData.map(m => m.total), 1);

  // By category
  const byCategory: Record<string, number> = {};
  yearPayments.forEach(p => {
    const cat = p.biller?.category || 'Other';
    byCategory[cat] = (byCategory[cat] || 0) + (p.amount || 0);
  });
  const sortedCats = Object.entries(byCategory).sort(([,a],[,b]) => b - a);
  const totalCat = Object.values(byCategory).reduce((s, v) => s + v, 0) || 1;

  const totalDDs = dds.reduce((s, d) => s + (d.amount || 0), 0);
  const totalBalance = bills.reduce((s, b) => s + (b.current_balance || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);

  const years = Array.from(new Set(payments.map(p => new Date(p.payment_date).getFullYear()))).sort().reverse();

  if (loading) return <ReportsSkeleton />;

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 md:px-6 pt-[72px] sm:pt-2 pb-24 sm:pb-6">
      <div className="w-full max-w-full">
        
        {/* ── Header ── */}
        <div 
          className="flex items-center justify-between gap-3 min-h-[44px] sm:min-h-[56px] p-3 sm:p-4 rounded-xl border backdrop-blur-sm transition-all duration-300"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            marginTop: '0px',
            position: 'relative',
            zIndex: 10
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-accent-bg)' }}
            >
              <PieChart size={18} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h1 
                className="text-xl sm:text-2xl font-bold tracking-tight truncate"
                style={{ color: 'var(--color-text)' }}
              >
                Reports
              </h1>
              <p 
                className="text-[10px] sm:text-xs font-medium tracking-wider uppercase"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Financial overview for {year}
              </p>
            </div>
          </div>
          <select 
            className="input max-w-[120px] py-2 text-sm" 
            style={{ minHeight: '40px' }}
            value={year} 
            onChange={e => setYear(parseInt(e.target.value))}
          >
            {(years.length ? years : [new Date().getFullYear()]).map(y => <option key={y}>{y}</option>)}
          </select>
        </div>

        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 mt-3">
          <div className="summary-cell">
            <span className="summary-cell__label">Paid in {year}</span>
            <span className="summary-cell__value" style={{ color: 'var(--color-success)' }}>{fmt(totalYear)}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Monthly DDs</span>
            <span className="summary-cell__value" style={{ color: 'var(--color-accent)' }}>{fmt(totalDDs)}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Outstanding</span>
            <span className={`summary-cell__value ${totalBalance > 0 ? 'summary-cell__value--danger' : 'summary-cell__value--ok'}`}>{fmt(totalBalance)}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Total Paid</span>
            <span className="summary-cell__value summary-cell__value--ok">{fmt(totalPaid)}</span>
          </div>
        </div>

        {/* ── Monthly chart ── */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 mb-4">
          <div className="flex items-center gap-2 mb-4 sm:mb-5">
            <BarChart3 size={16} style={{ color: 'var(--color-accent)' }} />
            <h2 className="font-semibold text-slate-100">Monthly Spend — {year}</h2>
          </div>
          <div className="flex items-end gap-1.5 h-36">
            {monthlyData.map(m => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <p className="text-[9px] text-slate-500 font-medium">{m.total > 0 ? fmt(m.total).replace('£','') : ''}</p>
                <div 
                  className="w-full rounded-t-md transition-all duration-500" 
                  style={{ 
                    height: `${(m.total / maxMonth) * 100}%`, 
                    minHeight: m.total > 0 ? '4px' : '0',
                    backgroundColor: m.total > 0 ? 'var(--color-accent)' : 'var(--color-surface-2)',
                    opacity: m.total > 0 ? 0.8 : 0.3
                  }} 
                />
                <p className="text-[10px] text-slate-500">{m.month}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── By category ── */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 mb-4">
          <div className="flex items-center gap-2 mb-4 sm:mb-5">
            <TrendingUp size={16} style={{ color: 'var(--color-success)' }} />
            <h2 className="font-semibold text-slate-100">Spend by Category — {year}</h2>
          </div>
          {sortedCats.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">No payments recorded for {year}</p>
          ) : (
            <div className="space-y-3">
              {sortedCats.map(([cat, amt]) => (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-300">{cat}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{((amt / totalCat) * 100).toFixed(0)}%</span>
                      <span className="text-sm font-semibold text-slate-100">{fmt(amt)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ 
                        width: `${(amt / totalCat) * 100}%`, 
                        backgroundColor: COLORS[cat] || '#94a3b8' 
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Forecast ── */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} style={{ color: 'var(--color-warning)' }} />
            <h2 className="font-semibold text-slate-100">Annual Forecast</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[var(--color-surface-2)] rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">DD annual cost</p>
              <p className="text-lg font-bold" style={{ color: 'var(--color-accent)' }}>{fmt(totalDDs * 12)}</p>
              <p className="text-xs text-slate-500 mt-0.5">{fmt(totalDDs)}/month × 12</p>
            </div>
            <div className="bg-[var(--color-surface-2)] rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">Avg monthly spend ({year})</p>
              <p className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>{fmt(totalYear / 12)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Based on {yearPayments.length} payments</p>
            </div>
          </div>
        </div>

        {/* ── 3-Month Forecast ── */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 mb-4">
          <div className="flex items-center gap-2 mb-4 sm:mb-5">
            <Calendar size={16} style={{ color: 'var(--color-accent)' }} />
            <h2 className="font-semibold text-slate-100">3-Month Forecast</h2>
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map(monthOffset => {
              const date = new Date();
              date.setMonth(date.getMonth() + monthOffset);
              const monthName = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
              const monthDDs = totalDDs;
              const upcomingBillsThisMonth = bills.filter(b => {
                if (!b.next_bill_date) return false;
                const d = new Date(b.next_bill_date.replace(' ', 'T'));
                return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
              });
              const billsTotal = upcomingBillsThisMonth.reduce((s, b) => s + (b.current_balance || 0), 0);
              const total = monthDDs + billsTotal;
              return (
                <div key={monthOffset} className="flex items-center justify-between py-3 border-b border-[var(--color-border)] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{monthName}</p>
                    <p className="text-xs text-slate-500">
                      {fmt(monthDDs)} DDs
                      {billsTotal > 0 && ` + ${fmt(billsTotal)} bills`}
                    </p>
                  </div>
                  <p className={`font-bold text-lg ${monthOffset === 0 ? 'text-sky-400' : 'text-slate-300'}`}>{fmt(total)}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Balance Calculator ── */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calculator size={16} style={{ color: 'var(--color-danger)' }} />
            <h2 className="font-semibold text-slate-100">Balance Calculator</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Monthly Income (£)</label>
              <input 
                type="number" 
                className="input" 
                placeholder="e.g. 2500" 
                value={income} 
                onChange={e => setIncome(e.target.value)} 
              />
            </div>
            {income && parseFloat(income) > 0 && (() => {
              const inc = parseFloat(income);
              const totalBills = totalDDs + (totalBalance / 12);
              const left = inc - totalBills;
              const pct = Math.min(100, (totalBills / inc) * 100);
              return (
                <div className="space-y-3">
                  <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ 
                        width: `${pct}%`,
                        background: pct > 80 ? '#f87171' : pct > 60 ? '#fbbf24' : '#34d399'
                      }} 
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[var(--color-surface-2)] rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-400 mb-1">Income</p>
                      <p className="font-bold text-slate-100">{fmt(inc)}</p>
                    </div>
                    <div className="bg-red-500/10 rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-400 mb-1">Bills</p>
                      <p className="font-bold text-red-400">{fmt(totalBills)}</p>
                    </div>
                    <div className={`rounded-xl p-3 text-center ${left >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      <p className="text-xs text-slate-400 mb-1">Left Over</p>
                      <p className={`font-bold ${left >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(left)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 text-center">{pct.toFixed(0)}% of income goes to bills</p>
                </div>
              );
            })()}
          </div>
        </div>

      </div>
    </div>
  );
}

// Skeleton Component
function ReportsSkeleton() {
  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 md:px-6 pt-[72px] sm:pt-2 pb-24 sm:pb-6">
      <div className="w-full max-w-full">
        <div className="flex items-center justify-between gap-3 min-h-[44px] sm:min-h-[56px] p-3 sm:p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <div>
              <Skeleton className="h-6 w-32 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 mt-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="summary-cell">
              <Skeleton className="h-3 w-16 mb-1" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 mb-4">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="flex items-end gap-1.5 h-36">
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <Skeleton className="w-full h-8 rounded-t-md" style={{ height: `${20 + Math.random() * 60}%` }} />
                <Skeleton className="h-3 w-6" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 mb-4">
          <Skeleton className="h-5 w-48 mb-4" />
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}