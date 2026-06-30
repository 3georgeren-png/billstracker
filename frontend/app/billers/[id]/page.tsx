'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { ArrowLeft, Phone, CreditCard, RefreshCcw, Bell, FileText, AlertTriangle, Edit2 } from 'lucide-react';
import Link from 'next/link';

const fmt = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);
function fmtDate(d: string) {
  if (!d) return '—';
  const clean = d.replace(' ', 'T');
  const dt = new Date(clean);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-GB');
}

export default function BillerDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [biller, setBiller] = useState<any | null>(null);
  const [bills, setBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [dds, setDDs] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Get biller
        const { data: billerData, error: billerError } = await supabase
          .from('billers')
          .select('*')
          .eq('id', id as string)
          .single();

        if (billerError) throw billerError;
        setBiller(billerData);

        // Get bills for this biller
        const { data: billsData } = await supabase
          .from('bills')
          .select('*')
          .eq('biller_id', id as string)
          .order('created', { ascending: false });

        setBills(billsData || []);

        // Get payments for this biller
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('*')
          .eq('biller_id', id as string)
          .order('payment_date', { ascending: false });

        setPayments(paymentsData || []);

        // Get direct debits for this biller
        const { data: ddsData } = await supabase
          .from('direct_debits')
          .select('*')
          .eq('biller_id', id as string);

        setDDs(ddsData || []);

        // Get reminders for this biller
        const { data: remindersData } = await supabase
          .from('reminders')
          .select('*')
          .eq('biller_id', id as string)
          .order('reminder_date', { ascending: true });

        setReminders(remindersData || []);

      } catch (error) {
        console.error('Error loading biller:', error);
        router.push('/billers');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, router]);

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const activeDD = dds.find((d: any) => d.status === 'active');

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!biller) return null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-xl bg-slate-700/40 hover:bg-slate-700/80 text-slate-400 hover:text-slate-100 transition-all mt-1">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="page-title">{biller.name}</h1>
            {biller.vulnerability_flag && <AlertTriangle size={16} className="text-amber-400" />}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <CategoryBadge category={biller.category} />
            <span className={`text-xs px-2 py-0.5 rounded-full ${biller.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
              {biller.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        <Link href={`/billers`} className="p-2 rounded-xl bg-slate-700/40 hover:bg-slate-700/80 text-slate-400 hover:text-slate-100 transition-all">
          <Edit2 size={16} />
        </Link>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card">
          <p className="text-xs text-slate-400 mb-1">Total Paid</p>
          <p className="text-lg font-bold text-emerald-400">{fmt(totalPaid)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-400 mb-1">Current Balance</p>
          <p className="text-lg font-bold text-slate-100">{fmt(bills[0]?.current_balance || 0)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-400 mb-1">Monthly DD</p>
          <p className="text-lg font-bold text-purple-400">{activeDD ? fmt(activeDD.amount) : '—'}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-400 mb-1">Payments</p>
          <p className="text-lg font-bold text-slate-100">{payments.length}</p>
        </div>
      </div>

      {/* Contact info */}
      {(biller.account_number || biller.contact_info) && (
        <div className="card p-4 flex flex-wrap gap-4">
          {biller.account_number && (
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Account Number</p>
              <p className="text-sm font-medium text-slate-200">{biller.account_number}</p>
            </div>
          )}
          {biller.contact_info && (
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Contact</p>
              <a href={`tel:${biller.contact_info}`} className="text-sm font-medium text-sky-400 flex items-center gap-1">
                <Phone size={12} /> {biller.contact_info}
              </a>
            </div>
          )}
          {biller.notes && (
            <div className="w-full">
              <p className="text-xs text-slate-500 mb-0.5">Notes</p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{biller.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Bill Records */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={16} className="text-sky-400" />
          <h2 className="font-semibold text-slate-100">Bill Records</h2>
        </div>
        {bills.length === 0 ? <p className="text-slate-500 text-sm">No bill records</p> : (
          <div className="space-y-3">
            {bills.map((b: any) => (
              <div key={b.id} className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2 border-b border-slate-700/40 last:border-0 text-sm">
                <div><p className="text-xs text-slate-500">Balance</p><p className="font-semibold text-slate-100">{fmt(b.current_balance)}</p></div>
                <div><p className="text-xs text-slate-500">Last Bill</p><p className="text-slate-300">{fmtDate(b.last_bill_date)}</p></div>
                <div><p className="text-xs text-slate-500">Last Amount</p><p className="text-slate-300">{fmt(b.last_bill_amount)}</p></div>
                <div><p className="text-xs text-slate-500">Next Bill</p><p className="text-slate-300">{fmtDate(b.next_bill_date)}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={16} className="text-emerald-400" />
          <h2 className="font-semibold text-slate-100">Payment History</h2>
        </div>
        {payments.length === 0 ? <p className="text-slate-500 text-sm">No payments yet</p> : (
          <div className="space-y-2">
            {payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-700/40 last:border-0">
                <div>
                  <p className="text-sm text-slate-200">{fmtDate(p.payment_date)}</p>
                  <p className="text-xs text-slate-500">{p.method}</p>
                </div>
                <p className="font-semibold text-emerald-400">{fmt(p.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Direct Debits */}
      {dds.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCcw size={16} className="text-purple-400" />
            <h2 className="font-semibold text-slate-100">Direct Debits</h2>
          </div>
          <div className="space-y-2">
            {dds.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-slate-200">{fmt(d.amount)}/month</p>
                  <p className="text-xs text-slate-500">Collected on the {d.collection_day}th</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${d.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{d.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reminders */}
      {reminders.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-amber-400" />
            <h2 className="font-semibold text-slate-100">Reminders</h2>
          </div>
          <div className="space-y-2">
            {reminders.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-700/40 last:border-0">
                <div>
                  <p className="text-sm text-slate-200">{r.message || r.type?.replace('_', ' ')}</p>
                  <p className="text-xs text-slate-500">{fmtDate(r.reminder_date)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'done' ? 'bg-slate-700 text-slate-500' : 'bg-amber-500/15 text-amber-400'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}