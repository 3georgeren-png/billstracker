'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getBillers, type Biller } from '@/lib/services/billers';
import { getBills, type Bill } from '@/lib/services/bills';
import { getPayments, type Payment } from '@/lib/services/payments';
import { getReminders, type Reminder } from '@/lib/services/reminders';
import { getDirectDebits, type DirectDebit } from '@/lib/services/directDebits';
import { useNotifications } from '@/hooks/useNotifications';
import { recordSmartPayment, FREQUENCY_LABELS } from '@/lib/smartPayment';
import { useBudget } from '@/hooks/useBudget';
import { BudgetModal } from '@/components/ui/BudgetModal';
import { Target, Edit2, Trash2, Plus } from 'lucide-react';
import Link from 'next/link';
import {
  TrendingUp, Calendar, CreditCard,
  RefreshCcw, Bell, ArrowRight, Wallet, Building2, Zap, Paperclip, Eye, X,
  Smartphone, LayoutDashboard, Clock, CheckCircle2, AlertTriangle,
  ChevronRight, DollarSign, PieChart as PieChartIcon, BarChart3
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toaster';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { useAppNotifications } from '@/hooks/useAppNotifications';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid
} from 'recharts';

// Import auto-SMS functions
import { checkAndSendAutoSms } from '@/lib/autoSms';
import { sendSmsReminder, formatReminderMessage } from '@/lib/sms';

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

