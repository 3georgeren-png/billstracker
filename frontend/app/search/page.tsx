'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Building2, FileText, CreditCard, Bell, X, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { CategoryBadge } from '@/components/ui/CategoryBadge';

const fmt = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);
function fmtDate(d: string) {
  if (!d) return '';
  const dt = new Date(d.replace(' ', 'T'));
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-GB');
}

type Result = {
  id: string;
  type: 'biller' | 'bill' | 'payment' | 'reminder';
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      setSearched(true);
      try {
        // Search billers
        const { data: billers } = await supabase
          .from('billers')
          .select('*')
          .or(`name.ilike.%${query}%,notes.ilike.%${query}%,account_number.ilike.%${query}%`)
          .limit(20);

        // Search bills with biller info
        const { data: bills } = await supabase
          .from('bills')
          .select(`
            *,
            biller:billers(id, name)
          `)
          .or(`notes.ilike.%${query}%`)
          .limit(20);

        // Search payments with biller info
        const { data: payments } = await supabase
          .from('payments')
          .select(`
            *,
            biller:billers(id, name)
          `)
          .or(`notes.ilike.%${query}%`)
          .limit(20);

        // Search reminders with biller info
        const { data: reminders } = await supabase
          .from('reminders')
          .select(`
            *,
            biller:billers(id, name)
          `)
          .or(`message.ilike.%${query}%`)
          .limit(20);

        const res: Result[] = [
          ...(billers || []).map((b: any) => ({
            id: b.id,
            type: 'biller' as const,
            title: b.name,
            subtitle: b.category + (b.account_number ? ` · ${b.account_number}` : ''),
            href: `/billers/${b.id}`,
            meta: b.contact_info,
          })),
          ...(bills || []).map((b: any) => ({
            id: b.id,
            type: 'bill' as const,
            title: b.biller?.name ?? 'Bill',
            subtitle: `Balance: ${fmt(b.current_balance)}`,
            href: `/bills?highlight=${b.id}`,
            meta: b.next_bill_date ? `Next: ${fmtDate(b.next_bill_date)}` : '',
          })),
          ...(payments || []).map((p: any) => ({
            id: p.id,
            type: 'payment' as const,
            title: p.biller?.name ?? 'Payment',
            subtitle: `${fmt(p.amount)} · ${p.method}`,
            href: `/payments`,
            meta: fmtDate(p.payment_date),
          })),
          ...(reminders || []).map((r: any) => ({
            id: r.id,
            type: 'reminder' as const,
            title: r.biller?.name ?? 'Reminder',
            subtitle: r.message || r.type?.replace('_', ' '),
            href: `/reminders`,
            meta: fmtDate(r.reminder_date),
          })),
        ];
        setResults(res);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally { 
        setLoading(false); 
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const icons = {
    biller: <Building2 size={16} className="text-sky-400" />,
    bill: <FileText size={16} className="text-amber-400" />,
    payment: <CreditCard size={16} className="text-emerald-400" />,
    reminder: <Bell size={16} className="text-purple-400" />,
  };

  const typeLabel = { biller: 'Biller', bill: 'Bill', payment: 'Payment', reminder: 'Reminder' };
  const typeBadge = {
    biller: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
    bill: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    payment: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    reminder: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  };

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
              <Search size={18} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h1 
                className="text-xl sm:text-2xl font-bold tracking-tight truncate"
                style={{ color: 'var(--color-text)' }}
              >
                Search
              </h1>
              <p 
                className="text-[10px] sm:text-xs font-medium tracking-wider uppercase"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {query ? `${results.length} results` : 'Find anything'}
              </p>
            </div>
          </div>
          {query && (
            <button 
              onClick={() => setQuery('')} 
              className="p-2 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* ── Search Input ── */}
        <div className="relative mt-4">
          <Search 
            size={18} 
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)] pointer-events-none" 
          />
          <input
            autoFocus
            type="search"
            enterKeyHint="search"
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 pl-11 pr-11 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_var(--color-accent-bg)]"
            placeholder="Search billers, bills, payments, reminders..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button 
              onClick={() => setQuery('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-dim)] transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Results ── */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-2xl p-12 text-center mt-4">
            <Search size={36} style={{ color: 'var(--color-text-dim)' }} className="mx-auto mb-3" />
            <p style={{ color: 'var(--color-text-muted)' }} className="font-medium">No results for "{query}"</p>
            <p className="text-sm text-[var(--color-text-dim)] mt-1">Try searching by name, account number, or notes</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="grid grid-cols-1 gap-3 mt-4">
            {results.map(r => (
              <Link 
                key={`${r.type}-${r.id}`} 
                href={r.href}
                className="bill-card border-l-4 border-l-sky-500"
                style={{ borderLeftColor: r.type === 'biller' ? '#38bdf8' : r.type === 'bill' ? '#fbbf24' : r.type === 'payment' ? '#34d399' : '#a78bfa' }}
              >
                {/* ── top row ── */}
                <div className="bill-card__header">
                  <div className="bill-card__title-group">
                    <div className="flex items-center gap-2">
                      <h3 className="bill-card__name">{r.title}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${typeBadge[r.type]}`}>
                        {typeLabel[r.type]}
                      </span>
                    </div>
                    <div className="bill-card__badges">
                      <span className="bill-card__status-badge" style={{ 
                        color: 'var(--color-text-muted)',
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border)'
                      }}>
                        {icons[r.type]}
                        {typeLabel[r.type]}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── meta row ── */}
                <div className="bill-card__meta">
                  <span>{r.subtitle}</span>
                </div>

                {/* ── data grid ── */}
                <div className="bill-card__grid">
                  <div className="bill-card__cell">
                    <span className="bill-card__cell-label">Type</span>
                    <span className="bill-card__cell-value bill-card__cell-value--date">{typeLabel[r.type]}</span>
                  </div>
                  <div className="bill-card__cell">
                    <span className="bill-card__cell-label">Title</span>
                    <span className="bill-card__cell-value bill-card__cell-value--date">{r.title}</span>
                  </div>
                  <div className="bill-card__cell">
                    <span className="bill-card__cell-label">Details</span>
                    <span className="bill-card__cell-value bill-card__cell-value--date">{r.subtitle}</span>
                  </div>
                  <div className="bill-card__cell">
                    <span className="bill-card__cell-label">{r.meta ? 'Meta' : ' '}</span>
                    <span className="bill-card__cell-value bill-card__cell-value--date">{r.meta || '—'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── Quick Search Categories ── */}
        {!query && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Search across</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: <Building2 size={20} className="text-sky-400" />, label: 'Billers', desc: 'Name, account, contact', href: '/billers' },
                { icon: <FileText size={20} className="text-amber-400" />, label: 'Bills', desc: 'Notes, balances', href: '/bills' },
                { icon: <CreditCard size={20} className="text-emerald-400" />, label: 'Payments', desc: 'Notes, methods', href: '/payments' },
                { icon: <Bell size={20} className="text-purple-400" />, label: 'Reminders', desc: 'Messages, dates', href: '/reminders' },
              ].map(item => (
                <Link 
                  key={item.label} 
                  href={item.href} 
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col items-center text-center hover:border-[var(--color-accent)] transition-all duration-200 hover:shadow-lg hover:shadow-[var(--color-accent-glow)] group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-200">
                    {item.icon}
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{item.label}</p>
                  <p className="text-[10px] text-[var(--color-text-dim)] mt-0.5">{item.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}