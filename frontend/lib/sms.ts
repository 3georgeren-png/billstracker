// lib/sms.ts

export async function sendSmsReminder(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('📱 Sending via SMS API...');
    
    const response = await fetch('/api/sms', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, message })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Message sent successfully');
      return { success: true };
    } else {
      console.error('Error:', data.error);
      return { success: false, error: data.error || 'Failed to send' };
    }
  } catch (error) {
    console.error('Failed to send:', error);
    return { success: false, error: 'Network error' };
  }
}
 
// Format a single bill reminder
export function formatReminderMessage(billerName: string, amount: number, dueDate: string, days: number): string {
  let status = '';
  if (days < 0) status = `${Math.abs(days)}d OVERDUE!`;
  else if (days === 0) status = 'TODAY!';
  else if (days === 1) status = 'TOMORROW!';
  else status = `${days}d`;

  const lines = [
    '🔔 BILL REMINDER',
    '',
    `📌 ${billerName}`,
    `💰 £${amount.toFixed(2)}`,
    `📅 ${status}`,
    `🗓️ Due: ${dueDate}`
  ];
  
  return lines.join('\n');
}

// Format multiple bills
export function formatBulkReminderMessage(bills: Array<{ name: string; amount: number; dueDate: string; days: number }>): string {
  // Shorten each bill to fit in 160 chars
  const parts = bills.map((bill, index) => {
    let status = '';
    if (bill.days < 0) status = `${Math.abs(bill.days)}d ovrdue`;
    else if (bill.days === 0) status = 'today';
    else if (bill.days === 1) status = 'tmrw';
    else status = `${bill.days}d`;

    // Shorten names
    let shortName = bill.name
      .replace(' bill', '')
      .replace(' Energy', '')
      .replace(' Council Tax', '')
      .replace(' Utilities', '')
      .trim();

    return `${index+1}.${shortName} £${bill.amount.toFixed(2)} ${status}`;
  });

  // Build message
  let message = `${bills.length} bills due: ${parts.join(' | ')}`;
  
  // Add total if under limit
  const total = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalText = ` | Total: £${total.toFixed(2)}`;
  
  // Check if message + total fits in 160 chars
  if ((message + totalText).length <= 160) {
    message += totalText;
  }

  return message;
}

// Get all bills that need attention (overdue + due within 7 days)
export function getBillsNeedingAttention(bills: any[], daysUntil: (d: string) => number | null) {
  return bills
    .filter(bill => {
      const days = daysUntil(bill.next_bill_date);
      if (days === null) return false;
      if (bill.current_balance <= 0) return false;
      return days < 0 || days <= 7;
    })
    .map(bill => {
      // ✅ FIX: Try different ways to get biller name
      let billerName = 'Unknown';
      
      // Check for Supabase format (biller is a joined object)
      if (bill.biller?.name) {
        billerName = bill.biller.name;
      } 
      // Check for PocketBase format (expand.biller_id)
      else if (bill.expand?.biller_id?.name) {
        billerName = bill.expand.biller_id.name;
      } 
      // Check for direct biller_id with name
      else if (bill.biller_id?.name) {
        billerName = bill.biller_id.name;
      }
      // Check if biller is a string ID and we have billers array available
      else if (bill.biller_id && typeof bill.biller_id === 'string') {
        // Keep as Unknown - will need to be enriched elsewhere
        billerName = 'Unknown';
      }
      
      return {
        id: bill.id,
        name: billerName,
        amount: bill.current_balance,
        dueDate: new Date(bill.next_bill_date).toLocaleDateString('en-GB'),
        days: daysUntil(bill.next_bill_date) || 0,
        biller: bill.biller || bill.expand?.biller_id
      };
    })
    .sort((a, b) => a.days - b.days);
}
