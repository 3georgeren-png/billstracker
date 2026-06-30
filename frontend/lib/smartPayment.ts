'use client';
import pb from '@/lib/supabase-adapter';

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
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'fortnightly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'annual':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  return date.toISOString().split('T')[0];
}

export type PaymentResult = {
  success: boolean;
  message: string;
  isFullyPaid: boolean;
  nextDueDate: string | null;
  remainingBalance: number;
  status?: 'paid' | 'partial' | 'paid_oneoff';
  isRecurring?: boolean;
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
    // 1. Record the payment
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

    // 2. Calculate next due date if fully paid
    let nextDueDate: string | null = null;
    
    if (isFullyPaid && isRecurring) {
      nextDueDate = calcNextDate(paymentDate, frequency);
    } else if (!isFullyPaid && nextBillDate) {
      nextDueDate = nextBillDate.split('T')[0];
    } else if (isFullyPaid && !isRecurring) {
      nextDueDate = null;
    }

    // 3. Update bill record
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

    // 4. Auto-create reminder for next due date (3 days before) - WITH AMOUNT
    if (nextDueDate && isFullyPaid && isRecurring) {
      try {
        // Delete ALL old pending reminders for this biller
        const oldReminders = await pb.collection('reminders').getFullList({
          filter: `biller_id="${billerId}" && status="pending"`,
        });
        
        for (const r of oldReminders) {
          try {
            await pb.collection('reminders').delete(r.id);
          } catch (e) {}
        }
      } catch (e) {}

      // Create new reminder 3 days before next due date
      const reminderDate = new Date(nextDueDate);
      reminderDate.setDate(reminderDate.getDate() - 3);
      const reminderDateStr = reminderDate.toISOString().split('T')[0];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const reminderDateObj = new Date(reminderDateStr);
      reminderDateObj.setHours(0, 0, 0, 0);
      
      if (reminderDateObj >= today) {
        try {
          // Get bill and biller info for the reminder message
          const bill = await pb.collection('bills').getOne(billId);
          const biller = await pb.collection('billers').getOne(billerId);
          
          const formattedAmount = new Intl.NumberFormat('en-GB', { 
            style: 'currency', 
            currency: 'GBP' 
          }).format(bill.last_bill_amount || amount);
          
          await pb.collection('reminders').create({
            biller_id: billerId,
            reminder_date: reminderDateStr,
            type: 'payment_due',
            message: `${biller.name} - ${formattedAmount} due on ${new Date(nextDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
            status: 'pending',
          });
        } catch (e) {
          console.log('⚠️ Could not create reminder:', e);
        }
      }
    }

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

// Helper function to update a bill when a new bill arrives
export async function updateBillWithNewAmount({
  billId,
  newAmount,
  billDate,
}: {
  billId: string;
  newAmount: number;
  billDate?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const bill = await pb.collection('bills').getOne(billId);
    const isRecurring = bill.frequency && bill.frequency !== 'one_off';
    
    if (!isRecurring) {
      return { success: false, message: 'This is not a recurring bill' };
    }

    const updateData: Record<string, any> = {
      current_balance: newAmount,
      last_bill_amount: newAmount,
    };
    
    if (billDate) {
      updateData.last_bill_date = billDate;
    }

    await pb.collection('bills').update(billId, updateData);
    
    return { 
      success: true, 
      message: `✅ Bill updated with new amount: ${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(newAmount)}` 
    };
  } catch (error) {
    console.error('Update bill error:', error);
    return { success: false, message: 'Failed to update bill' };
  }
}

// Helper function to get bill status
export function getBillStatus(bill: { 
  current_balance: number; 
  frequency: Frequency; 
  next_bill_date?: string;
  last_bill_amount?: number;
}) {
  const isPaid = bill.current_balance === 0;
  const isRecurring = bill.frequency !== 'one_off';
  const displayAmount = isPaid && isRecurring ? bill.last_bill_amount || 0 : bill.current_balance;
  
  return {
    isPaid,
    isRecurring,
    displayAmount,
    status: isPaid ? 'paid' : 'pending',
  };
}