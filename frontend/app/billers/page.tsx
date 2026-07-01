'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { toast } from '@/components/ui/Toaster';
import { 
  Plus, FileText, Edit2, Trash2, Search, 
  ChevronLeft, ChevronRight, X, Building2, 
  AlertTriangle, Users, CheckCircle, Clock 
} from 'lucide-react';
import Link from 'next/link';
import { FieldError, useFormErrors } from '@/components/ui/FieldError';
import { FilterDropdown } from '@/components/ui/FilterDropdown';

const CATEGORIES = ['Water','Council Tax','Energy','Internet','Insurance','Mobile','TV Licence','Other'];
const empty: Partial<any> = { name: '', category: 'Other', account_number: '', contact_info: '', notes: '', vulnerability_flag: false, is_active: true };

export default function Billers() {
  const [billers, setBillers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<any>>(empty);
  const [saving, setSaving] = useState(false);
  const { errors, setError, clearError, clearAll } = useFormErrors();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('billers')
        .select('*')
        .order('name');

      if (error) throw error;
      setBillers(data || []);
      applyFilters(data || []);
    } catch (error) {
      console.error('Error loading billers:', error);
      toast('Failed to load billers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (data: any[]) => {
    let f = [...data];
    
    // Category filter
    if (selectedCategory !== 'all') {
      f = f.filter(b => b.category === selectedCategory);
    }
    
    // Status filter
    if (filterStatus === 'active') {
      f = f.filter(b => b.is_active === true);
    } else if (filterStatus === 'inactive') {
      f = f.filter(b => b.is_active === false);
    }
    
    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      f = f.filter(b => 
        b.name.toLowerCase().includes(q) || 
        b.category.toLowerCase().includes(q) ||
        b.account_number?.toLowerCase().includes(q)
      );
    }
    
    setFiltered(f);
  };

  useEffect(() => {
    load();

    // Subscribe to changes
    const channel = supabase
      .channel('billers-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'billers' },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    applyFilters(billers);
  }, [billers, search, selectedCategory, filterStatus]);

  const save = async () => {
    clearAll();
    let valid = true;
    if (!editing.name?.trim()) { setError('name', 'Provider name is required'); valid = false; }
    if (!valid) return;
    setSaving(true);
    try {
      if (editing.id) {
        const { error } = await supabase
          .from('billers')
          .update({
            name: editing.name,
            category: editing.category,
            account_number: editing.account_number,
            contact_info: editing.contact_info,
            notes: editing.notes,
            vulnerability_flag: editing.vulnerability_flag,
            is_active: editing.is_active,
            updated: new Date().toISOString(),
          })
          .eq('id', editing.id);
        
        if (error) throw error;
        toast('Biller updated');
      } else {
        const { error } = await supabase
          .from('billers')
          .insert([{
            name: editing.name,
            category: editing.category,
            account_number: editing.account_number,
            contact_info: editing.contact_info,
            notes: editing.notes,
            vulnerability_flag: editing.vulnerability_flag || false,
            is_active: editing.is_active !== undefined ? editing.is_active : true,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          }]);
        
        if (error) throw error;
        toast('Biller added');
      }
      setOpen(false); 
      setEditing(empty); 
      clearAll();
      load();
    } catch (error) {
      console.error('Error saving biller:', error);
      toast('Something went wrong', 'error');
    } finally { 
      setSaving(false); 
    }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('billers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast('Biller deleted');
      setDeleteId(null);
      load();
    } catch (error) {
      console.error('Error deleting biller:', error);
      toast('Could not delete biller', 'error');
    }
  };

  const resetFilters = () => { setSelectedCategory('all'); setFilterStatus('all'); setSearch(''); };
  const hasActiveFilters = !!(search || selectedCategory !== 'all' || filterStatus !== 'all');
  
  // Get unique categories for filter
  const categories = ['all', ...new Set(billers.map(b => b.category).filter(Boolean))];
  
  // Stats
  const totalBillers = billers.length;
  const activeBillers = billers.filter(b => b.is_active).length;
  const inactiveBillers = billers.filter(b => !b.is_active).length;
  const vulnerableBillers = billers.filter(b => b.vulnerability_flag).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
              <Building2 size={18} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h1 
                className="text-xl sm:text-2xl font-bold tracking-tight truncate"
                style={{ color: 'var(--color-text)' }}
              >
                Billers
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
            onClick={() => { setEditing(empty); setOpen(true); }} 
            className="btn-primary"
          >
            <Plus size={18} className="sm:w-4 sm:h-4" /> 
            <span className="hidden xs:inline">Add Biller</span>
          </button>
        </div>

        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 mt-3">
          <div className="summary-cell">
            <span className="summary-cell__label">Total Billers</span>
            <span className="summary-cell__value">{totalBillers}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Active</span>
            <span className="summary-cell__value summary-cell__value--ok">{activeBillers}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Inactive</span>
            <span className={`summary-cell__value ${inactiveBillers > 0 ? 'summary-cell__value--warn' : 'summary-cell__value--ok'}`}>{inactiveBillers}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Vulnerable</span>
            <span className={`summary-cell__value ${vulnerableBillers > 0 ? 'summary-cell__value--danger' : 'summary-cell__value--ok'}`}>{vulnerableBillers}</span>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex gap-2 sm:gap-3 items-center mb-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 pl-11 pr-11 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_var(--color-accent-bg)]"
              placeholder="Search billers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button 
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-dim)] transition-colors"
                onClick={() => setSearch('')}
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
                onChange: v => setFilterStatus(v as any),
                options: [
                  { value: 'all', label: 'All', count: billers.length },
                  { value: 'active', label: 'Active', count: billers.filter(b => b.is_active).length },
                  { value: 'inactive', label: 'Inactive', count: billers.filter(b => !b.is_active).length },
                ]
              },
              {
                title: 'CATEGORY', 
                type: 'checkbox', 
                activeValue: selectedCategory,
                onChange: v => setSelectedCategory(v),
                options: [
                  { value: 'all', label: 'All Categories', count: billers.length },
                  ...categories.filter(c => c !== 'all').map(cat => ({
                    value: cat, 
                    label: cat,
                    count: billers.filter(b => b.category === cat).length
                  }))
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
            {selectedCategory !== 'all' && (
              <span className="filter-chip">
                {selectedCategory}
                <button className="filter-chip__x" onClick={() => setSelectedCategory('all')}><X size={11} /></button>
              </span>
            )}
            {search && (
              <span className="filter-chip">
                "{search}"
                <button className="filter-chip__x" onClick={() => setSearch('')}><X size={11} /></button>
              </span>
            )}
            <button className="filter-clear" onClick={resetFilters}>Clear all</button>
          </div>
        )}

        {/* ── Results meta ── */}
        <div className="flex items-center justify-between text-xs text-[var(--color-text-dim)] mb-3">
          <span>{filtered.length} billers</span>
        </div>

        {/* ── Cards Grid ── */}
        {filtered.length === 0 ? (
          <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-2xl p-12 text-center">
            {hasActiveFilters ? (
              <>
                <Building2 size={32} style={{ color: 'var(--color-text-dim)', margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>No billers match your filters</p>
                <button onClick={resetFilters} style={{ color: 'var(--color-accent)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>Clear all filters</button>
              </>
            ) : (
              <>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Building2 size={28} style={{ color: 'var(--color-accent)' }} />
                </div>
                <h3 style={{ color: 'var(--color-text)', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>No billers yet</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 20 }}>Add your first biller to start tracking expenses.</p>
                <button className="btn-add" onClick={() => { setEditing(empty); setOpen(true); }}>
                  <Plus size={16} /> Add Your First Biller
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map(b => (
              <div 
                key={b.id} 
                className="bill-card border-l-4 border-l-sky-500"
                style={{ borderLeftColor: b.is_active ? 'var(--color-success)' : 'var(--color-text-dim)' }}
              >
                {/* ── top row ── */}
                <div className="bill-card__header">
                  <div className="bill-card__title-group">
                    <h3 className="bill-card__name">{b.name}</h3>
                    <div className="bill-card__badges">
                      <span className="bill-card__status-badge" style={{ 
                        color: b.is_active ? 'var(--color-success)' : 'var(--color-text-dim)',
                        background: b.is_active ? 'var(--color-success-bg)' : 'var(--color-surface-2)',
                        border: `1px solid ${b.is_active ? 'var(--color-success-border)' : 'var(--color-border)'}`
                      }}>
                        {b.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {b.vulnerability_flag && (
                        <span className="bill-card__status-badge" style={{ 
                          color: 'var(--color-danger)',
                          background: 'var(--color-danger-bg)',
                          border: '1px solid var(--color-danger-border)'
                        }}>
                          <AlertTriangle size={10} /> Vulnerable
                        </span>
                      )}
                    </div>
                  </div>

                  {/* action buttons */}
                  <div className="bill-card__actions">
                    <button 
                      className="bill-card__btn bill-card__btn--edit" 
                      onClick={() => { setEditing(b); setOpen(true); }}
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      className="bill-card__btn bill-card__btn--delete" 
                      onClick={() => setDeleteId(b.id)}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* ── meta row ── */}
                <div className="bill-card__meta">
                  <CategoryBadge category={b.category} />
                  {b.account_number && <span className="bill-card__meta-dot">·</span>}
                  {b.account_number && <span>Acc: {b.account_number}</span>}
                </div>

                {/* ── data grid ── */}
                <div className="bill-card__grid">
                  <div className="bill-card__cell">
                    <span className="bill-card__cell-label">Category</span>
                    <span className="bill-card__cell-value bill-card__cell-value--date">{b.category}</span>
                  </div>
                  <div className="bill-card__cell">
                    <span className="bill-card__cell-label">Account</span>
                    <span className="bill-card__cell-value bill-card__cell-value--date">{b.account_number || '—'}</span>
                  </div>
                  <div className="bill-card__cell">
                    <span className="bill-card__cell-label">Contact</span>
                    <span className="bill-card__cell-value bill-card__cell-value--date">{b.contact_info || '—'}</span>
                  </div>
                  <div className="bill-card__cell">
                    <span className="bill-card__cell-label">Status</span>
                    <span className={`bill-card__cell-value ${b.is_active ? 'bill-card__cell-value--date' : 'bill-card__cell-value--paid'}`}>
                      {b.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* ── notes ── */}
                {b.notes && (
                  <div className="bill-card__notes">
                    <span>📝</span>
                    <span>{b.notes}</span>
                  </div>
                )}

                {/* ── footer link ── */}
                <Link 
                  href={`/billers/${b.id}`} 
                  className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-accent)] flex items-center gap-1 transition-colors mt-1"
                >
                  View details <ChevronRight size={12} />
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* ── Add/Edit Modal ── */}
        <Modal open={open} onClose={() => { setOpen(false); setEditing(empty); clearAll(); }} title={editing.id ? 'Edit Biller' : 'Add Biller'}>
          <div className="space-y-4">
            <div>
              <label className="label">Provider Name *</label>
              <input className={`input ${errors.name ? 'border-red-500/60' : ''}`} placeholder="e.g. United Utilities" value={editing.name || ''} onChange={e => { setEditing(p => ({ ...p, name: e.target.value })); clearError('name'); }} />
              <FieldError message={errors.name} />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={editing.category || 'Other'} onChange={e => setEditing(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Account Number</label>
                <input className="input" placeholder="123456789" value={editing.account_number || ''} onChange={e => setEditing(p => ({ ...p, account_number: e.target.value }))} />
              </div>
              <div>
                <label className="label">Contact / Phone</label>
                <input className="input" placeholder="0800 123 456" value={editing.contact_info || ''} onChange={e => setEditing(p => ({ ...p, contact_info: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input resize-none" rows={3} placeholder="Any notes..." value={editing.notes || ''} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded accent-sky-500" checked={!!editing.is_active} onChange={e => setEditing(p => ({ ...p, is_active: e.target.checked }))} />
                <span className="text-sm text-slate-300">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded accent-amber-500" checked={!!editing.vulnerability_flag} onChange={e => setEditing(p => ({ ...p, vulnerability_flag: e.target.checked }))} />
                <span className="text-sm text-slate-300 flex items-center gap-1"><AlertTriangle size={12} className="text-amber-400" /> Financial hardship</span>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving...' : editing.id ? 'Save Changes' : 'Add Biller'}</button>
              <button onClick={() => { setOpen(false); setEditing(empty); clearAll(); }} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </Modal>

        {/* ── Delete Modal ── */}
        <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Biller" size="sm">
          <p className="text-sm text-slate-300 mb-5">This will permanently delete this biller. This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => deleteId && remove(deleteId)} className="btn-danger flex-1 justify-center">Delete</button>
            <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
          </div>
        </Modal>

      </div>
    </div>
  );
}
