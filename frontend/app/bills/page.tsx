'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FREQUENCY_LABELS, Frequency } from '@/lib/smartPayment';
import { useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toaster';
import {
  Plus, FileText, Edit2, Trash2, RefreshCw, Search,
  ChevronLeft, ChevronRight, X, CheckCircle, Clock,
  AlertCircle, Calendar, Brain, SlidersHorizontal
} from 'lucide-react';
import { FieldError, useFormErrors } from '@/components/ui/FieldError';
import { predictBillAmount } from '@/lib/billPrediction';
import { SkeletonBillsPage } from '@/components/ui/Skeleton';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import styles from './page.module.css';
/* ─── formatters ─────────────────────────────────────────── */
const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);

const fmtDate = (dateStr: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const daysUntilDate = (dateStr: string): number | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
};

const emptyBill: Partial<any> = {
  biller_id: '', current_balance: 0, last_bill_date: '',
  last_bill_amount: 0, next_bill_date: '', notes: '', frequency: 'monthly'
};
const ITEMS_PER_PAGE = 12;

/* ─── status config ──────────────────────────────────────── */
const getStatus = (bill: any) => {
  const days = daysUntilDate(bill.next_bill_date);
  const paid = bill.current_balance === 0;
  if (paid) return { label: 'Paid', short: 'Paid', icon: CheckCircle, accent: 'var(--color-success)', border: 'var(--color-success)', bg: 'var(--color-success-bg)', text: 'var(--color-success)', bar: 'border-l-emerald-500', barColor: '#10b981' };
  if (days !== null && days < 0) return { label: `${Math.abs(days)}d overdue`, short: `${Math.abs(days)}d overdue`, icon: AlertCircle, accent: 'var(--color-danger)', border: 'var(--color-danger)', bg: 'var(--color-danger-bg)', text: 'var(--color-danger)', bar: 'border-l-red-500', barColor: '#f87171' };
  if (days !== null && days <= 3) return { label: `${days}d left`, short: `${days}d`, icon: Clock, accent: 'var(--color-warning)', border: 'var(--color-warning)', bg: 'var(--color-warning-bg)', text: 'var(--color-warning)', bar: 'border-l-amber-500', barColor: '#fbbf24' };
  if (days !== null && days <= 7) return { label: `${days}d`, short: `${days}d`, icon: Calendar, accent: 'var(--color-warning)', border: 'var(--color-warning)', bg: 'var(--color-warning-bg)', text: 'var(--color-warning)', bar: 'border-l-amber-500', barColor: '#fbbf24' };
  return { label: `${days}d`, short: `${days}d`, icon: Calendar, accent: 'var(--color-accent)', border: 'var(--color-accent)', bg: 'var(--color-accent-bg)', text: 'var(--color-accent)', bar: 'border-l-sky-500', barColor: '#38bdf8' };
};



