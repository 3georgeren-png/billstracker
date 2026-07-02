// lib/smartPayment.ts (optimized version)
import pb from '@/lib/supabase-adapter';
import { ReminderService } from './services/reminderService';

export type Frequency = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual' | 'one_off';

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Weekly',
  fortnightly: 'Every 2 Weeks',
  monthly: 'Monthly',
  quarterly: 'Every 3 Months',
  annual: 'Annual',
  one_off: 'One-off',
};

export const FREQUENCY_DAYS: Record<Frequency, number | null> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
  quarterly: 90,
  annual: 365,
  one_off: null,
};

export function calcNextDate(fromDate: string, frequency: Frequency): string | null {
  if (frequency === 'one_off') return null;
  const date = new Date(fromDate.replace(' ', 'T'));
  if (isNaN(date.getTime())) return null;

  switch (frequency) {
    case 'weekly': date.setDate(date.getDate() + 7); break;
    case 'fortnightly': date.setDate(date.getDate() + 14); break;
    case 'monthly': date.setMonth(date.getMonth() + 1); break;
    case 'quarterly': date.setMonth(date.getMonth() + 3); break;
    case 'annual': date.setFullYear(date.getFullYear() + 1); break;
  }
  return date.toISOString().split('T')[0];
}

export type PaymentResult = {
  success: boolean;
  message: string;
  isFullyPaid: boolean;
  nextDueDate: string | null;
  remainingBalance: number;
  status: 'paid' | 'partial' | 'paid_oneoff';
  isRecurring: boolean;
  reminderSync?: { deleted: number; created: boolean; reason?: string };
};

export async function recordSmartPayment({
  billId,
  billerId,
  amount,
  paymentDate,
  method,
  notes,
  currentBalance,
  frequency,
  nextBillDate,
}: {
  billId: string;
  billerId: string;
  amount: number;
  paymentDate: string;
  method: string;
  notes?: string;
  currentBalance: number;
  frequency: Frequency;
  nextBillDate?: string;
}): Promise<PaymentResult> {
  try {
    // 1. Record payment (single operation)
    await pb.collection('payments').create({
      biller_id: billerId,
      bill_id: billId,
      amount,
      payment_date: paymentDate,
      method,
      notes: notes || '',
    });

    const isFullyPaid = amount >= currentBalance;
    const remainingBalance = Math.max(0, currentBalance - amount);
    const isRecurring = frequency !== 'one_off';

    // 2. Calculate next due date
    let nextDueDate: string | null = null;
    if (isFullyPaid && isRecurring) {
      nextDueDate = calcNextDate(paymentDate, frequency);
    } else if (!isFullyPaid && nextBillDate) {
      nextDueDate = nextBillDate.split('T')[0];
    } else if (isFullyPaid && !isRecurring) {
      nextDueDate = null;
    }

    // 3. Update bill (single operation)
    const billUpdate: Record<string, any> = {
      current_balance: remainingBalance,
      last_bill_amount: amount,
      last_bill_date: paymentDate,
    };
    if (nextDueDate) {
      billUpdate.next_bill_date = nextDueDate;
    } else if (isFullyPaid && !isRecurring) {
      billUpdate.next_bill_date = null;
    }
    await pb.collection('bills').update(billId, billUpdate);

    // 4. ✅ Sync reminders using ReminderService (optimized)
    const reminderService = ReminderService.getInstance();
    const bill = await pb.collection('billers').getOne(billerId);
    
    const reminderSync = await reminderService.syncRemindersForPayment({
      billerId,
      billId,
      nextDueDate,
      amount: amount,
      billerName: bill.name,
      isRecurring,
      isFullyPaid,
    });

    // 5. Build result message
    let message = '';
    let status: 'paid' | 'partial' | 'paid_oneoff' = 'partial';
    
    if (isFullyPaid && isRecurring && nextDueDate) {
      const nextDate = new Date(nextDueDate);
      const dayName = nextDate.toLocaleDateString('en-GB', { weekday: 'long' });
      message = `✅ Paid! Next due: ${dayName} ${nextDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
      status = 'paid';
    } else if (isFullyPaid && !isRecurring) {
      message = '✅ One-off bill fully paid and settled!';
      status = 'paid_oneoff';
    } else if (isFullyPaid && !nextDueDate) {
      message = '✅ Payment recorded — bill fully paid';
      status = 'paid';
    } else {
      message = `💰 £${amount.toFixed(2)} recorded — £${remainingBalance.toFixed(2)} remaining`;
      status = 'partial';
    }

    return {
      success: true,
      message,
      isFullyPaid,
      nextDueDate,
      remainingBalance,
      status,
      isRecurring,
      reminderSync,
    };
  } catch (e) {
    console.error('Payment error:', e);
    return {
      success: false,
      message: 'Payment failed',
      isFullyPaid: false,
      nextDueDate: null,
      remainingBalance: currentBalance,
      status: 'partial',
      isRecurring: frequency !== 'one_off',
    };
  }
}
