'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Download, FileText, Table, Calendar } from 'lucide-react';
import { toast } from '@/components/ui/Toaster';

const fmt = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);
function fmtDate(d: string) {
  if (!d) return '';
  const dt = new Date(d.replace(' ', 'T'));
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-GB');
}

export default function ExportPage() {
  const [billers, setBillers] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [dds, setDDs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState('');

  useEffect(() => {
    async function load() {
      try {
        // Load billers
        const { data: billersData } = await supabase
          .from('billers')
          .select('*')
          .order('name');

        // Load bills with biller info
        const { data: billsData } = await supabase
          .from('bills')
          .select(`
            *,
            biller:billers(id, name, category)
          `);

        // Load payments with biller info
        const { data: paymentsData } = await supabase
          .from('payments')
          .select(`
            *,
            biller:billers(id, name, category)
          `)
          .order('payment_date', { ascending: false });

        // Load direct debits with biller info
        const { data: ddsData } = await supabase
          .from('direct_debits')
          .select(`
            *,
            biller:billers(id, name, category)
          `);

        setBillers(billersData || []);
        setBills(billsData || []);
        setPayments(paymentsData || []);
        setDDs(ddsData || []);
      } catch (error) {
        console.error('Error loading export data:', error);
        toast('Error loading data', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredPayments = filterMonth
    ? payments.filter(p => p.payment_date?.startsWith(filterMonth))
    : payments;

  const months = Array.from(new Set(payments.map(p => p.payment_date?.slice(0, 7)))).sort().reverse();

  // Export payments as CSV
  const exportPaymentsCSV = () => {
    const rows = [
      ['Date', 'Biller', 'Amount', 'Method', 'Notes'],
      ...filteredPayments.map(p => [
        fmtDate(p.payment_date),
        p.biller?.name ?? '',
        (p.amount || 0).toFixed(2),
        p.method || '',
        p.notes || ''
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    download(csv, `payments-${filterMonth || 'all'}.csv`, 'text/csv');
    toast('✅ Payments CSV downloaded');
  };

  // Export billers as CSV
  const exportBillersCSV = () => {
    const rows = [
      ['Name', 'Category', 'Account Number', 'Contact', 'Current Balance', 'Next Bill Date', 'Notes'],
      ...billers.map(b => {
        const bill = bills.find((bi: any) => bi.biller_id === b.id);
        return [
          b.name,
          b.category || '',
          b.account_number || '',
          b.contact_info || '',
          (bill?.current_balance || 0).toFixed(2),
          bill?.next_bill_date ? fmtDate(bill.next_bill_date) : '',
          b.notes || ''
        ];
      })
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    download(csv, 'billers.csv', 'text/csv');
    toast('✅ Billers CSV downloaded');
  };

  // Export full report as HTML (printable PDF)
  const exportReportPDF = () => {
    const totalPaid = filteredPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const totalDDs = dds.filter((d: any) => d.status === 'active').reduce((s, d) => s + (d.amount || 0), 0);
    const totalOwed = bills.reduce((s, b) => s + (b.current_balance || 0), 0);
    const period = filterMonth
      ? new Date(filterMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      : 'All Time';

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>BillsTracker Report — ${period}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1e293b; }
  h1 { color: #0ea5e9; border-bottom: 2px solid #0ea5e9; padding-bottom: 10px; }
  h2 { color: #334155; margin-top: 30px; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
  .stat { background: #f1f5f9; border-radius: 8px; padding: 15px; text-align: center; }
  .stat-value { font-size: 24px; font-weight: bold; color: #0ea5e9; }
  .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { background: #0ea5e9; color: white; padding: 10px; text-align: left; font-size: 13px; }
  td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  tr:nth-child(even) { background: #f8fafc; }
  .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>📊 BillsTracker Report</h1>
<p style="color:#64748b">Period: ${period} · Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

<div class="summary">
  <div class="stat"><div class="stat-value">${fmt(totalPaid)}</div><div class="stat-label">Total Paid</div></div>
  <div class="stat"><div class="stat-value">${fmt(totalOwed)}</div><div class="stat-label">Total Owed</div></div>
  <div class="stat"><div class="stat-value">${fmt(totalDDs)}</div><div class="stat-label">Monthly DDs</div></div>
</div>

<h2>💰 Payments (${filteredPayments.length})</h2>
<table>
  <tr><th>Date</th><th>Biller</th><th>Amount</th><th>Method</th><th>Notes</th></tr>
  ${filteredPayments.map(p => `<tr><td>${fmtDate(p.payment_date)}</td><td>${p.biller?.name ?? '—'}</td><td><strong>${fmt(p.amount)}</strong></td><td>${p.method || ''}</td><td>${p.notes || ''}</td></tr>`).join('')}
  <tr style="background:#e0f2fe"><td colspan="2"><strong>Total</strong></td><td><strong>${fmt(totalPaid)}</strong></td><td colspan="2"></td></tr>
</table>

<h2>🏢 Billers & Current Balances</h2>
<table>
  <tr><th>Biller</th><th>Category</th><th>Account</th><th>Balance</th><th>Next Bill</th></tr>
  ${billers.map(b => {
    const bill = bills.find((bi: any) => bi.biller_id === b.id);
    return `<tr><td>${b.name}</td><td>${b.category || ''}</td><td>${b.account_number || '—'}</td><td>${fmt(bill?.current_balance || 0)}</td><td>${bill?.next_bill_date ? fmtDate(bill.next_bill_date) : '—'}</td></tr>`;
  }).join('')}
</table>

<h2>🔄 Active Direct Debits</h2>
<table>
  <tr><th>Biller</th><th>Amount</th><th>Collection Day</th><th>Status</th></tr>
  ${dds.filter((d: any) => d.status === 'active').map(d => `<tr><td>${d.biller?.name ?? '—'}</td><td>${fmt(d.amount)}/mo</td><td>${d.collection_day}th</td><td>${d.status}</td></tr>`).join('')}
</table>

<div class="footer">BillsTracker Home Edition · ${new Date().getFullYear()}</div>
</body>
</html>`;

    download(htmlContent, `billstracker-report-${filterMonth || 'all'}.html`, 'text/html');
    toast('✅ Report downloaded — open in browser and print to PDF');
  };

  function download(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="page-title">📤 Export</h1>

      {/* Period filter */}
      <div className="card p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400" />
          <span className="text-sm text-slate-400">Filter by month:</span>
        </div>
        <select className="input max-w-[200px]" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          <option value="">All time</option>
          {months.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>)}
        </select>
      </div>

      {/* Export options */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-5 flex flex-col gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <Table size={20} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">Payments CSV</h3>
            <p className="text-xs text-slate-400 mt-1">{filteredPayments.length} payments · Opens in Excel</p>
          </div>
          <button onClick={exportPaymentsCSV} className="btn-primary justify-center mt-auto">
            <Download size={14} /> Download CSV
          </button>
        </div>

        <div className="card p-5 flex flex-col gap-4">
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 flex items-center justify-center">
            <Table size={20} className="text-sky-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">Billers CSV</h3>
            <p className="text-xs text-slate-400 mt-1">{billers.length} billers · All balances</p>
          </div>
          <button onClick={exportBillersCSV} className="btn-primary justify-center mt-auto">
            <Download size={14} /> Download CSV
          </button>
        </div>

        <div className="card p-5 flex flex-col gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
            <FileText size={20} className="text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">Full Report</h3>
            <p className="text-xs text-slate-400 mt-1">HTML report · Print to PDF</p>
          </div>
          <button onClick={exportReportPDF} className="btn-primary justify-center mt-auto">
            <Download size={14} /> Download Report
          </button>
        </div>
      </div>

      <div className="card p-4 bg-slate-800/30">
        <p className="text-xs text-slate-400">
          💡 <strong className="text-slate-300">To save as PDF:</strong> Download the Full Report → open it in your browser → press <kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-200">Ctrl+P</kbd> → Save as PDF
        </p>
      </div>
    </div>
  );
}