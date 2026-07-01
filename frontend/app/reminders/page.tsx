'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/hooks/useNotifications';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toaster';
import { useAppNotifications } from '@/hooks/useAppNotifications';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { 
  Plus, Bell, Check, Clock, Edit2, Trash2, AlertCircle, 
  RefreshCw, Search, X, Calendar, ChevronRight, 
  Sparkles, Zap, Flag, Coffee, Moon
} from 'lucide-react';
import { FieldError, useFormErrors } from '@/components/ui/FieldError';
import { SwipeToDelete } from '@/components/ui/SwipeToDelete';
import { Skeleton, SkeletonReminderCard } from '@/components/ui/Skeleton';

const fmt = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);
const emptyR: Partial<any> = { biller_id: '', reminder_date: '', type: 'payment_due', message: '', status: 'pending' };
const TYPES = ['payment_due','follow_up','review','custom'];
const typeLabel: Record<string, string> = { 
  payment_due: 'Payment Due', 
  follow_up: 'Follow Up', 
  review: 'Review', 
  custom: 'Custom' 
};

const typeColor: Record<string, string> = {
  payment_due: 'text-red-400 bg-red-500/10 border-red-500/20',
  follow_up: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  review: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  custom: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

const typeIcon: Record<string, React.ReactNode> = {
  payment_due: <Bell size={14} />,
  follow_up: <Flag size={14} />,
  review: <Sparkles size={14} />,
  custom: <Coffee size={14} />,
};

function daysUntil(d: string) { 
  if (!d) return null; 
  const clean = d.replace(' ', 'T');
  const date = new Date(clean);
  if (isNaN(date.getTime())) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(date); target.setHours(0,0,0,0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000); 
}

function getStatusConfig(days: number | null, isDone: boolean) {
  if (isDone) return { label: 'Done', color: 'emerald', icon: Check };
  if (days === null) return { label: 'No date', color: 'slate', icon: Clock };
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: 'red', icon: AlertCircle };
  if (days === 0) return { label: 'Today', color: 'orange', icon: Zap };
  if (days === 1) return { label: 'Tomorrow', color: 'amber', icon: Clock };
  if (days <= 3) return { label: `${days}d left`, color: 'sky', icon: Clock };
  return { label: `${days}d`, color: 'slate', icon: Clock };
}