/* ═══════════════════════════════════════════════════════════
   BILL CARD
═══════════════════════════════════════════════════════════ */
interface CardProps {
  bill: any;
  prediction?: any;
  highlighted: boolean;
  highlightRef?: React.RefObject<HTMLDivElement>;
  onMarkPaid: () => void;
  onRecreateReminder: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function BillCard({ bill: b, prediction, highlighted, highlightRef, onMarkPaid, onRecreateReminder, onEdit, onDelete }: CardProps) {
  const status = getStatus(b);
  const StatusIcon = status.icon;
  const biller = b.biller;
  const isPaid = b.current_balance === 0;
  const isRecurring = b.frequency && b.frequency !== 'one_off';
  const showLast = b.last_bill_amount > 0;

  return (
<div
  ref={highlighted ? highlightRef : undefined}
  className={`bill-card ${status.bar} ${highlighted ? 'highlighted highlight-pulse' : ''}`}
  style={{ '--card-accent': status.barColor } as React.CSSProperties}
>
      {/* ── top row ── */}
      <div className="bill-card__header">
        <div className="bill-card__title-group">
          <h3 className="bill-card__name">{biller?.name ?? '—'}</h3>
          <div className="bill-card__badges">
            <span className="bill-card__status-badge" style={{ color: status.text, background: status.bg, border: `1px solid ${status.barColor}44` }}>
              <StatusIcon size={10} />
              {status.label}
            </span>
          </div>
        </div>

        {/* action buttons */}
        <div className="bill-card__actions">
          {!isPaid && (
            <button className="bill-card__btn bill-card__btn--pay" onClick={onMarkPaid} title="Mark as paid">
              <CheckCircle size={14} />
            </button>
          )}
          <button className="bill-card__btn bill-card__btn--remind" onClick={onRecreateReminder} title="Recreate reminder">
            <RefreshCw size={14} />
          </button>
          <button className="bill-card__btn bill-card__btn--edit" onClick={onEdit} title="Edit">
            <Edit2 size={14} />
          </button>
          <button className="bill-card__btn bill-card__btn--delete" onClick={onDelete} title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── meta row ── */}
      {(biller?.category || b.frequency) && (
        <div className="bill-card__meta">
          {biller?.category && <span>{biller.category}</span>}
          {biller?.category && b.frequency && b.frequency !== 'one_off' && <span className="bill-card__meta-dot">·</span>}
          {b.frequency && b.frequency !== 'one_off' && (
            <span>{FREQUENCY_LABELS[b.frequency as Frequency]}</span>
          )}
        </div>
      )}

      {/* ── data grid ── */}
      <div className="bill-card__grid">
        <div className="bill-card__cell">
          <span className="bill-card__cell-label">Balance</span>
          <span className={`bill-card__cell-value ${isPaid ? 'bill-card__cell-value--paid' : ''}`}>
            {fmt(b.current_balance)}
          </span>
        </div>
        <div className="bill-card__cell">
          <span className="bill-card__cell-label">Last</span>
          <span className="bill-card__cell-value">{showLast ? fmt(b.last_bill_amount) : '—'}</span>
          {!showLast && <span className="bill-card__cell-sub">First payment</span>}
        </div>
        <div className="bill-card__cell">
          <span className="bill-card__cell-label">Last Date</span>
          <span className="bill-card__cell-value bill-card__cell-value--date">{fmtDate(b.last_bill_date)}</span>
        </div>
        <div className="bill-card__cell">
          <span className="bill-card__cell-label">Next Due</span>
          <span className="bill-card__cell-value bill-card__cell-value--date" style={{ color: isPaid ? 'var(--color-success)' : status.text }}>
            {fmtDate(b.next_bill_date)}
          </span>
        </div>
      </div>

      {/* ── AI prediction ── */}
      {!isPaid && isRecurring && prediction && b.current_balance > 0 && (
        <div className="bill-card__prediction">
          <Brain size={11} className="bill-card__prediction-icon" />
          <span>{prediction.message}</span>
        </div>
      )}

      {/* ── notes ── */}
      {b.notes && (
        <div className="bill-card__notes">
          <span>📝</span>
          <span>{b.notes}</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════ */
export default function Bills() {
  const [bills, setBills] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [billers, setBillers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<any>>(emptyBill);
  const [saving, setSaving] = useState(false);
  const { errors, setError, clearError, clearAll } = useFormErrors();
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid' | 'overdue' | 'upcoming'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const highlightRef = useRef<HTMLDivElement>(null);

  /* ── data ── */
  const load = async () => {
    setLoading(true);
    try {
      // Load bills with biller info
      const { data: billsData, error: billsError } = await supabase
        .from('bills')
        .select(`
          *,
          biller:billers(id, name, category, is_active)
        `)
        .order('next_bill_date', { ascending: true, nullsFirst: true });

      if (billsError) throw billsError;

      // Load billers
      const { data: billersData, error: billersError } = await supabase
        .from('billers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (billersError) throw billersError;

      setBills(billsData || []);
      setBillers(billersData || []);
      applyFilters(billsData || []);
      await loadPredictions(billsData || []);
      
      if (highlightId) {
        const found = (billsData || []).find(b => b.id === highlightId);
        if (found) {
          setHighlighted(highlightId);
          setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
          setTimeout(() => setHighlighted(null), 3500);
        }
      }
    } catch (e) { 
      console.error('Error loading bills:', e);
      toast('Failed to load bills', 'error');
    }
    finally { setLoading(false); }
  };

  const loadPredictions = async (list: any[]) => {
    const preds: Record<string, any> = {};
    for (const bill of list) {
      if (bill.frequency && bill.frequency !== 'one_off' && bill.current_balance > 0) {
        try { 
          const p = await predictBillAmount(bill.id); 
          if (p) preds[bill.id] = p; 
        } catch {}
      }
    }
    setPredictions(preds);
  };

  const applyFilters = (data: any[]) => {
    let f = [...data];
    if (selectedCategory !== 'all') f = f.filter(b => b.biller?.category === selectedCategory);
    if (filterStatus !== 'all') f = f.filter(b => {
      const days = daysUntilDate(b.next_bill_date);
      const paid = b.current_balance === 0;
      if (filterStatus === 'paid') return paid;
      if (filterStatus === 'unpaid') return !paid;
      if (filterStatus === 'overdue') return days !== null && days < 0 && !paid;
      if (filterStatus === 'upcoming') return days !== null && days >= 0 && !paid;
      return true;
    });
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(b => b.biller?.name?.toLowerCase().includes(q) || b.notes?.toLowerCase().includes(q));
    }
    f.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'date') cmp = new Date(a.next_bill_date).getTime() - new Date(b.next_bill_date).getTime();
      if (sortBy === 'amount') cmp = (a.current_balance || 0) - (b.current_balance || 0);
      if (sortBy === 'name') cmp = (a.biller?.name || '').localeCompare(b.biller?.name || '');
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    setFiltered(f);
    setTotalPages(Math.ceil(f.length / ITEMS_PER_PAGE));
    setCurrentPage(1);
  };

  useEffect(() => { applyFilters(bills); }, [bills, filterStatus, searchQuery, sortBy, sortOrder, selectedCategory]);
  useEffect(() => { load(); }, []);

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('bills-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'bills' },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Highlight effect
  useEffect(() => {
    if (highlightId && bills.length > 0) {
      const found = bills.find(b => b.id === highlightId);
      if (found) {
        setHighlighted(highlightId);
        setTimeout(() => {
          highlightRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }, 500);
        setTimeout(() => setHighlighted(null), 5000);
      }
    }
  }, [bills, highlightId]);

  /* ── actions ── */
  const markAsPaid = async (id: string) => {
    try { 
      await supabase
        .from('bills')
        .update({ current_balance: 0, updated: new Date().toISOString() })
        .eq('id', id);
      toast('✅ Marked as paid'); 
      load(); 
    }
    catch { toast('Failed to mark as paid', 'error'); }
  };

  const recreateReminder = async (billId: string, billerId: string, dueDate: string) => {
    try {
      // Delete old pending reminders for this biller
      const { data: oldReminders } = await supabase
        .from('reminders')
        .select('id')
        .eq('biller_id', billerId)
        .eq('status', 'pending');

      if (oldReminders && oldReminders.length > 0) {
        await supabase
          .from('reminders')
          .delete()
          .in('id', oldReminders.map(r => r.id));
      }

      // Create new reminder
      const rd = new Date(dueDate);
      rd.setDate(rd.getDate() - 3);
      
      // Get biller and bill details
      const { data: biller } = await supabase
        .from('billers')
        .select('name')
        .eq('id', billerId)
        .single();

      const { data: bill } = await supabase
        .from('bills')
        .select('last_bill_amount')
        .eq('id', billId)
        .single();

      await supabase
        .from('reminders')
        .insert([{
          biller_id: billerId,
          reminder_date: rd.toISOString().split('T')[0],
          type: 'payment_due',
          message: `${biller?.name || 'Bill'} — ${fmt(bill?.last_bill_amount || 0)} due ${new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
          status: 'pending',
        }]);

      toast('✅ Reminder recreated');
      load();
    } catch (error) {
      console.error('Error recreating reminder:', error);
      toast('Failed to recreate reminder', 'error');
    }
  };

  const save = async () => {
    clearAll();
    let valid = true;
    if (!editing.biller_id) { setError('biller_id', 'Please select a biller'); valid = false; }
    if (!editing.next_bill_date) { setError('next_bill_date', 'Next bill date is required'); valid = false; }
    if (!valid) return;
    setSaving(true);
    try {
      if (editing.id) {
        await supabase
          .from('bills')
          .update({
            biller_id: editing.biller_id,
            current_balance: editing.current_balance || 0,
            last_bill_date: editing.last_bill_date,
            last_bill_amount: editing.last_bill_amount || 0,
            next_bill_date: editing.next_bill_date,
            notes: editing.notes,
            frequency: editing.frequency || 'monthly',
            updated: new Date().toISOString(),
          })
          .eq('id', editing.id);
        toast('Bill updated'); 
      } else {
        await supabase
          .from('bills')
          .insert([{
            biller_id: editing.biller_id,
            current_balance: editing.current_balance || 0,
            last_bill_date: editing.last_bill_date,
            last_bill_amount: editing.last_bill_amount || 0,
            next_bill_date: editing.next_bill_date,
            notes: editing.notes,
            frequency: editing.frequency || 'monthly',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          }]);
        toast('Bill added');
        
        // Create reminder
        if (editing.next_bill_date) {
          try {
            await supabase
              .from('reminders')
              .insert([{
                biller_id: editing.biller_id,
                reminder_date: editing.next_bill_date,
                type: 'payment_due',
                message: 'Bill due',
                status: 'pending',
              }]);
          } catch {}
        }
      }
      setOpen(false);
      setEditing(emptyBill);
      clearAll();
      load();
    } catch (error) {
      console.error('Error saving bill:', error);
      toast('Something went wrong', 'error');
    }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    try { 
      await supabase
        .from('bills')
        .delete()
        .eq('id', id);
      toast('Record deleted'); 
      setDeleteId(null); 
      load(); 
    }
    catch { toast('Could not delete', 'error'); }
  };

  const resetFilters = () => { setFilterStatus('all'); setSearchQuery(''); setSortBy('date'); setSortOrder('asc'); setSelectedCategory('all'); };
  const hasActiveFilters = !!(searchQuery || filterStatus !== 'all' || selectedCategory !== 'all');
  const categories = ['all', ...new Set(bills.map(b => b.biller?.category).filter(Boolean))];
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  /* ── summary stats ── */
  const totalOwed = bills.filter(b => b.current_balance > 0).reduce((s, b) => s + b.current_balance, 0);
  const overdueCount = bills.filter(b => { const d = daysUntilDate(b.next_bill_date); return d !== null && d < 0 && b.current_balance > 0; }).length;
  const dueThisWeek = bills.filter(b => { const d = daysUntilDate(b.next_bill_date); return d !== null && d >= 0 && d <= 7 && b.current_balance > 0; }).length;
  const paidCount = bills.filter(b => b.current_balance === 0).length;

  return (
    <>
      {loading ? <SkeletonBillsPage /> : (
       <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 md:px-6 pt-[72px] sm:pt-2 pb-24 sm:pb-6">
  <div className="w-full max-w-full">

            {/* ── Header ── */}
            <div 
              className="flex items-center justify-between gap-3 min-h-[44px] sm:min-h-[56px] p-3 sm:p-4 rounded-xl border backdrop-blur-sm transition-all duration-300"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                marginTop: '8px',
                position: 'relative',
                zIndex: 10
              }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-accent-bg)' }}
                >
                  <FileText size={18} style={{ color: 'var(--color-accent)' }} />
                </div>
                <div>
                  <h1 
                    className="text-xl sm:text-2xl font-bold tracking-tight truncate"
                    style={{ color: 'var(--color-text)' }}
                  >
                    Bill Records
                  </h1>
                  <p 
                    className="text-[10px] sm:text-xs font-medium tracking-wider uppercase"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {filtered.length} records
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setEditing(emptyBill); setOpen(true); }} 
              className="btn-primary"
              >
                <Plus size={18} className="sm:w-4 sm:h-4" /> 
                <span className="hidden xs:inline">Add Bill</span>
              </button>
            </div>

            {/* ── Summary Strip ── */}
            <div className="bills-summary">
              <div className="summary-cell">
                <span className="summary-cell__label">Total Owed</span>
                <span className={`summary-cell__value ${totalOwed > 0 ? 'summary-cell__value--danger' : 'summary-cell__value--ok'}`}>{fmt(totalOwed)}</span>
              </div>
              <div className="summary-cell">
                <span className="summary-cell__label">Overdue</span>
                <span className={`summary-cell__value ${overdueCount > 0 ? 'summary-cell__value--danger' : 'summary-cell__value--ok'}`}>{overdueCount}</span>
              </div>
              <div className="summary-cell">
                <span className="summary-cell__label">Due This Week</span>
                <span className={`summary-cell__value ${dueThisWeek > 0 ? 'summary-cell__value--warn' : 'summary-cell__value--ok'}`}>{dueThisWeek}</span>
              </div>
              <div className="summary-cell">
                <span className="summary-cell__label">Paid</span>
                <span className="summary-cell__value summary-cell__value--ok">{paidCount}</span>
              </div>
            </div>

            {/* ── Toolbar ── */}
            <div className="bills-toolbar">
              <div className="bills-search">
                <Search size={16} className="bills-search__icon" />
                <input
                  className="bills-search__input"
                  placeholder="Search bills…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="bills-search__clear" onClick={() => setSearchQuery('')}>
                    <X size={13} />
                  </button>
                )}
              </div>

              <FilterDropdown
                hasActiveFilters={hasActiveFilters}
                onClearAll={resetFilters}
                triggerLabel="Filters"
                sections={[
                  {
                    title: 'STATUS', type: 'radio', activeValue: filterStatus,
                    onChange: v => setFilterStatus(v as any),
                    options: [
                      { value: 'all', label: 'All', count: bills.length },
                      { value: 'paid', label: 'Paid', count: bills.filter(b => b.current_balance === 0).length },
                      { value: 'unpaid', label: 'Unpaid', count: bills.filter(b => b.current_balance > 0).length },
                      { value: 'overdue', label: 'Overdue', count: bills.filter(b => { const d = daysUntilDate(b.next_bill_date); return d !== null && d < 0 && b.current_balance > 0; }).length },
                      { value: 'upcoming', label: 'Upcoming', count: bills.filter(b => { const d = daysUntilDate(b.next_bill_date); return d !== null && d >= 0 && b.current_balance > 0; }).length },
                    ]
                  },
                  {
                    title: 'CATEGORY', type: 'checkbox', activeValue: selectedCategory,
                    onChange: v => setSelectedCategory(v),
                    options: [
                      { value: 'all', label: 'All Categories', count: bills.length },
                      ...categories.filter(c => c !== 'all').map(cat => ({
                        value: cat, label: cat,
                        count: bills.filter(b => b.biller?.category === cat).length
                      }))
                    ]
                  },
                  {
                    title: 'SORT BY', type: 'radio', activeValue: sortBy,
                    onChange: v => setSortBy(v as any),
                    options: [
                      { value: 'date', label: '📅 Date' },
                      { value: 'amount', label: '💰 Amount' },
                      { value: 'name', label: '📛 Name' },
                    ]
                  }
                ]}
              />
            </div>

            {/* ── Active filter chips ── */}
            {hasActiveFilters && (
              <div className="filter-chips">
                {filterStatus !== 'all' && (
                  <span className="filter-chip">
                    {filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}
                    <button className="filter-chip__x" onClick={() => setFilterStatus('all')}><X size={11} /></button>
                  </span>
                )}
                {selectedCategory !== 'all' && (
                  <span className="filter-chip">
                    {selectedCategory}
                    <button className="filter-chip__x" onClick={() => setSelectedCategory('all')}><X size={11} /></button>
                  </span>
                )}
                {searchQuery && (
                  <span className="filter-chip">
                    "{searchQuery}"
                    <button className="filter-chip__x" onClick={() => setSearchQuery('')}><X size={11} /></button>
                  </span>
                )}
                <button className="filter-clear" onClick={resetFilters}>Clear all</button>
              </div>
            )}

            {/* ── Results meta ── */}
            <div className="bills-meta">
              <span>
                {filtered.length > 0
                  ? `${startIndex + 1}–${Math.min(startIndex + ITEMS_PER_PAGE, filtered.length)} of ${filtered.length} records`
                  : '0 records'}
              </span>
            </div>

            {/* ── Cards ── */}
            {pageItems.length === 0 ? (
              <div className="bills-empty">
                {hasActiveFilters ? (
                  <>
                    <FileText size={32} style={{ color: 'var(--color-text-dim)', margin: '0 auto 12px' }} />
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>No bills match your filters</p>
                    <button onClick={resetFilters} style={{ color: 'var(--color-accent)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>Clear all filters</button>
                  </>
                ) : (
                  <>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <FileText size={28} style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <h3 style={{ color: 'var(--color-text)', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>No bill records yet</h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 20 }}>Add your first bill to start tracking expenses.</p>
                    <button className="btn-add" onClick={() => { setEditing(emptyBill); setOpen(true); }}>
                      <Plus size={16} /> Add Your First Bill
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="bills-grid">
                {pageItems.map(b => (
                  <BillCard
                    key={b.id}
                    bill={b}
                    prediction={predictions[b.id]}
                    highlighted={b.id === highlightId || b.id === highlighted}
                    highlightRef={highlightRef}
                    onMarkPaid={() => markAsPaid(b.id)}
                    onRecreateReminder={() => recreateReminder(b.id, b.biller_id, b.next_bill_date)}
                    onEdit={() => setEditing({ ...b, last_bill_date: b.last_bill_date?.replace(' ', 'T').split('T')[0] || '', next_bill_date: b.next_bill_date?.replace(' ', 'T').split('T')[0] || '' })}
                    onDelete={() => setDeleteId(b.id)}
                  />
                ))}
              </div>
            )}

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="bills-pagination">
                <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft size={16} /> Prev
                </button>
                <span className="page-info">{currentPage} / {totalPages}</span>
                <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* ── Add/Edit Modal ── */}
            <Modal open={open} onClose={() => { setOpen(false); setEditing(emptyBill); clearAll(); }} title={editing.id ? 'Edit Bill Record' : 'Add Bill Record'}>
              <div className="space-y-4">
                <div>
                  <label className="label">Biller *</label>
                  <select className={`input ${errors.biller_id ? 'border-red-500/60' : ''}`} value={editing.biller_id || ''} onChange={e => { setEditing(p => ({ ...p, biller_id: e.target.value })); clearError('biller_id'); }}>
                    <option value="">Select a biller…</option>
                    {billers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <FieldError message={errors.biller_id} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Current Balance (£)</label>
                    <input type="number" step="0.01" className="input" placeholder="0.00" value={editing.current_balance || ''} onChange={e => setEditing(p => ({ ...p, current_balance: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="label">Last Bill Amount (£)</label>
                    <input type="number" step="0.01" className="input" placeholder="0.00" value={editing.last_bill_amount || ''} onChange={e => setEditing(p => ({ ...p, last_bill_amount: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Last Bill Date</label>
                    <input type="date" className="input" value={editing.last_bill_date || ''} onChange={e => setEditing(p => ({ ...p, last_bill_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Next Bill Date *</label>
                    <input type="date" className={`input ${errors.next_bill_date ? 'border-red-500/60' : ''}`} value={editing.next_bill_date || ''} onChange={e => { setEditing(p => ({ ...p, next_bill_date: e.target.value })); clearError('next_bill_date'); }} />
                    <FieldError message={errors.next_bill_date} />
                  </div>
                </div>
                <div>
                  <label className="label">Payment Frequency</label>
                  <select className="input" value={(editing as any).frequency || 'monthly'} onChange={e => setEditing(p => ({ ...p, frequency: e.target.value }))}>
                    {Object.entries(FREQUENCY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Used to auto-calculate the next payment date when you pay</p>
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea className="input resize-none" rows={3} placeholder="Any notes…" value={editing.notes || ''} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving…' : editing.id ? 'Save Changes' : 'Add Record'}</button>
                  <button onClick={() => { setOpen(false); setEditing(emptyBill); clearAll(); }} className="btn-secondary">Cancel</button>
                </div>
              </div>
            </Modal>

            {/* ── Delete Modal ── */}
            <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Bill Record" size="sm">
              <p className="text-sm text-slate-300 mb-5">This will permanently delete this bill record. This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => deleteId && remove(deleteId)} className="btn-danger flex-1 justify-center">Delete</button>
                <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              </div>
            </Modal>

          </div>
        </div>
      )}
    </>
  );
}
