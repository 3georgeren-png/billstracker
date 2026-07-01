'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toaster';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { 
  Plus, RefreshCcw, Edit2, Trash2, Pause, Play, 
  Search, X, Calendar, CreditCard, AlertCircle
} from 'lucide-react';
import { FieldError, useFormErrors } from '@/components/ui/FieldError';
import { Skeleton } from '@/components/ui/Skeleton';

const fmt = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);
const emptyDD: Partial<any> = { biller_id: '', amount: 0, collection_day: 1, next_dd_date: '', status: 'active', notes: '' };

export default function DirectDebits() {
  const [dds, setDDs] = useState<any[]>([]);
  const [filteredDDs, setFilteredDDs] = useState<any[]>([]);
  const [billers, setBillers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<any>>(emptyDD);
  const [saving, setSaving] = useState(false);
  const { errors, setError, clearError, clearAll } = useFormErrors();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'paused' | 'cancelled' | 'all'>('all');
  const [filterBiller, setFilterBiller] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'amount' | 'day' | 'biller'>('amount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const load = async () => {
    setLoading(true);
    try {
      // Load direct debits with biller info
      const { data: ddsData, error: ddsError } = await supabase
        .from('direct_debits')
        .select(`
          *,
          biller:billers(id, name, category, is_active)
        `)
        .order('collection_day', { ascending: true });

      if (ddsError) throw ddsError;

      // Load billers
      const { data: billersData, error: billersError } = await supabase
        .from('billers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (billersError) throw billersError;

      setDDs(ddsData || []);
      setBillers(billersData || []);
      applyFilters(ddsData || []);
    } catch (error) {
      console.error('Error loading direct debits:', error);
      toast('Failed to load direct debits', 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (data: any[]) => {
    let filtered = [...data];

    if (filterStatus !== 'all') {
      filtered = filtered.filter(d => d.status === filterStatus);
    }

    if (filterBiller !== 'all') {
      filtered = filtered.filter(d => d.biller_id === filterBiller);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(d => 
        d.biller?.name?.toLowerCase().includes(query) ||
        d.notes?.toLowerCase().includes(query)
      );
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch(sortBy) {
        case 'amount':
          comparison = (a.amount || 0) - (b.amount || 0);
          break;
        case 'day':
          comparison = (a.collection_day || 0) - (b.collection_day || 0);
          break;
        case 'biller':
          comparison = (a.biller?.name || '').localeCompare(b.biller?.name || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredDDs(filtered);
  };

  useEffect(() => {
    applyFilters(dds);
  }, [dds, filterStatus, filterBiller, searchQuery, sortBy, sortOrder]);

  useEffect(() => { 
    load(); 
  }, []);

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('direct_debits-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'direct_debits' },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const save = async () => {
    clearAll();
    let valid = true;
    if (!editing.biller_id) { setError('biller_id', 'Please select a biller'); valid = false; }
    if (!editing.amount || editing.amount <= 0) { setError('amount', 'Amount must be greater than 0'); valid = false; }
    if (!editing.collection_day || editing.collection_day < 1 || editing.collection_day > 31) { setError('collection_day', 'Enter a valid day (1-31)'); valid = false; }
    if (!valid) return;
    setSaving(true);
    try {
      if (editing.id) {
        await supabase
          .from('direct_debits')
          .update({
            biller_id: editing.biller_id,
            amount: editing.amount,
            collection_day: editing.collection_day,
            next_dd_date: editing.next_dd_date || null,
            status: editing.status || 'active',
            notes: editing.notes || '',
            updated: new Date().toISOString(),
          })
          .eq('id', editing.id);
        toast('Direct debit updated');
      } else {
        await supabase
          .from('direct_debits')
          .insert([{
            biller_id: editing.biller_id,
            amount: editing.amount,
            collection_day: editing.collection_day,
            next_dd_date: editing.next_dd_date || null,
            status: editing.status || 'active',
            notes: editing.notes || '',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          }]);
        toast('Direct debit added');
      }
      setOpen(false); 
      setEditing(emptyDD); 
      clearAll();
      load();
    } catch (error) {
      console.error('Error saving direct debit:', error);
      toast('Something went wrong', 'error');
    }
    finally { setSaving(false); }
  };

  const toggleStatus = async (dd: any) => {
    const newStatus = dd.status === 'active' ? 'paused' : 'active';
    try {
      await supabase
        .from('direct_debits')
        .update({ 
          status: newStatus,
          updated: new Date().toISOString(),
        })
        .eq('id', dd.id);
      toast(`DD ${newStatus === 'active' ? 'resumed' : 'paused'}`);
      load();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast('Failed to update status', 'error');
    }
  };

  const remove = async (id: string) => {
    try { 
      await supabase
        .from('direct_debits')
        .delete()
        .eq('id', id);
      toast('DD deleted'); 
      setDeleteId(null); 
      load(); 
    }
    catch (error) {
      console.error('Error deleting direct debit:', error);
      toast('Could not delete', 'error');
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setFilterBiller('all');
    setSortBy('amount');
    setSortOrder('desc');
  };

  const active = dds.filter(d => d.status === 'active');
  const totalMonthly = active.reduce((s, d) => s + (d.amount || 0), 0);
  const pausedCount = dds.filter(d => d.status === 'paused').length;
  const cancelledCount = dds.filter(d => d.status === 'cancelled').length;
  const hasActiveFilters = Boolean(searchQuery || filterStatus !== 'all' || filterBiller !== 'all');

  const statusColor: Record<string, string> = { 
    active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', 
    paused: 'text-amber-400 bg-amber-500/10 border-amber-500/20', 
    cancelled: 'text-red-400 bg-red-500/10 border-red-500/20' 
  };

  const statusBorderColor: Record<string, string> = {
    active: 'border-l-emerald-500',
    paused: 'border-l-amber-500',
    cancelled: 'border-l-red-500',
  };

  const statusBarColor: Record<string, string> = {
    active: '#34d399',
    paused: '#fbbf24',
    cancelled: '#f87171',
  };

  // Get unique billers for filter
  const billerOptions = Array.from(new Set(dds.map(d => d.biller_id))).filter(Boolean);

  if (loading) return <DirectDebitsSkeleton />;

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
              <RefreshCcw size={18} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h1 
                className="text-xl sm:text-2xl font-bold tracking-tight truncate"
                style={{ color: 'var(--color-text)' }}
              >
                Direct Debits
              </h1>
              <p 
                className="text-[10px] sm:text-xs font-medium tracking-wider uppercase"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {filteredDDs.length} records · Monthly total: <span style={{ color: 'var(--color-success)' }}>{fmt(totalMonthly)}</span>
              </p>
            </div>
          </div>
         <button 
  onClick={() => { setEditing(emptyDD); setOpen(true); }} 
  className="btn-primary"
  title="Add Direct Debit"
>
  <Plus size={18} />
</button>
        </div>

        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 mt-3">
          <div className="summary-cell">
            <span className="summary-cell__label">Monthly Total</span>
            <span className="summary-cell__value" style={{ color: 'var(--color-accent)' }}>{fmt(totalMonthly)}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Active</span>
            <span className="summary-cell__value summary-cell__value--ok">{active.length}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Paused</span>
            <span className={`summary-cell__value ${pausedCount > 0 ? 'summary-cell__value--warn' : 'summary-cell__value--ok'}`}>{pausedCount}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Cancelled</span>
            <span className={`summary-cell__value ${cancelledCount > 0 ? 'summary-cell__value--danger' : 'summary-cell__value--ok'}`}>{cancelledCount}</span>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex gap-2 sm:gap-3 items-center mb-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 pl-11 pr-11 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_var(--color-accent-bg)]"
              placeholder="Search direct debits..."
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
                title: 'STATUS',
                type: 'radio',
                activeValue: filterStatus,
                onChange: (value) => setFilterStatus(value as any),
                options: [
                  { value: 'all', label: 'All', count: dds.length },
                  { value: 'active', label: '✅ Active', count: active.length },
                  { value: 'paused', label: '⏸️ Paused', count: pausedCount },
                  { value: 'cancelled', label: '❌ Cancelled', count: cancelledCount },
                ]
              },
              {
                title: 'BILLER',
                type: 'checkbox',
                activeValue: filterBiller,
                onChange: (value) => setFilterBiller(value),
                options: [
                  { value: 'all', label: 'All Billers', count: dds.length },
                  ...billerOptions.map(id => {
                    const biller = billers.find(b => b.id === id);
                    return {
                      value: id,
                      label: biller?.name || 'Unknown',
                      count: dds.filter(d => d.biller_id === id).length
                    };
                  })
                ]
              },
              {
                title: 'SORT BY',
                type: 'radio',
                activeValue: sortBy,
                onChange: (value) => setSortBy(value as any),
                options: [
                  { value: 'amount', label: '💰 Amount' },
                  { value: 'day', label: '📅 Collection Day' },
                  { value: 'biller', label: '🏢 Biller' }
                ]
              }
            ]}
          />
        </div>

        {/* ── Active filter chips ── */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mb-3 items-center">
            {filterStatus !== 'all' && (
              <span className="filter-chip">
                {filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}
                <button className="filter-chip__x" onClick={() => setFilterStatus('all')}><X size={11} /></button>
              </span>
            )}
            {filterBiller !== 'all' && (
              <span className="filter-chip">
                🏢 {billers.find(b => b.id === filterBiller)?.name}
                <button className="filter-chip__x" onClick={() => setFilterBiller('all')}><X size={11} /></button>
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
          <span>{filteredDDs.length} direct debit{filteredDDs.length > 1 ? 's' : ''}</span>
          {filteredDDs.length > 0 && (
            <span className="text-[10px]">
              {sortBy === 'amount' ? '💰' : sortBy === 'day' ? '📅' : '🏢'} {sortOrder === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>

        {/* ── Cards Grid ── */}
        {filteredDDs.length === 0 ? (
          <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-2xl p-12 text-center">
            {hasActiveFilters ? (
              <>
                <RefreshCcw size={32} style={{ color: 'var(--color-text-dim)', margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>No direct debits match your filters</p>
                <button onClick={resetFilters} style={{ color: 'var(--color-accent)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>Clear all filters</button>
              </>
            ) : (
              <>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <RefreshCcw size={28} style={{ color: 'var(--color-accent)' }} />
                </div>
                <h3 style={{ color: 'var(--color-text)', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>No direct debits set up</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 20 }}>Add your first direct debit to automate your bill payments.</p>
                <button className="btn-add" onClick={() => { setEditing(emptyDD); setOpen(true); }}>
                  <Plus size={16} /> Add Your First Direct Debit
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {filteredDDs.map(dd => {
              const biller = dd.biller;
              const status = dd.status || 'active';
              const daySuffix = ['st','nd','rd'][dd.collection_day - 1] || 'th';
              
              return (
                <div 
                  key={dd.id} 
                  className={`bill-card border-l-4 ${statusBorderColor[status] || 'border-l-slate-500'}`}
                  style={{ borderLeftColor: statusBarColor[status] || '#94a3b8' }}
                >
                  {/* ── top row ── */}
                  <div className="bill-card__header">
                    <div className="bill-card__title-group">
                      <h3 className="bill-card__name">{biller?.name ?? '—'}</h3>
                      <div className="bill-card__badges">
                        <span className={`bill-card__status-badge ${statusColor[status] || 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                          {status === 'active' ? '✅' : status === 'paused' ? '⏸️' : '❌'} {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </div>
                    </div>

                    {/* action buttons */}
                    <div className="bill-card__actions">
                      <button 
                        className="bill-card__btn bill-card__btn--remind" 
                        onClick={() => toggleStatus(dd)}
                        title={status === 'active' ? 'Pause' : 'Resume'}
                      >
                        {status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <button 
                        className="bill-card__btn bill-card__btn--edit" 
                        onClick={() => { setEditing({...dd, next_dd_date: dd.next_dd_date?.split('T')[0] || ''}); setOpen(true); }}
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        className="bill-card__btn bill-card__btn--delete" 
                        onClick={() => setDeleteId(dd.id)}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* ── meta row ── */}
                  <div className="bill-card__meta">
                    <span>📅 Collects on {dd.collection_day}{daySuffix} of each month</span>
                  </div>

                  {/* ── data grid ── */}
                  <div className="bill-card__grid">
                    <div className="bill-card__cell">
                      <span className="bill-card__cell-label">Amount</span>
                      <span className="bill-card__cell-value" style={{ color: 'var(--color-accent)' }}>{fmt(dd.amount)}</span>
                    </div>
                    <div className="bill-card__cell">
                      <span className="bill-card__cell-label">Collection Day</span>
                      <span className="bill-card__cell-value bill-card__cell-value--date">{dd.collection_day}{daySuffix}</span>
                    </div>
                    <div className="bill-card__cell">
                      <span className="bill-card__cell-label">Next DD</span>
                      <span className="bill-card__cell-value bill-card__cell-value--date">
                        {dd.next_dd_date ? new Date(dd.next_dd_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                      </span>
                    </div>
                    <div className="bill-card__cell">
                      <span className="bill-card__cell-label">Status</span>
                      <span className={`bill-card__cell-value ${status === 'active' ? '' : 'bill-card__cell-value--paid'}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </div>
                  </div>

                  {/* ── notes ── */}
                  {dd.notes && (
                    <div className="bill-card__notes">
                      <span>📝</span>
                      <span>{dd.notes}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Add/Edit Modal ── */}
        <Modal open={open} onClose={() => { setOpen(false); setEditing(emptyDD); }} title={editing.id ? 'Edit Direct Debit' : 'Add Direct Debit'}>
          <div className="space-y-4">
            <div>
              <label className="label">Biller *</label>
              <select className={`input ${errors.biller_id ? 'border-red-500/60' : ''}`} value={editing.biller_id || ''} onChange={e => { setEditing(p => ({ ...p, biller_id: e.target.value })); clearError('biller_id'); }}>
                <option value="">Select a biller...</option>
                {billers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <FieldError message={errors.biller_id} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Amount (£) *</label>
                <input type="number" step="0.01" className={`input ${errors.amount ? 'border-red-500/60' : ''}`} placeholder="0.00" value={editing.amount || ''} onChange={e => { setEditing(p => ({ ...p, amount: parseFloat(e.target.value) || 0 })); clearError('amount'); }} />
                <FieldError message={errors.amount} />
              </div>
              <div>
                <label className="label">Collection Day *</label>
                <input type="number" min="1" max="31" className={`input ${errors.collection_day ? 'border-red-500/60' : ''}`} placeholder="5" value={editing.collection_day || ''} onChange={e => { setEditing(p => ({ ...p, collection_day: parseInt(e.target.value) || 1 })); clearError('collection_day'); }} />
                <FieldError message={errors.collection_day} />
              </div>
            </div>
            <div>
              <label className="label">Next DD Date</label>
              <input type="date" className="input" value={editing.next_dd_date || ''} onChange={e => setEditing(p => ({ ...p, next_dd_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={editing.status || 'active'} onChange={e => setEditing(p => ({ ...p, status: e.target.value as any }))}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input resize-none" rows={2} value={editing.notes || ''} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex flex-col xs:flex-row gap-2 pt-2">
              <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving...' : editing.id ? 'Save Changes' : 'Add DD'}</button>
              <button onClick={() => { setOpen(false); setEditing(emptyDD); clearAll(); }} className="btn-secondary flex-1 justify-center">Cancel</button>
            </div>
          </div>
        </Modal>

        {/* ── Delete Modal ── */}
        <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Direct Debit" size="sm">
          <p className="text-sm text-slate-300 mb-5">This will permanently delete this direct debit.</p>
          <div className="flex flex-col xs:flex-row gap-2">
            <button onClick={() => deleteId && remove(deleteId)} className="btn-danger flex-1 justify-center">Delete</button>
            <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
          </div>
        </Modal>

      </div>
    </div>
  );
}

// Skeleton Component
function DirectDebitsSkeleton() {
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