export default function Reminders() {
  const [reminders, setReminders] = useState<any[]>([]);
  const [filteredReminders, setFilteredReminders] = useState<any[]>([]);
  const [billers, setBillers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<any>>(emptyR);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { sendNotification, permission } = useNotifications();
  const { errors, setError, clearError, clearAll } = useFormErrors();
  const { notifyReminderSet } = useAppNotifications();

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'done' | 'all'>('pending');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBiller, setFilterBiller] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'type' | 'biller'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const load = async () => {
    setLoading(true);
    try {
      // Load reminders with biller info
      const { data: remindersData, error: remindersError } = await supabase
        .from('reminders')
        .select(`
          *,
          biller:billers(id, name, category, is_active)
        `)
        .order('reminder_date', { ascending: true });

      if (remindersError) throw remindersError;

      // Load billers
      const { data: billersData, error: billersError } = await supabase
        .from('billers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (billersError) throw billersError;

      setReminders(remindersData || []);
      setBillers(billersData || []);
      applyFilters(remindersData || []);
    } catch (error) {
      console.error('Error loading reminders:', error);
      toast('Failed to load reminders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (remindersData: any[]) => {
    let filtered = [...remindersData];

    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(r => r.type === filterType);
    }

    if (filterBiller !== 'all') {
      filtered = filtered.filter(r => r.biller_id === filterBiller);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(r => 
        r.biller?.name?.toLowerCase().includes(query) ||
        r.message?.toLowerCase().includes(query) ||
        r.type?.toLowerCase().includes(query)
      );
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch(sortBy) {
        case 'date':
          comparison = new Date(a.reminder_date).getTime() - new Date(b.reminder_date).getTime();
          break;
        case 'type':
          comparison = (a.type || '').localeCompare(b.type || '');
          break;
        case 'biller':
          comparison = (a.biller?.name || '').localeCompare(b.biller?.name || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredReminders(filtered);
  };

  useEffect(() => {
    applyFilters(reminders);
  }, [reminders, filterStatus, filterType, filterBiller, searchQuery, sortBy, sortOrder]);

  useEffect(() => { 
    load(); 
  }, []);

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('reminders-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'reminders' },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const validate = () => {
    clearAll();
    let valid = true;

    if (!editing.reminder_date) {
      setError('reminder_date', 'Please select a reminder date');
      valid = false;
    } else {
      const selectedDate = new Date(editing.reminder_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        setError('reminder_date', 'Reminder date cannot be in the past');
        valid = false;
      }
    }

    if (editing.message && editing.message.length > 200) {
      setError('message', 'Message must be less than 200 characters');
      valid = false;
    }

    return valid;
  };

  const save = async () => {
    if (!validate()) return;
    
    setSaving(true);
    try {
      const data = {
        biller_id: editing.biller_id || '',
        reminder_date: editing.reminder_date,
        type: editing.type || 'payment_due',
        message: editing.message?.trim() || '',
        status: editing.status || 'pending',
        updated: new Date().toISOString(),
      };

      if (editing.id) { 
        await supabase
          .from('reminders')
          .update(data)
          .eq('id', editing.id);
        toast('✅ Reminder updated'); 
        const biller = billers.find(b => b.id === editing.biller_id);
        notifyReminderSet(biller?.name || 'Bill', editing.reminder_date || '');
      } else { 
        data.created = new Date().toISOString();
        await supabase
          .from('reminders')
          .insert([data]);
        toast('✅ Reminder set');
        
        const today = new Date(); 
        today.setHours(0,0,0,0);
        const rDate = new Date((editing.reminder_date as string).replace(' ','T')); 
        rDate.setHours(0,0,0,0);
        const days = Math.ceil((rDate.getTime() - today.getTime()) / 86400000);
        if (days <= 1 && permission === 'granted') {
          sendNotification(
            days === 0 ? '🔔 Reminder set for Today!' : '⚠️ Reminder set for Tomorrow',
            editing.message || typeLabel[editing.type as string] || 'Bill reminder'
          );
        }
      }
      setOpen(false); 
      setEditing(emptyR); 
      clearAll();
      load();
    } catch (error: any) { 
      console.error('Error saving reminder:', error);
      toast(error?.message || 'Something went wrong', 'error'); 
    } finally { 
      setSaving(false); 
    }
  };

  const markDone = async (r: any) => {
    try {
      const newStatus = r.status === 'done' ? 'pending' : 'done';
      await supabase
        .from('reminders')
        .update({ 
          status: newStatus,
          updated: new Date().toISOString(),
        })
        .eq('id', r.id);
      toast(newStatus === 'done' ? '✅ Marked as done' : '🔄 Marked as pending');
      load();
    } catch {
      toast('Could not update reminder', 'error');
    }
  };

  const remove = async (id: string) => {
    try { 
      await supabase
        .from('reminders')
        .delete()
        .eq('id', id);
      toast('Reminder deleted'); 
      setDeleteId(null); 
      load();
    } catch { 
      toast('Could not delete', 'error'); 
    }
  };

  const recreateReminder = async (billerId: string, dueDate: string) => {
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
      
      const reminderDate = new Date(dueDate);
      reminderDate.setDate(reminderDate.getDate() - 3);
      const reminderDateStr = reminderDate.toISOString().split('T')[0];
      
      const biller = billers.find(b => b.id === billerId);
      
      await supabase
        .from('reminders')
        .insert([{
          biller_id: billerId,
          reminder_date: reminderDateStr,
          type: 'payment_due',
          message: `${biller?.name || 'Bill'} - Payment due on ${new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
          status: 'pending',
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        }]);
      
      toast('✅ Reminder recreated');
      load();
    } catch (error) {
      console.error('Recreate reminder error:', error);
      toast('Failed to recreate reminder', 'error');
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterStatus('pending');
    setFilterType('all');
    setFilterBiller('all');
    setSortBy('date');
    setSortOrder('asc');
  };

  const pendingCount = reminders.filter(r => r.status === 'pending').length;
  const doneCount = reminders.filter(r => r.status === 'done').length;
  const hasActiveFilters = searchQuery || filterType !== 'all' || filterBiller !== 'all' || filterStatus !== 'pending';

  // Get unique types for filter
  const typeOptions = Array.from(new Set(reminders.map(r => r.type))).filter(Boolean);
  const billerOptions = Array.from(new Set(reminders.map(r => r.biller_id))).filter(Boolean);

  if (loading) return <RemindersSkeleton />;

  // Summary stats
  const overdueReminders = reminders.filter(r => {
    const days = daysUntil(r.reminder_date);
    return days !== null && days < 0 && r.status === 'pending';
  }).length;

  const todayReminders = reminders.filter(r => {
    const days = daysUntil(r.reminder_date);
    return days !== null && days === 0 && r.status === 'pending';
  }).length;

  const upcomingReminders = reminders.filter(r => {
    const days = daysUntil(r.reminder_date);
    return days !== null && days > 0 && days <= 7 && r.status === 'pending';
  }).length;

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
              <Bell size={18} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h1 
                className="text-xl sm:text-2xl font-bold tracking-tight truncate"
                style={{ color: 'var(--color-text)' }}
              >
                Reminders
              </h1>
              <p 
                className="text-[10px] sm:text-xs font-medium tracking-wider uppercase"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {filteredReminders.length} records · {pendingCount} pending
              </p>
            </div>
          </div>
          <button 
            onClick={() => { 
              setEditing({ 
                biller_id: '', 
                reminder_date: new Date().toISOString().split('T')[0], 
                type: 'payment_due', 
                message: '', 
                status: 'pending' 
              }); 
              clearAll();
              setOpen(true); 
            }} 
            className="btn-primary"
          >
            <Plus size={18} className="sm:w-4 sm:h-4" /> 
            <span className="hidden xs:inline">Add Reminder</span>
            <span className="xs:hidden">Add</span>
          </button>
        </div>

        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 mt-3">
          <div className="summary-cell">
            <span className="summary-cell__label">Pending</span>
            <span className={`summary-cell__value ${pendingCount > 0 ? 'summary-cell__value--warn' : 'summary-cell__value--ok'}`}>{pendingCount}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Done</span>
            <span className="summary-cell__value summary-cell__value--ok">{doneCount}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Overdue</span>
            <span className={`summary-cell__value ${overdueReminders > 0 ? 'summary-cell__value--danger' : 'summary-cell__value--ok'}`}>{overdueReminders}</span>
          </div>
          <div className="summary-cell">
            <span className="summary-cell__label">Today</span>
            <span className={`summary-cell__value ${todayReminders > 0 ? 'summary-cell__value--warn' : 'summary-cell__value--ok'}`}>{todayReminders}</span>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex gap-2 sm:gap-3 items-center mb-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 pl-11 pr-11 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_var(--color-accent-bg)]"
              placeholder="Search reminders..."
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
                  { value: 'pending', label: '📋 Pending', count: pendingCount },
                  { value: 'done', label: '✅ Done', count: doneCount },
                  { value: 'all', label: '📚 All', count: reminders.length },
                ]
              },
              {
                title: 'TYPE',
                type: 'checkbox',
                activeValue: filterType,
                onChange: (value) => setFilterType(value),
                options: [
                  { value: 'all', label: 'All Types', count: reminders.length },
                  ...typeOptions.map(t => ({
                    value: t,
                    label: typeLabel[t] || t,
                    count: reminders.filter(r => r.type === t).length
                  }))
                ]
              },
              {
                title: 'BILLER',
                type: 'checkbox',
                activeValue: filterBiller,
                onChange: (value) => setFilterBiller(value),
                options: [
                  { value: 'all', label: 'All Billers', count: reminders.length },
                  ...billerOptions.map(id => {
                    const biller = billers.find(b => b.id === id);
                    return {
                      value: id,
                      label: biller?.name || 'Unknown',
                      count: reminders.filter(r => r.biller_id === id).length
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
                  { value: 'date', label: '📅 Date' },
                  { value: 'type', label: '📌 Type' },
                  { value: 'biller', label: '🏢 Biller' }
                ]
              }
            ]}
          />
        </div>

        {/* ── Active filter chips ── */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mb-3 items-center">
            {filterStatus !== 'pending' && (
              <span className="filter-chip">
                {filterStatus === 'done' ? '✅ Done' : '📚 All'}
                <button className="filter-chip__x" onClick={() => setFilterStatus('pending')}><X size={11} /></button>
              </span>
            )}
            {filterType !== 'all' && (
              <span className="filter-chip">
                📌 {typeLabel[filterType] || filterType}
                <button className="filter-chip__x" onClick={() => setFilterType('all')}><X size={11} /></button>
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
          <span>{filteredReminders.length} reminder{filteredReminders.length > 1 ? 's' : ''}</span>
          {filteredReminders.length > 0 && (
            <span className="text-[10px]">
              {sortBy === 'date' ? '📅' : sortBy === 'type' ? '📌' : '🏢'} {sortOrder === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>

        {/* ── Cards Grid ── */}
        {filteredReminders.length === 0 ? (
          <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-2xl p-12 text-center">
            {hasActiveFilters ? (
              <>
                <Bell size={32} style={{ color: 'var(--color-text-dim)', margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>No reminders match your filters</p>
                <button onClick={resetFilters} style={{ color: 'var(--color-accent)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>Clear all filters</button>
              </>
            ) : filterStatus === 'pending' ? (
              <>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Bell size={28} style={{ color: 'var(--color-accent)' }} />
                </div>
                <h3 style={{ color: 'var(--color-text)', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>All caught up! 🎉</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 20 }}>No pending reminders. You're on top of all your bills!</p>
                <button className="btn-add" onClick={() => { 
                  setEditing({ 
                    biller_id: '', 
                    reminder_date: new Date().toISOString().split('T')[0], 
                    type: 'payment_due', 
                    message: '', 
                    status: 'pending' 
                  }); 
                  setOpen(true); 
                }}>
                  <Plus size={16} /> Set a Reminder
                </button>
              </>
            ) : filterStatus === 'done' ? (
              <>
                <Check size={32} style={{ color: 'var(--color-text-dim)', margin: '0 auto 12px' }} />
                <h3 style={{ color: 'var(--color-text)', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>No completed reminders</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Complete a reminder to see it here</p>
              </>
            ) : (
              <>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Bell size={28} style={{ color: 'var(--color-accent)' }} />
                </div>
                <h3 style={{ color: 'var(--color-text)', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>No reminders set</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 20 }}>Set reminders for your bills so you never miss a payment deadline again.</p>
                <button className="btn-add" onClick={() => { 
                  setEditing({ 
                    biller_id: '', 
                    reminder_date: new Date().toISOString().split('T')[0], 
                    type: 'payment_due', 
                    message: '', 
                    status: 'pending' 
                  }); 
                  setOpen(true); 
                }}>
                  <Plus size={16} /> Set Your First Reminder
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {filteredReminders.map(r => {
              const days = daysUntil(r.reminder_date);
              const isDone = r.status === 'done';
              const biller = r.biller;
              const statusConfig = getStatusConfig(days, isDone);
              const StatusIcon = statusConfig.icon;
              const isUrgent = days !== null && days <= 2 && !isDone;
              const isOverdue = days !== null && days < 0 && !isDone;
              
              return (
                <div 
                  key={r.id} 
                  className={`bill-card border-l-4 ${
                    isDone 
                      ? 'border-l-emerald-500' 
                      : isOverdue 
                        ? 'border-l-red-500' 
                        : isUrgent 
                          ? 'border-l-amber-500'
                          : 'border-l-sky-500'
                  } ${isDone ? 'opacity-60' : ''}`}
                  style={{ borderLeftColor: isDone ? '#34d399' : isOverdue ? '#f87171' : isUrgent ? '#fbbf24' : '#38bdf8' }}
                >
                  {/* ── top row ── */}
                  <div className="bill-card__header">
                    <div className="bill-card__title-group">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => markDone(r)} 
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isDone 
                              ? 'bg-emerald-500 border-emerald-500' 
                              : 'border-slate-500 hover:border-emerald-500'
                          }`}
                        >
                          {isDone && <Check size={12} className="text-white" />}
                        </button>
                        <h3 className={`bill-card__name ${isDone ? 'line-through text-slate-500' : ''}`}>
                          {biller?.name ?? 'General'}
                        </h3>
                      </div>
                      <div className="bill-card__badges">
                        <span className={`bill-card__status-badge ${typeColor[r.type] || 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                          {typeIcon[r.type]}
                          {typeLabel[r.type]}
                        </span>
                        <span className={`bill-card__status-badge ${
                          isDone 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : isOverdue 
                              ? 'bg-red-500/15 text-red-400 border-red-500/20' 
                              : isUrgent 
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                                : 'bg-slate-700/50 text-slate-400 border-slate-600'
                        }`}>
                          <StatusIcon size={10} />
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>

                    {/* action buttons */}
                    <div className="bill-card__actions">
                      <button 
                        className="bill-card__btn bill-card__btn--remind" 
                        onClick={() => recreateReminder(r.biller_id, r.reminder_date)}
                        title="Recreate reminder"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button 
                        className="bill-card__btn bill-card__btn--edit" 
                        onClick={() => { 
                          setEditing({
                            ...r, 
                            reminder_date: r.reminder_date?.split('T')[0] || ''
                          }); 
                          clearAll();
                          setOpen(true); 
                        }}
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        className="bill-card__btn bill-card__btn--delete" 
                        onClick={() => setDeleteId(r.id)}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* ── message ── */}
                  {r.message && (
                    <div className={`bill-card__notes ${isDone ? 'line-through' : ''}`}>
                      <span>📝</span>
                      <span>{r.message}</span>
                    </div>
                  )}

                  {/* ── data grid ── */}
                  <div className="bill-card__grid">
                    <div className="bill-card__cell">
                      <span className="bill-card__cell-label">Date</span>
                      <span className="bill-card__cell-value bill-card__cell-value--date">
                        {new Date(r.reminder_date).toLocaleDateString('en-GB', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </span>
                    </div>
                    <div className="bill-card__cell">
                      <span className="bill-card__cell-label">Type</span>
                      <span className="bill-card__cell-value bill-card__cell-value--date">{typeLabel[r.type] || r.type}</span>
                    </div>
                    <div className="bill-card__cell">
                      <span className="bill-card__cell-label">Status</span>
                      <span className={`bill-card__cell-value ${isDone ? 'bill-card__cell-value--paid' : ''}`}>
                        {isDone ? 'Done' : 'Pending'}
                      </span>
                    </div>
                    <div className="bill-card__cell">
                      <span className="bill-card__cell-label">Days</span>
                      <span className="bill-card__cell-value bill-card__cell-value--date">
                        {days !== null ? `${days}d` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Add/Edit Modal ── */}
        <Modal 
          open={open} 
          onClose={() => { 
            setOpen(false); 
            setEditing(emptyR); 
            clearAll();
          }} 
          title={editing.id ? 'Edit Reminder' : 'Add Reminder'}
        >
          <div className="space-y-4">
            <div>
              <label className="label">Biller (Optional)</label>
              <select 
                className="input" 
                value={editing.biller_id || ''} 
                onChange={e => setEditing(p => ({ ...p, biller_id: e.target.value }))}
              >
                <option value="">General reminder</option>
                {billers.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
              <div>
                <label className="label">Date *</label>
                <input 
                  type="date" 
                  className={`input ${errors.reminder_date ? 'border-red-500/60' : ''}`} 
                  value={editing.reminder_date || ''} 
                  onChange={e => { 
                    setEditing(p => ({ ...p, reminder_date: e.target.value })); 
                    clearError('reminder_date'); 
                  }} 
                />
                <FieldError message={errors.reminder_date} />
              </div>
              <div>
                <label className="label">Type</label>
                <select 
                  className="input" 
                  value={editing.type || 'payment_due'} 
                  onChange={e => setEditing(p => ({ ...p, type: e.target.value as any }))}
                >
                  {TYPES.map(t => (
                    <option key={t} value={t}>{typeLabel[t]}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <label className="label">Message / Note</label>
              <textarea 
                className={`input resize-none ${errors.message ? 'border-red-500/60' : ''}`}
                rows={3} 
                placeholder="What do you need to remember?" 
                value={editing.message || ''} 
                onChange={e => {
                  setEditing(p => ({ ...p, message: e.target.value }));
                  clearError('message');
                }} 
              />
              <div className="flex justify-between items-center mt-1">
                <FieldError message={errors.message} />
                <span className={`text-[10px] ${(editing.message?.length || 0) > 200 ? 'text-red-400' : 'text-slate-500'}`}>
                  {(editing.message?.length || 0)}/200
                </span>
              </div>
            </div>
            
            <div className="flex flex-col xs:flex-row gap-2 pt-2">
              <button 
                onClick={save} 
                disabled={saving} 
                className="btn-primary flex-1 justify-center"
              >
                {saving ? 'Saving...' : editing.id ? 'Save Changes' : 'Set Reminder'}
              </button>
              <button 
                onClick={() => { 
                  setOpen(false); 
                  setEditing(emptyR); 
                  clearAll(); 
                }} 
                className="btn-secondary flex-1 justify-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>

        {/* ── Delete Modal ── */}
        <Modal 
          open={!!deleteId} 
          onClose={() => setDeleteId(null)} 
          title="Delete Reminder" 
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300">This will permanently delete this reminder.</p>
            <div className="flex flex-col xs:flex-row gap-2">
              <button 
                onClick={() => deleteId && remove(deleteId)} 
                className="btn-danger flex-1 justify-center"
              >
                Delete
              </button>
              <button 
                onClick={() => setDeleteId(null)} 
                className="btn-secondary flex-1 justify-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

// Skeleton Component
function RemindersSkeleton() {
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