function daysUntil(dateStr: string) {
  if (!dateStr) return null;
  const clean = dateStr.replace(" ", "T");
  const d = new Date(clean);
  if (isNaN(d.getTime())) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(d); target.setHours(0,0,0,0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function getReceiptUrl(payment: Payment) {
  if (!payment.receipt) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/receipts/${payment.id}/${payment.receipt}`;
}

function ReceiptPreview({ payment, onClose }: { payment: Payment; onClose: () => void }) {
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
                <button onClick={() => rotate('ccw')} className="p-1.5 sm:p-2 rounded-lg bg-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-600 transition-colors touch-target" title="Rotate left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
                <button onClick={() => rotate('cw')} className="p-1.5 sm:p-2 rounded-lg bg-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-600 transition-colors touch-target" title="Rotate right">
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

const COLORS = ['#38bdf8', '#f59e0b', '#34d399', '#f87171', '#a78bfa', '#f472b6', '#fb923c', '#60a5fa'];

export default function Dashboard() {
  const [billers, setBillers] = useState<Biller[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [dds, setDDs] = useState<DirectDebit[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const { checkAndNotify } = useNotifications();
  const [quickPay, setQuickPay] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [paying, setPaying] = useState(false);
  const [quickReminder, setQuickReminder] = useState<Bill | null>(null);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [quickPayError, setQuickPayError] = useState('');
  const [viewingReceipt, setViewingReceipt] = useState<Payment | null>(null);

  // Budget state
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  const { budgets, loadBudgets, saveBudget, deleteBudget, getCategorySpending, getBudgetProgress } = useBudget();

  const {
    permission,
    requestPermission,
    checkUpcomingBills,
    notifyPaymentRecorded
  } = useAppNotifications();

  // **FIXED & UPGRADED LOAD FUNCTION**
  async function load() {
    setLoading(true);
    try {
      console.log('📊 Dashboard: Starting data load...');

      // Fetch data from services with proper error handling
      const [b, bi, p, d, r] = await Promise.all([
        getBillers().catch(err => {
          console.error('❌ Billers service error:', err);
          return [];
        }),
        getBills().catch(err => {
          console.error('❌ Bills service error:', err);
          return [];
        }),
        getPayments().catch(err => {
          console.error('❌ Payments service error:', err);
          return [];
        }),
        getDirectDebits().catch(err => {
          console.error('❌ DirectDebits service error:', err);
          return [];
        }),
        getReminders().catch(err => {
          console.error('❌ Reminders service error:', err);
          return [];
        }),
      ]);

      console.log('📊 Data loaded:', {
        billers: b?.length || 0,
        bills: bi?.length || 0,
        payments: p?.length || 0,
        directDebits: d?.length || 0,
        reminders: r?.length || 0
      });

      setBillers(b || []);
      setBills(bi || []);
      setPayments(p || []);
      setDDs(d || []);
      setReminders(r || []);

      // Load budgets if available
      try {
        await loadBudgets();
      } catch (budgetErr) {
        console.warn('⚠️ Budgets not loaded:', budgetErr);
      }

      // Check notifications
      if (permission === 'granted') {
        checkUpcomingBills(bi || [], daysUntil);
      }

      // Check reminders
      await checkAndNotify(r || []);

      // Auto-SMS Check
      const phone = localStorage.getItem('bt_phone_number');
      if (phone && bi && bi.length > 0) {
        setTimeout(async () => {
          try {
            const result = await checkAndSendAutoSms(bi, daysUntil);
            if (result.sent) {
              toast('📱 SMS reminder sent automatically!');
            }
          } catch (smsErr) {
            console.warn('⚠️ SMS check error:', smsErr);
          }
        }, 2000);
      }

    } catch (e) {
      console.error('❌ Critical dashboard load error:', e);
      toast('Error loading dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Setup Supabase realtime subscriptions
  const setupSubscriptions = () => {
    const channels = [];

    try {
      const billersChannel = supabase
        .channel('billers-changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'billers' },
          () => load()
        )
        .subscribe();

      const billsChannel = supabase
        .channel('bills-changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'bills' },
          () => load()
        )
        .subscribe();

      const paymentsChannel = supabase
        .channel('payments-changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'payments' },
          () => load()
        )
        .subscribe();

      const ddsChannel = supabase
        .channel('direct_debits-changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'direct_debits' },
          () => load()
        )
        .subscribe();

      const remindersChannel = supabase
        .channel('reminders-changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'reminders' },
          () => load()
        )
        .subscribe();

      channels.push(billersChannel, billsChannel, paymentsChannel, ddsChannel, remindersChannel);
    } catch (e) {
      console.warn('⚠️ Realtime subscriptions setup error:', e);
    }

    return () => {
      channels.forEach(channel => {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.warn('⚠️ Channel cleanup error:', e);
        }
      });
    };
  };

  useEffect(() => {
    load();
    const cleanup = setupSubscriptions();
    return cleanup;
  }, []);

  // 📊 Monthly spending data for chart
  const getMonthlySpending = () => {
    const monthlyData: Record<string, number> = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    months.forEach(m => monthlyData[m] = 0);

    payments.forEach(p => {
      if (p?.payment_date) {
        const date = new Date(p.payment_date);
        const month = months[date.getMonth()];
        if (month) {
          monthlyData[month] = (monthlyData[month] || 0) + (p.amount || 0);
        }
      }
    });

    return months.map(month => ({
      month,
      amount: monthlyData[month] || 0,
    }));
  };

  // 📊 Category spending for pie chart
  const getCategorySpendingForChart = () => {
    const categoryData: Record<string, number> = {};

    bills.forEach(b => {
      if (b) {
        const billWithBiller = b as any;
        const category = billWithBiller.biller?.category || 'Other';
        categoryData[category] = (categoryData[category] || 0) + (b.current_balance || 0);
      }
    });

    return Object.entries(categoryData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  };

  const monthlyData = getMonthlySpending();
  const categoryData = getCategorySpendingForChart();

  const totalBalance = bills.reduce((s, b) => s + (b.current_balance || 0), 0);
  const totalDDs = dds.reduce((s, d) => s + (d.amount || 0), 0);
  const thisMonthPayments = payments.filter(p => {
    if (!p?.payment_date) return false;
    const d = new Date(p.payment_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, p) => s + (p.amount || 0), 0);

  const upcomingBills = bills
    .filter(b => b?.next_bill_date && daysUntil(b.next_bill_date) !== null && daysUntil(b.next_bill_date)! <= 30)
    .sort((a, b) => new Date(a.next_bill_date!).getTime() - new Date(b.next_bill_date!).getTime());

  const handleQuickPay = async () => {
    setQuickPayError('');
    if (!quickPay) return;
    if (!payAmount || parseFloat(payAmount) <= 0) {
      setQuickPayError('Please enter a valid amount greater than £0');
      return;
    }
    if (!payDate) {
      setQuickPayError('Please select a payment date');
      return;
    }
    setPaying(true);
    try {
      const result = await recordSmartPayment({
        billId: quickPay.id,
        billerId: quickPay.biller_id,
        amount: parseFloat(payAmount),
        paymentDate: payDate,
        method: 'Bank Transfer',
        notes: 'Quick payment from dashboard',
        currentBalance: quickPay.current_balance || 0,
        frequency: quickPay.frequency || 'monthly',
        nextBillDate: quickPay.next_bill_date,
      });
      if (result.success) {
        toast(result.message);
        notifyPaymentRecorded(quickPay.biller?.name || 'Bill', parseFloat(payAmount));
      } else {
        toast('Something went wrong', 'error');
      }
      setQuickPay(null);
      setPayAmount('');
    } catch (err) {
      console.error('Quick pay error:', err);
      toast('Something went wrong', 'error');
    }
    finally { setPaying(false); }
  };

  const handleQuickReminder = async (bill: Bill, daysBefore: number) => {
    setReminderSaving(true);
    try {
      if (!bill?.next_bill_date) {
        toast('No bill date available', 'error');
        return;
      }
      const nextDate = new Date(bill.next_bill_date.replace(' ', 'T'));
      nextDate.setDate(nextDate.getDate() - daysBefore);
      const reminderDate = nextDate.toISOString().split('T')[0];
      const billWithBiller = bill as any;
      const billerName = billWithBiller.biller?.name || 'Bill';

      const { error } = await supabase
        .from('reminders')
        .insert([{
          biller_id: bill.biller_id,
          reminder_date: reminderDate,
          type: 'payment_due',
          message: `${billerName} payment due ${daysBefore === 0 ? 'today' : `in ${daysBefore} day${daysBefore > 1 ? 's' : ''}`}`,
          status: 'pending',
        }]);

      if (error) throw error;
      toast(`Reminder set for ${nextDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`);
      setQuickReminder(null);
    } catch (err) {
      console.error('Reminder error:', err);
      toast('Could not set reminder', 'error');
    }
    finally { setReminderSaving(false); }
  };

  if (loading) return <SkeletonDashboard />;

  // Get categories for budget modal
  const categories = [...new Set(bills.map(b => (b as any).biller?.category).filter(Boolean))];

  // ── Dashboard Stats ──
  const overdueCount = bills.filter(b => {
    if (!b?.next_bill_date) return false;
    const d = daysUntil(b.next_bill_date);
    return d !== null && d < 0 && b.current_balance > 0;
  }).length;

  const paidThisMonth = payments.filter(p => {
    if (!p?.payment_date) return false;
    const d = new Date(p.payment_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const upcomingCount = upcomingBills.length;

  return (
    <>
      <div className="space-y-4 sm:space-y-6 md:space-y-8 w-full max-w-full pt-3 sm:pt-4 pb-20 sm:pb-6 px-1 sm:px-0">

        {/* ── SECTION 1: Header ── */}
        <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 sm:gap-3">
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">
              <Clock size={11} className="sm:w-3.5 sm:h-3.5" />
              <span className="truncate">{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            </div>
            <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-100 tracking-tight flex items-center gap-1.5 sm:gap-2">
              <LayoutDashboard size={18} className="sm:w-6 sm:h-6 text-sky-400" />
              <span>Dashboard</span>
            </h1>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors touch-target"
            title="Refresh"
          >
            <RefreshCcw size={14} className="sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* ── SECTION 2: Quick Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 flex items-center justify-between hover:border-sky-500/30 transition-all">
            <div>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium">Total Owed</p>
              <p className="text-sm sm:text-base font-bold text-slate-100">{fmt(totalBalance)}</p>
              <p className="text-[8px] sm:text-[9px] text-slate-500">{bills.length} bills</p>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <Wallet size={13} className="sm:w-3.5 sm:h-3.5 text-sky-400" />
            </div>
          </div>

          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 flex items-center justify-between hover:border-emerald-500/30 transition-all">
            <div>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium">Paid This Month</p>
              <p className="text-sm sm:text-base font-bold text-emerald-400">{fmt(thisMonthPayments)}</p>
              <p className="text-[8px] sm:text-[9px] text-slate-500">{paidThisMonth} payments</p>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 size={13} className="sm:w-3.5 sm:h-3.5 text-emerald-400" />
            </div>
          </div>

          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 flex items-center justify-between hover:border-amber-500/30 transition-all">
            <div>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium">Upcoming</p>
              <p className="text-sm sm:text-base font-bold text-amber-400">{upcomingCount}</p>
              <p className="text-[8px] sm:text-[9px] text-slate-500">due in 30d</p>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Calendar size={13} className="sm:w-3.5 sm:h-3.5 text-amber-400" />
            </div>
          </div>

          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 flex items-center justify-between hover:border-red-500/30 transition-all">
            <div>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium">Overdue</p>
              <p className={`text-sm sm:text-base font-bold ${overdueCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {overdueCount}
              </p>
              <p className="text-[8px] sm:text-[9px] text-slate-500">needs attention</p>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertTriangle size={13} className="sm:w-3.5 sm:h-3.5 text-red-400" />
            </div>
          </div>
        </div>

        {/* ── SECTION 3: Charts (2-column) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Monthly Spending Chart */}
          <div className="card p-3 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
              <BarChart3 size={14} className="sm:w-4 sm:h-4 text-sky-400" />
              <h3 className="font-semibold text-slate-100 text-[11px] sm:text-sm">Monthly Spending</h3>
              <span className="text-[8px] sm:text-[10px] text-slate-500 ml-auto">This year</span>
            </div>
            <div className="h-[160px] sm:h-[200px] md:h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tick={{ fill: '#94a3b8' }} />
                  <YAxis stroke="#94a3b8" fontSize={11} tick={{ fill: '#94a3b8' }} tickFormatter={(value) => `£${value}`} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }}
                    formatter={(value: number) => [`£${value.toFixed(2)}`, 'Spent']}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="amount" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="card p-3 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
              <PieChartIcon size={14} className="sm:w-4 sm:h-4 text-purple-400" />
              <h3 className="font-semibold text-slate-100 text-[11px] sm:text-sm">Spending by Category</h3>
              <span className="text-[8px] sm:text-[10px] text-slate-500 ml-auto">Balances</span>
            </div>
            {categoryData.length === 0 ? (
              <div className="h-[160px] sm:h-[200px] md:h-[240px] flex items-center justify-center">
                <p className="text-xs sm:text-sm text-slate-500">No category data yet</p>
              </div>
            ) : (
              <div className="h-[160px] sm:h-[200px] md:h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={55}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: '9px', color: '#94a3b8' }} formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }}
                      formatter={(value: number) => [`£${value.toFixed(2)}`, 'Balance']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION 4: Upcoming Bills (Full width) ── */}
        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Calendar size={14} className="sm:w-4 sm:h-4 text-sky-400 shrink-0" />
              <h2 className="font-semibold text-slate-100 text-[11px] sm:text-sm truncate">Upcoming Bills</h2>
              <span className="text-[8px] sm:text-[10px] bg-slate-700/50 px-1.5 sm:px-2 py-0.5 rounded-full text-slate-400 shrink-0">
                {upcomingBills.length}
              </span>
            </div>
            <Link href="/bills" className="text-[10px] sm:text-xs text-sky-400 hover:text-sky-300 flex items-center gap-0.5 transition-colors shrink-0">
              View all <ChevronRight size={11} className="sm:w-3.5 sm:h-3.5" />
            </Link>
          </div>

          {upcomingBills.length === 0 ? (
            <div className="text-center py-6 sm:py-8">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-2 sm:mb-3">
                <CheckCircle2 size={20} className="sm:w-6 sm:h-6 text-emerald-400" />
              </div>
              <p className="text-xs sm:text-sm text-slate-500">No bills due in the next 30 days</p>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">You're all caught up! 🎉</p>
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {upcomingBills.slice(0, 5).map(bill => {
                const billWithBiller = bill as any;
                const days = daysUntil(bill.next_bill_date!)!;
                const biller = billWithBiller.biller;
                const isPaid = bill.current_balance === 0;
                const isRecurring = bill.frequency && bill.frequency !== 'one_off';
                const displayAmount = isPaid && isRecurring ? bill.last_bill_amount : bill.current_balance;

                let statusColor = 'text-emerald-400';
                let statusBg = 'bg-emerald-500/10';
                let statusLabel = 'Paid';

                if (!isPaid) {
                  if (days < 0) {
                    statusColor = 'text-red-400';
                    statusBg = 'bg-red-500/10';
                    statusLabel = `${Math.abs(days)}d overdue`;
                  } else if (days <= 3) {
                    statusColor = 'text-amber-400';
                    statusBg = 'bg-amber-500/10';
                    statusLabel = `${days}d left`;
                  } else {
                    statusColor = 'text-sky-400';
                    statusBg = 'bg-sky-500/10';
                    statusLabel = `${days}d`;
                  }
                }

                return (
                  <div key={bill.id} className="flex flex-wrap items-center justify-between py-2 px-1.5 sm:px-2 rounded-xl hover:bg-slate-700/20 transition-colors gap-1 sm:gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${isPaid ? 'bg-emerald-400' : days < 0 ? 'bg-red-400' : days <= 3 ? 'bg-amber-400' : 'bg-sky-400'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                          <p className="text-[11px] sm:text-sm font-medium text-slate-200 truncate max-w-[80px] xs:max-w-[120px] sm:max-w-none">{biller?.name ?? '—'}</p>
                          <span className={`text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full ${statusBg} ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-[9px] sm:text-xs text-slate-500">{new Date(bill.next_bill_date!).toLocaleDateString('en-GB')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto">
                      <p className={`text-[11px] sm:text-sm font-semibold ${isPaid && isRecurring ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                        {fmt(displayAmount)}
                      </p>

                      {(!isPaid || (isRecurring && bill.last_bill_amount > 0 && bill.current_balance === 0)) && (
                        <div className="flex gap-0.5 sm:gap-1">
                          <button
                            onClick={() => { setQuickPay(bill); setPayAmount(String(displayAmount || '')); }}
                            className="p-1 sm:p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition-colors touch-target"
                            title="Quick pay"
                          >
                            <Zap size={10} className="sm:w-3.5 sm:h-3.5" />
                          </button>
                          <button
                            onClick={() => setQuickReminder(bill)}
                            className="p-1 sm:p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-colors touch-target"
                            title="Set reminder"
                          >
                            <Bell size={10} className="sm:w-3.5 sm:h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              const phone = localStorage.getItem('bt_phone_number');
                              if (!phone) {
                                toast('📱 Please add your phone number in Settings', 'error');
                                return;
                              }
                              const lastSent = localStorage.getItem('bt_last_sms_date');
                              const today = new Date().toISOString().split('T')[0];
                              if (lastSent === today) {
                                toast('📱 SMS already sent today (1 per day limit)', 'error');
                                return;
                              }
                              const daysLeft = daysUntil(bill.next_bill_date!);
                              const message = formatReminderMessage(
                                biller?.name || 'Bill',
                                bill.current_balance || displayAmount || 0,
                                new Date(bill.next_bill_date!).toLocaleDateString('en-GB'),
                                daysLeft || 0
                              );
                              const result = await sendSmsReminder(phone, message);
                              if (result.success) {
                                localStorage.setItem('bt_last_sms_date', today);
                                toast('📱 SMS reminder sent!');
                              } else {
                                toast(result.error || 'Failed to send SMS', 'error');
                              }
                            }}
                            className="p-1 sm:p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors touch-target"
                            title="Send SMS reminder"
                          >
                            <Smartphone size={10} className="sm:w-3.5 sm:h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SECTION 5: Two-Column Split ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">

          {/* Reminders */}
          <div className="card p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Bell size={14} className="sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                <h2 className="font-semibold text-slate-100 text-[11px] sm:text-sm truncate">Reminders</h2>
                <span className="text-[8px] sm:text-[10px] bg-slate-700/50 px-1.5 sm:px-2 py-0.5 rounded-full text-slate-400 shrink-0">
                  {reminders.length}
                </span>
              </div>
              <Link href="/reminders" className="text-[10px] sm:text-xs text-sky-400 hover:text-sky-300 flex items-center gap-0.5 transition-colors shrink-0">
                View all <ChevronRight size={11} className="sm:w-3.5 sm:h-3.5" />
              </Link>
            </div>

            {reminders.length === 0 ? (
              <div className="text-center py-4 sm:py-6">
                <p className="text-xs sm:text-sm text-slate-500">No pending reminders</p>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">All caught up! 🎉</p>
              </div>
            ) : (
              <div className="space-y-1.5 sm:space-y-2">
                {reminders.slice(0, 5).map(r => {
                  const reminderWithBiller = r as any;
                  const days = daysUntil(r.reminder_date);
                  const biller = reminderWithBiller.biller;
                  const isUrgent = days !== null && days <= 2;
                  const isOverdue = days !== null && days < 0;

                  return (
                    <div key={r.id} className="flex items-center gap-2 sm:gap-3 py-1.5 sm:py-2 px-1.5 sm:px-2 rounded-xl hover:bg-slate-700/20 transition-colors">
                      <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full shrink-0 ${isOverdue ? 'bg-red-400' : isUrgent ? 'bg-amber-400' : 'bg-sky-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] sm:text-sm font-medium text-slate-200 truncate">{biller?.name ?? 'General'}</p>
                        <p className="text-[9px] sm:text-xs text-slate-400 truncate">{r.message || r.type.replace('_', ' ')}</p>
                      </div>
                      <p className={`text-[9px] sm:text-xs shrink-0 ${isOverdue ? 'text-red-400' : isUrgent ? 'text-amber-400' : 'text-slate-500'}`}>
                        {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days !== null && days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Payments */}
          <div className="card p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <CreditCard size={14} className="sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                <h2 className="font-semibold text-slate-100 text-[11px] sm:text-sm truncate">Recent Payments</h2>
              </div>
              <Link href="/payments" className="text-[10px] sm:text-xs text-sky-400 hover:text-sky-300 flex items-center gap-0.5 transition-colors shrink-0">
                View all <ChevronRight size={11} className="sm:w-3.5 sm:h-3.5" />
              </Link>
            </div>

            {payments.length === 0 ? (
              <div className="text-center py-4 sm:py-6">
                <p className="text-xs sm:text-sm text-slate-500">No payments recorded yet</p>
              </div>
            ) : (
              <div className="space-y-1.5 sm:space-y-2">
                {payments.slice(0, 5).map(p => {
                  const paymentWithBiller = p as any;
                  return (
                    <div key={p.id} className="flex items-center justify-between py-1.5 sm:py-2 px-1.5 sm:px-2 rounded-xl hover:bg-slate-700/20 transition-colors gap-1 sm:gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <CreditCard size={10} className="sm:w-3.5 sm:h-3.5 text-emerald-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                            <p className="text-[11px] sm:text-sm font-medium text-slate-200 truncate max-w-[80px] xs:max-w-[120px] sm:max-w-none">{paymentWithBiller.biller?.name ?? '—'}</p>
                            {p.receipt && (
                              <button
                                onClick={() => setViewingReceipt(p)}
                                className="flex items-center gap-0.5 text-[8px] sm:text-[10px] text-sky-400 hover:text-sky-300 bg-sky-500/10 px-1 sm:px-1.5 py-0.5 rounded-full transition-colors touch-target"
                              >
                                <Paperclip size={8} className="sm:w-2.5 sm:h-2.5" />
                                <span className="hidden xs:inline">Receipt</span>
                              </button>
                            )}
                          </div>
                          <p className="text-[8px] sm:text-xs text-slate-500 truncate">{new Date(p.payment_date).toLocaleDateString('en-GB')} · {p.method}</p>
                        </div>
                      </div>
                      <p className="text-[11px] sm:text-sm font-semibold text-emerald-400 shrink-0">-{fmt(p.amount)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION 6: Budget Progress ── */}
        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Target size={14} className="sm:w-4 sm:h-4 text-purple-400 shrink-0" />
              <h3 className="font-semibold text-slate-100 text-[11px] sm:text-sm truncate">Budget Progress</h3>
              <span className="text-[8px] sm:text-[10px] bg-slate-700/50 px-1.5 sm:px-2 py-0.5 rounded-full text-slate-400 shrink-0">
                {budgets.length}
              </span>
            </div>
            <button
              onClick={() => {
                setEditingBudget(null);
                setBudgetModalOpen(true);
              }}
              className="text-[10px] sm:text-xs text-purple-400 hover:text-purple-300 flex items-center gap-0.5 transition-colors shrink-0"
            >
              <Plus size={11} className="sm:w-3.5 sm:h-3.5" /> Add Budget
            </button>
          </div>

          {budgets.length === 0 ? (
            <div className="text-center py-4 sm:py-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-2 sm:mb-3">
                <Target size={20} className="sm:w-6 sm:h-6 text-purple-400" />
              </div>
              <p className="text-xs sm:text-sm text-slate-500">No budgets set yet</p>
              <button
                onClick={() => {
                  setEditingBudget(null);
                  setBudgetModalOpen(true);
                }}
                className="text-[10px] sm:text-xs text-purple-400 hover:text-purple-300 transition-colors mt-0.5"
              >
                Set your first budget →
              </button>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {getBudgetProgress(getCategorySpending(bills, payments)).map((budget) => {
                const isExceeded = budget.status === 'exceeded';
                const isWarning = budget.status === 'warning';
                const color = isExceeded ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';
                const textColor = isExceeded ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400';

                return (
                  <div key={budget.id} className="bg-slate-700/20 rounded-xl p-2 sm:p-3">
                    <div className="flex flex-wrap items-center justify-between mb-1 gap-1">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-[11px] sm:text-sm font-medium text-slate-200">{budget.category}</span>
                        <span className="text-[8px] sm:text-[10px] text-slate-500">{budget.period}</span>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                        <span className="text-[9px] sm:text-xs text-slate-400">
                          £{budget.spent.toFixed(2)} / £{budget.amount.toFixed(2)}
                        </span>
                        <span className={`text-[9px] sm:text-xs font-medium ${textColor}`}>
                          {Math.round(budget.percentage)}%
                        </span>
                        <div className="flex gap-0.5 sm:gap-1">
                          <button
                            onClick={() => {
                              setEditingBudget(budget);
                              setBudgetModalOpen(true);
                            }}
                            className="p-0.5 sm:p-1 rounded hover:bg-slate-700/60 text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            <Edit2 size={10} className="sm:w-3 sm:h-3" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm('Delete this budget?')) {
                                await deleteBudget(budget.id);
                              }
                            }}
                            className="p-0.5 sm:p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={10} className="sm:w-3 sm:h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-700 rounded-full h-1 sm:h-1.5 overflow-hidden">
                      <div
                        className={`${color} h-1 sm:h-1.5 rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                      />
                    </div>

                    {isExceeded ? (
                      <p className="text-[9px] sm:text-xs text-red-400 mt-1">⚠️ Exceeded by £{(budget.spent - budget.amount).toFixed(2)}</p>
                    ) : (
                      <p className="text-[9px] sm:text-xs text-slate-500 mt-1">£{budget.remaining.toFixed(2)} remaining</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SECTION 7: Empty State ── */}
        {billers.length === 0 && (
          <div className="card p-6 sm:p-8 text-center border-dashed border-slate-600">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-700/30 flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Building2 size={22} className="sm:w-7 sm:h-7 text-slate-500" />
            </div>
            <h3 className="font-semibold text-slate-300 mb-1 text-sm sm:text-base">No billers yet</h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-4">Start by adding your first biller</p>
            <Link href="/billers" className="btn-primary inline-flex text-xs sm:text-sm">
              <Plus size={14} className="sm:w-4 sm:h-4" /> Add your first biller
            </Link>
          </div>
        )}
      </div>

      {/* ── AlertBanner ── */}
      <AlertBanner bills={bills} daysUntil={daysUntil} fmt={fmt} />

      {/* ── Quick Reminder Modal ── */}
      <Modal open={!!quickReminder} onClose={() => setQuickReminder(null)} title="Set Reminder" size="sm">
        {quickReminder && (
          <div className="space-y-4">
            <div className="bg-slate-700/30 rounded-xl p-3">
              <p className="text-xs text-slate-400">Bill</p>
              <p className="font-semibold text-slate-100 text-sm sm:text-base">{(quickReminder as any).biller?.name || 'Unknown'}</p>
              <p className="text-xs text-slate-500">Due: {quickReminder.next_bill_date ? new Date(quickReminder.next_bill_date.replace(' ','T')).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
            </div>
            <p className="text-sm text-slate-400">Remind me:</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'On the day', days: 0 },
                { label: '1 day before', days: 1 },
                { label: '2 days before', days: 2 },
                { label: '3 days before', days: 3 },
                { label: '1 week before', days: 7 },
                { label: '2 weeks before', days: 14 },
              ].map(opt => (
                <button
                  key={opt.days}
                  onClick={() => handleQuickReminder(quickReminder, opt.days)}
                  disabled={reminderSaving}
                  className="btn-secondary justify-center py-2.5 sm:py-3 text-xs sm:text-sm hover:bg-purple-500/20 hover:text-purple-300 hover:border-purple-500/30 transition-all touch-target"
                >
                  <Bell size={13} className="sm:w-3.5 sm:h-3.5" /> {opt.label}
                </button>
              ))}
            </div>
            <button onClick={() => setQuickReminder(null)} className="btn-ghost w-full justify-center text-sm touch-target">Cancel</button>
          </div>
        )}
      </Modal>

      {/* ── Quick Pay Modal ── */}
      <Modal open={!!quickPay} onClose={() => { setQuickPay(null); setQuickPayError(''); }} title="Quick Payment" size="sm">
        {quickPay && (
          <div className="space-y-4">
            <div className="bg-slate-700/30 rounded-xl p-3 space-y-1">
              <p className="text-xs text-slate-400">Paying</p>
              <p className="font-semibold text-slate-100 text-sm sm:text-base">
                {(quickPay as any)?.biller?.name || 'Unknown Biller'}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-xs text-slate-500">Balance: {fmt(quickPay?.current_balance || 0)}</p>
                {quickPay?.frequency && (
                  <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400">
                    🔄 {FREQUENCY_LABELS[quickPay.frequency as any] || quickPay.frequency}
                  </span>
                )}
              </div>
              {quickPay?.frequency && quickPay.frequency !== 'one_off' && (
                <p className="text-[10px] sm:text-xs text-emerald-400/70">Next date will auto-update after payment</p>
              )}
            </div>
            <div>
              <label className="label">Amount (£)</label>
              <input type="number" step="0.01" className="input" value={payAmount} onChange={e => { setPayAmount(e.target.value); setQuickPayError(''); }} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
            {quickPayError && (
              <p className="text-xs text-red-400 flex items-center gap-1">⚠ {quickPayError}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={handleQuickPay} disabled={paying} className="btn-primary flex-1 justify-center touch-target">
                <Zap size={14} /> {paying ? 'Recording...' : 'Record Payment'}
              </button>
              <button onClick={() => { setQuickPay(null); setQuickPayError(''); }} className="btn-secondary touch-target">Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Receipt Viewer ── */}
      {viewingReceipt && <ReceiptPreview payment={viewingReceipt} onClose={() => setViewingReceipt(null)} />}

      {/* ── Budget Modal ── */}
      <BudgetModal
        isOpen={budgetModalOpen}
        onClose={() => {
          setBudgetModalOpen(false);
          setEditingBudget(null);
        }}
        onSave={saveBudget}
        editing={editingBudget}
        categories={categories}
      />
    </>
  );
}
