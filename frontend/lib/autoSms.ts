// lib/autoSms.ts
import { sendSmsReminder, formatBulkReminderMessage, getBillsNeedingAttention } from './sms';

// Add this flag to prevent duplicate sends
let isSending = false;

export async function checkAndSendAutoSms(
  bills: any[], 
  daysUntil: (d: string) => number | null
): Promise<{ sent: boolean; message?: string }> {
  
  // Prevent duplicate sends
  if (isSending) {
    console.log('⏰ SMS already being sent, skipping...');
    return { sent: false, message: 'Already sending' };
  }
  
  isSending = true;
  
  try {
    console.log('🔍 Checking for auto-SMS...');
    console.log('📊 Total bills:', bills.length);

    // Check if phone number is set
    const phone = localStorage.getItem('bt_phone_number');
    if (!phone) {
      console.log('❌ No phone number set');
      return { sent: false, message: 'No phone number set' };
    }

    // Check if SMS already sent today
    const today = new Date().toISOString().split('T')[0];
    const lastSent = localStorage.getItem('bt_last_sms_date');
    if (lastSent === today) {
      console.log('⏰ SMS already sent today');
      return { sent: false, message: 'Already sent today' };
    }

    // ✅ Get ALL bills needing attention (overdue + due within 7 days)
    const billsNeedingAttention = getBillsNeedingAttention(bills, daysUntil);
    
    if (billsNeedingAttention.length === 0) {
      console.log('✅ No bills need attention');
      return { sent: false, message: 'No urgent bills' };
    }

    console.log(`📋 ${billsNeedingAttention.length} bills need attention`);
    
    // Log bill names for debugging
    console.log('📋 Bills:', billsNeedingAttention.map(b => `${b.name}: £${b.amount}`).join(', '));

    // ✅ Format ALL bills into one message
    const message = formatBulkReminderMessage(billsNeedingAttention);
    console.log('📝 Message:', message);
    console.log('📝 Message length:', message.length, 'characters');

    // Send SMS
    const result = await sendSmsReminder(phone, message);
    
    if (result.success) {
      localStorage.setItem('bt_last_sms_date', today);
      const billIds = billsNeedingAttention.map(b => b.id).join(',');
      localStorage.setItem('bt_last_notified_bill_ids', billIds);
      console.log('✅ Auto-SMS sent successfully!');
      return { sent: true, message: 'SMS sent' };
    } else {
      console.error('❌ Failed to send SMS:', result.error);
      return { sent: false, message: result.error || 'Failed to send' };
    }
  } catch (error) {
    console.error('❌ Auto-SMS error:', error);
    return { sent: false, message: 'Error sending SMS' };
  } finally {
    // Reset the flag
    isSending = false;
  }
}
