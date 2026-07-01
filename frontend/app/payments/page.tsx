'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { recordSmartPayment, FREQUENCY_LABELS } from '@/lib/smartPayment';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toaster';
import { 
  Plus, CreditCard, Edit2, Trash2, Paperclip, Eye, X, Upload, FileText, 
  Search, ChevronLeft, ChevronRight, Filter, Calendar, 
  TrendingUp, ArrowUpDown, ChevronDown
} from 'lucide-react';
import { FieldError, useFormErrors } from '@/components/ui/FieldError';
import { SwipeToDelete } from '@/components/ui/SwipeToDelete';
import { Skeleton } from '@/components/ui/Skeleton';
import { FilterDropdown } from '@/components/ui/FilterDropdown';

const fmt = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);
const METHODS = ['Direct Debit','Bank Transfer','Card','Cash','Standing Order','Other'];
const emptyPay: Partial<any> = { biller_id: '', amount: 0, payment_date: new Date().toISOString().split('T')[0], method: 'Bank Transfer', notes: '' };
const ITEMS_PER_PAGE = 10;

function getReceiptUrl(payment: any) {
  if (!payment.receipt) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/receipts/${payment.id}/${payment.receipt}`;
}

function ReceiptPreview({ payment, onClose }: { payment: any; onClose: () => void }) {
  const url = getReceiptUrl(payment);
  const [rotation, setRotation] = useState(0);
  if (!url) return null;
  const isPdf = payment.receipt?.endsWith('.pdf');
  const rotate = (dir: 'cw' | 'ccw') => setRotation(r => (r + (dir === 'cw' ? 90 : -90) + 360) % 360);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1 sm:gap-2 flex-wrap">
          <p className="text-[10px] sm:text-sm font-medium text-slate-300 truncate flex-1 max-w-[120px] xs:max-w-[200px]">{payment.receipt}</p>
          <div className="flex gap-1 sm:gap-2 shrink-0 flex-wrap">
            {!isPdf && (
              <>
                <button onClick={() => rotate('ccw')} className="p-1.5 sm:p-2 rounded-lg bg-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-600 transition-colors touch-target">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
                <button onClick={() => rotate('cw')} className="p-1.5 sm:p-2 rounded-lg bg-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-600 transition-colors touch-target">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                </button>
                <button onClick={() => setRotation(0)} className="hidden xs:inline-block px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-700/60 text-slate-400 hover:text-white text-[10px] sm:text-xs hover:bg-slate-600 transition-colors touch-target">Reset</button>
              </>
            )}
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-[10px] sm:text-xs py-1 px-2 sm:px-3 touch-target">
              <Eye size={12} className="sm:w-3.5 sm:h-3.5" /> <span className="hidden xs:inline">Open</span>
            </a>
            <button onClick={onClose} className="p-1.5 sm:p-2 rounded-lg bg-slate-700/60 text-slate-400 hover:text-slate-100 touch-target"><X size={14} className="sm:w-4 sm:h-4" /></button>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 flex items-center justify-center" style={{ minHeight: '200px', maxHeight: '75vh' }}>
          {isPdf ? (
            <iframe src={url} className="w-full h-[60vh] sm:h-[70vh]" />
          ) : (
            <img
              src={url}
              alt="Receipt"
              className="max-w-full max-h-[60vh] sm:max-h-[70vh] object-contain transition-transform duration-300"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          )}
        </div>
        {!isPdf && <p className="text-center text-[10px] sm:text-xs text-slate-600 mt-2">Use rotate buttons if photo is sideways</p>}
      </div>
    </div>
  );
}

export default function Payments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<any[]>([]);
  const [billers, setBillers] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [smartInfo, setSmartInfo] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<any>>(emptyPay);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { errors, setError, clearError, clearAll } = useFormErrors();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Simplified filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const load = async () => {
    setLoading(true);
    try {
      // Load payments with biller info
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          biller:billers(id, name, category, is_active)
        `)
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Load billers
      const { data: billersData, error: billersError } = await supabase
        .from('billers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (billersError) throw billersError;

      // Load bills
      const { data: billsData, error: billsError } = await supabase
        .from('bills')
        .select('*')
        .order('updated', { ascending: false });

      if (billsError) throw billsError;

      setPayments(paymentsData || []);
      setBillers(billersData || []);
      setBills(billsData || []);
      applyFilters(paymentsData || []);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast('Failed to load payments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (paymentsData: any[]) => {
    let filtered = [...paymentsData];

    if (filterMonth) {
      filtered = filtered.filter(p => p.payment_date?.startsWith(filterMonth));
    }

    if (filterMethod !== 'all') {
      filtered = filtered.filter(p => p.method === filterMethod);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.biller?.name?.toLowerCase().includes(query) ||
        p.notes?.toLowerCase().includes(query)
      );
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch(sortBy) {
        case 'date':
          comparison = new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime();
          break;
        case 'amount':
          comparison = (a.amount || 0) - (b.amount || 0);
          break;
        case 'name':
          comparison = (a.biller?.name || '').localeCompare(b.biller?.name || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredPayments(filtered);
    setTotalPages(Math.ceil(filtered.length / ITEMS_PER_PAGE));
    setCurrentPage(1);
  };

  useEffect(() => {
    applyFilters(payments);
  }, [payments, filterMonth, filterMethod, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    load();
  }, []);

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('payments-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'payments' },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setReceiptPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview(null);
    }
  };

  const clearFile = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openModal = (payment?: Partial<any>) => {
    setEditing(payment ? { ...payment, payment_date: payment.payment_date?.split('T')[0] || '' } : emptyPay);
    setReceiptFile(null);
    setReceiptPreview(null);
    setOpen(true);
  };

  const save = async () => {
    clearAll();
    let valid = true;
    if (!editing.biller_id) { setError('biller_id', 'Please select a biller'); valid = false; }
    if (!editing.amount || editing.amount <= 0) { setError('amount', 'Amount must be greater than 0'); valid = false; }
    if (!editing.payment_date) { setError('payment_date', 'Payment date is required'); valid = false; }
    if (!valid) return;
    setSaving(true);
    try {
      if (editing.id) {
        // Update existing payment
        const updateData: any = {
          biller_id: editing.biller_id,
          amount: editing.amount,
          payment_date: editing.payment_date,
          method: editing.method || 'Bank Transfer',
          notes: editing.notes || '',
          updated: new Date().toISOString(),
        };

        // If there's a receipt file, upload it
        if (receiptFile) {
          // For now, just store the filename - you'll need to implement file upload to Supabase Storage
          updateData.receipt = receiptFile.name;
          // TODO: Upload file to Supabase Storage
          // const { data, error } = await supabase.storage.from('receipts').upload(`${editing.id}/${receiptFile.name}`, receiptFile);
        }

        await supabase
          .from('payments')
          .update(updateData)
          .eq('id', editing.id);

        toast('Payment updated');
      } else {
        // Find associated bill
        const bill = bills.find(b => b.biller_id === editing.biller_id);
        
        if (bill) {
          const result = await recordSmartPayment({
            billId: bill.id,
            billerId: editing.biller_id as string,
            amount: editing.amount || 0,
            paymentDate: editing.payment_date || new Date().toISOString().split('T')[0],
            method: editing.method || 'Bank Transfer',
            notes: editing.notes,
            currentBalance: bill.current_balance || 0,
            frequency: bill.frequency || 'monthly',
            nextBillDate: bill.next_bill_date,
          });
          
          // If receipt file exists, we need to update the newly created payment
          if (receiptFile && result.success) {
            const { data: lastPayment } = await supabase
              .from('payments')
              .select('id')
              .eq('biller_id', editing.biller_id)
              .order('created', { ascending: false })
              .limit(1);

            if (lastPayment && lastPayment.length > 0) {
              const receiptData: any = {
                receipt: receiptFile.name,
                updated: new Date().toISOString(),
              };
              await supabase
                .from('payments')
                .update(receiptData)
                .eq('id', lastPayment[0].id);
              // TODO: Upload file to Supabase Storage
            }
          }
          toast(result.message);
        } else {
          // No bill found - create standalone payment
          const paymentData: any = {
            biller_id: editing.biller_id,
            amount: editing.amount,
            payment_date: editing.payment_date,
            method: editing.method || 'Bank Transfer',
            notes: editing.notes || '',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          };

          if (receiptFile) {
            paymentData.receipt = receiptFile.name;
            // TODO: Upload file to Supabase Storage
          }

          await supabase
            .from('payments')
            .insert([paymentData]);

          toast('Payment recorded');
        }
      }
      setOpen(false);
      setEditing(emptyPay);
      setSmartInfo('');
      clearFile();
      clearAll();
      load();
    } catch (e) {
      console.error('Error saving payment:', e);
      toast('Something went wrong', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try { 
      await supabase
        .from('payments')
        .delete()
        .eq('id', id);
      toast('Payment deleted'); 
      setDeleteId(null); 
      load(); 
    }
    catch (error) {
      console.error('Error deleting payment:', error);
      toast('Could not delete', 'error');
    }
  };

  const months = Array.from(new Set(payments.map(p => p.payment_date?.slice(0, 7)))).sort().reverse();
  const methodOptions = Array.from(new Set(payments.map(p => p.method))).filter(Boolean);

  const total = filteredPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredPayments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const totalItems = filteredPayments.length;

  const resetFilters = () => {
    setSearchQuery('');
    setFilterMethod('all');
    setFilterMonth('');
    setSortBy('date');
    setSortOrder('desc');
  };

  const methodColor: Record<string, string> = {
    'Direct Debit': 'text-purple-400', 'Bank Transfer': 'text-sky-400', 'Card': 'text-pink-400',
    'Cash': 'text-emerald-400', 'Standing Order': 'text-orange-400', 'Other': 'text-slate-400'
  };

  const methodBg: Record<string, string> = {
    'Direct Debit': 'bg-purple-500/10 border-purple-500/20', 
    'Bank Transfer': 'bg-sky-500/10 border-sky-500/20', 
    'Card': 'bg-pink-500/10 border-pink-500/20',
    'Cash': 'bg-emerald-500/10 border-emerald-500/20', 
    'Standing Order': 'bg-orange-500/10 border-orange-500/20', 
    'Other': 'bg-slate-500/10 border-slate-500/20'
  };

  const hasActiveFilters = searchQuery || filterMethod !== 'all' || filterMonth;

  if (loading) return <PaymentsSkeleton />;

  // Summary stats
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlyTotal = payments.filter(p => p.payment_date?.startsWith(thisMonth)).reduce((s, p) => s + (p.amount || 0), 0);
  const avgPayment = payments.length > 0 ? totalPaid / payments.length : 0;
  const directDebitCount = payments.filter(p => p.method === 'Direct Debit').length;

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
              <CreditCard size={18} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h1 
                className="text-xl sm:text-2xl font-bold tracking-tight truncate"
                style={{ color: 'var(--color-text)' }}
              >
                Payments
              </h1>
              <p 
                className="text-[10px] sm:text-xs font-medium tracking-wider uppercase"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {filteredPayments.length} records · Total: <span style={{ color: 'var(--color-success)' }}>{fmt(total)}</span>
              </p>
            </div>
          </div>
         <button 
  onClick={() => openModal()} 
  className="btn-primary"
  title="Record Payment"
>
  <Plus size={18} />
</button>
        </div>

        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 mt-3">
          <div className="summary-cell">
            <span className="summary-cell__label">Total Paid</span>
            <span className="summary-cell__value">{fmt(totalPaid)}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">This Month</span>
            <span className="summary-cell__value summary-cell__value--ok">{fmt(monthlyTotal)}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Avg Payment</span>
            <span className="summary-cell__value">{fmt(avgPayment)}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Direct Debits</span>
            <span className={`summary-cell__value ${directDebitCount > 0 ? 'summary-cell__value--warn' : 'summary-cell__value--ok'}`}>{directDebitCount}</span>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex gap-2 sm:gap-3 items-center mb-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 pl-11 pr-11 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_var(--color-accent-bg)]"
              placeholder="Search payments..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-dim)] transition-colors"
                onClick={() => setSearchQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <FilterDropdown
            hasActiveFilters={hasActiveFilters}
            onClearAll={resetFilters}
            triggerLabel="Filters"
            sections={[
              {
                title: 'MONTH',
                type: 'checkbox',
                activeValue: filterMonth,
                onChange: (value) => setFilterMonth(value),
                options: [
                  { value: '', label: 'All Time', count: payments.length },
                  ...months.map(m => ({
                    value: m,
                    label: new Date(m + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
                    count: payments.filter(p => p.payment_date?.startsWith(m)).length
                  }))
                ]
              },
              {
                title: 'METHOD',
                type: 'checkbox',
                activeValue: filterMethod,
                onChange: (value) => setFilterMethod(value),
                options: [
                  { value: 'all', label: 'All Methods', count: payments.length },
                  ...methodOptions.map(method => ({
                    value: method,
                    label: method,
                    count: payments.filter(p => p.method === method).length
                  }))
                ]
              },
              {
                title: 'SORT BY',
                type: 'radio',
                activeValue: sortBy,
                onChange: (value) => setSortBy(value as any),
                options: [
                  { value: 'date', label: '📅 Date' },
                  { value: 'amount', label: '💰 Amount' },
                  { value: 'name', label: '📛 Name' }
                ]
              }
            ]}
          />
        </div>

        {/* ── Active filter chips ── */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mb-3 items-center">
            {filterMonth && (
              <span className="filter-chip">
                📅 {new Date(filterMonth + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                <button className="filter-chip__x" onClick={() => setFilterMonth('')}><X size={11} /></button>
              </span>
            )}
            {filterMethod !== 'all' && (
              <span className="filter-chip">
                💳 {filterMethod}
                <button className="filter-chip__x" onClick={() => setFilterMethod('all')}><X size={11} /></button>
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
        <div className="flex items-center justify-between text-xs text-[var(--color-text-dim)] mb-3">
          <span>
            {totalItems > 0 
              ? `${startIndex + 1}–${Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} of ${totalItems} payments`
              : '0 payments'}
          </span>
          {totalItems > 0 && (
            <span style={{ color: 'var(--color-success)' }} className="font-medium">Total: {fmt(total)}</span>
          )}
        </div>

        {/* ── Cards Grid ── */}
        {currentItems.length === 0 ? (
          <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-2xl p-12 text-center">
            {hasActiveFilters ? (
              <>
                <CreditCard size={32} style={{ color: 'var(--color-text-dim)', margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>No payments match your filters</p>
                <button onClick={resetFilters} style={{ color: 'var(--color-accent)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>Clear all filters</button>
              </>
            ) : (
              <>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <CreditCard size={28} style={{ color: 'var(--color-accent)' }} />
                </div>
                <h3 style={{ color: 'var(--color-text)', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>No payments recorded yet</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 20 }}>Record your first payment to start tracking spending.</p>
                <button className="btn-add" onClick={() => openModal()}>
                  <Plus size={16} /> Record Your First Payment
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4">
            {currentItems.map(p => {
              const biller = p.biller;
              return (
                <div 
                  key={p.id} 
                  className={`bill-card border-l-4 ${methodBg[p.method] || 'border-l-slate-500'}`}
                  style={{ borderLeftColor: p.method === 'Direct Debit' ? '#a78bfa' : p.method === 'Bank Transfer' ? '#38bdf8' : p.method === 'Card' ? '#f472b6' : p.method === 'Cash' ? '#34d399' : p.method === 'Standing Order' ? '#fb923c' : '#94a3b8' }}
                >
                  {/* ── top row ── */}
                  <div className="bill-card__header">
                    <div className="bill-card__title-group">
                      <h3 className="bill-card__name">{biller?.name ?? '—'}</h3>
                      <div className="bill-card__badges">
                        <span className="bill-card__status-badge" style={{ 
                          color: methodColor[p.method] || 'var(--color-text-muted)',
                          background: methodBg[p.method] || 'var(--color-surface-2)',
                          border: `1px solid ${methodBg[p.method] ? 'var(--color-border)' : 'var(--color-border)'}`
                        }}>
                          {p.method}
                        </span>
                        {p.receipt && (
                          <span className="bill-card__status-badge" style={{ 
                            color: 'var(--color-accent)',
                            background: 'var(--color-accent-bg)',
                            border: '1px solid var(--color-accent-border)'
                          }}>
                            <Paperclip size={10} /> Receipt
                          </span>
                        )}
                      </div>
                    </div>

                    {/* action buttons */}
                    <div className="bill-card__actions">
                      {p.receipt && (
                        <button 
                          className="bill-card__btn bill-card__btn--remind" 
                          onClick={() => setViewingReceipt(p)}
                          title="View receipt"
                        >
                          <Eye size={14} />
                        </button>
                      )}
                      <button 
                        className="bill-card__btn bill-card__btn--edit" 
                        onClick={() => openModal(p)}
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        className="bill-card__btn bill-card__btn--delete" 
                        onClick={() => setDeleteId(p.id)}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* ── meta row ── */}
                  <div className="bill-card__meta">
                    <span>📅 {new Date(p.payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>

                  {/* ── data grid ── */}
                  <div className="bill-card__grid">
                    <div className="bill-card__cell">
                      <span className="bill-card__cell-label">Amount</span>
                      <span className="bill-card__cell-value" style={{ color: 'var(--color-success)' }}>{fmt(p.amount)}</span>
                    </div>
                    <div className="bill-card__cell">
                      <span className="bill-card__cell-label">Method</span>
                      <span className="bill-card__cell-value bill-card__cell-value--date">{p.method}</span>
                    </div>
                    <div className="bill-card__cell">
                      <span className="bill-card__cell-label">Date</span>
                      <span className="bill-card__cell-value bill-card__cell-value--date">{new Date(p.payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div className="bill-card__cell">
                      <span className="bill-card__cell-label">Biller</span>
                      <span className="bill-card__cell-value bill-card__cell-value--date">{biller?.category || '—'}</span>
                    </div>
                  </div>

                  {/* ── notes ── */}
                  {p.notes && (
                    <div className="bill-card__notes">
                      <span>📝</span>
                      <span>{p.notes}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 pt-4 pb-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="page-btn"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="page-info">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="page-btn"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── Add/Edit Modal ── */}
        <Modal open={open} onClose={() => { setOpen(false); setEditing(emptyPay); clearFile(); }} title={editing.id ? 'Edit Payment' : 'Record Payment'}>
          <div className="space-y-4">
            <div>
              <label className="label">Biller *</label>
              <select className={`input ${errors.biller_id ? 'border-red-500/60' : ''}`} value={editing.biller_id || ''} onChange={e => {
                const billerId = e.target.value;
                setEditing(p => ({ ...p, biller_id: billerId }));
                clearError('biller_id');
                const bill = bills.find(b => b.biller_id === billerId);
                if (bill) {
                  const freq = bill.frequency;
                  const bal = bill.current_balance;
                  if (freq && freq !== 'one_off') {
                    setSmartInfo(`Balance: £${bal?.toFixed(2) || '0.00'} · ${FREQUENCY_LABELS[freq as keyof typeof FREQUENCY_LABELS] || freq}`);
                    setEditing(p => ({ ...p, biller_id: billerId, amount: bal || 0 }));
                  } else {
                    setSmartInfo(`Balance: £${bal?.toFixed(2) || '0.00'}`);
                  }
                } else {
                  setSmartInfo('');
                }
              }}>
                <option value="">Select a biller...</option>
                {billers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <FieldError message={errors.biller_id} />
              {smartInfo && <p className="text-[10px] sm:text-xs text-sky-400 mt-1">✨ {smartInfo}</p>}
            </div>
            
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
              <div>
                <label className="label">Amount (£) *</label>
                <input type="number" step="0.01" className={`input ${errors.amount ? 'border-red-500/60' : ''}`} placeholder="0.00" value={editing.amount || ''} onChange={e => { setEditing(p => ({ ...p, amount: parseFloat(e.target.value) || 0 })); clearError('amount'); }} />
                <FieldError message={errors.amount} />
              </div>
              <div>
                <label className="label">Date *</label>
                <input type="date" className={`input ${errors.payment_date ? 'border-red-500/60' : ''}`} value={editing.payment_date || ''} onChange={e => { setEditing(p => ({ ...p, payment_date: e.target.value })); clearError('payment_date'); }} />
                <FieldError message={errors.payment_date} />
              </div>
            </div>
            
            <div>
              <label className="label">Payment Method</label>
              <select className="input" value={editing.method || 'Bank Transfer'} onChange={e => setEditing(p => ({ ...p, method: e.target.value }))}>
                {METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            
            <div>
              <label className="label">Notes</label>
              <textarea className="input resize-none" rows={2} placeholder="Reference, receipt notes..." value={editing.notes || ''} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} />
            </div>

            <div>
              <label className="label">Receipt (optional)</label>
              {receiptPreview ? (
                <div className="relative">
                  <img src={receiptPreview} alt="Receipt preview" className="w-full max-h-40 object-contain rounded-xl border border-slate-700 bg-slate-900" />
                  <button onClick={clearFile} className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/80 text-slate-400 hover:text-red-400 transition-colors touch-target"><X size={14} /></button>
                </div>
              ) : receiptFile ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-700 bg-slate-900/60">
                  <FileText size={16} className="text-sky-400 shrink-0" />
                  <p className="text-xs sm:text-sm text-slate-300 truncate flex-1">{receiptFile.name}</p>
                  <button onClick={clearFile} className="p-1 text-slate-500 hover:text-red-400 touch-target"><X size={14} /></button>
                </div>
              ) : editing.receipt ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-700 bg-slate-900/60">
                  <Paperclip size={14} className="text-sky-400 shrink-0" />
                  <p className="text-xs sm:text-sm text-slate-400 truncate flex-1">Current: {editing.receipt as string}</p>
                </div>
              ) : null}
              
              <button onClick={() => fileInputRef.current?.click()} className="btn-secondary w-full justify-center mt-2">
                <Upload size={14} /> {receiptFile || editing.receipt ? 'Replace Receipt' : 'Upload Receipt / Photo'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={handleFileChange} />
              <p className="text-[10px] sm:text-xs text-slate-500 mt-1.5 text-center">Photo, PNG, JPG or PDF · Max 5MB</p>
            </div>

            <div className="flex flex-col xs:flex-row gap-2 pt-2">
              <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? 'Saving...' : editing.id ? 'Save Changes' : 'Record Payment'}
              </button>
              <button onClick={() => { setOpen(false); setEditing(emptyPay); clearFile(); clearAll(); }} className="btn-secondary flex-1 justify-center">
                Cancel
              </button>
            </div>
          </div>
        </Modal>

        {/* ── Delete Modal ── */}
        <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Payment" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-300">This will permanently delete this payment record and its receipt.</p>
            <div className="flex flex-col xs:flex-row gap-2">
              <button onClick={() => deleteId && remove(deleteId)} className="btn-danger flex-1 justify-center">Delete</button>
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </div>
        </Modal>

        {viewingReceipt && <ReceiptPreview payment={viewingReceipt} onClose={() => setViewingReceipt(null)} />}
      </div>
    </div>
  );
}

// Skeleton Component
function PaymentsSkeleton() {
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
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 mt-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="summary-cell">
              <Skeleton className="h-3 w-16 mb-1" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mb-3">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 w-20 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1,2,3,4].map(i => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
