// lib/services/reminderService.ts
import pb from '@/lib/supabase-adapter';

export class ReminderService {
  private static instance: ReminderService;
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new ReminderService();
    }
    return this.instance;
  }

  // ✅ Batch delete reminders for a biller
  async deleteRemindersForBiller(billerId: string, status: string = 'pending') {
    try {
      const reminders = await pb.collection('reminders').getFullList({
        filter: `biller_id="${billerId}" && status="${status}"`,
        fields: 'id', // Only fetch IDs for performance
      });
      
      if (reminders.length === 0) return { deleted: 0 };
      
      // Batch delete (if supported by PocketBase/Supabase)
      const deletePromises = reminders.map(r => 
        pb.collection('reminders').delete(r.id)
      );
      
      await Promise.all(deletePromises);
      return { deleted: reminders.length };
    } catch (error) {
      console.error('Error deleting reminders:', error);
      return { deleted: 0, error };
    }
  }

  // ✅ Create reminder only if needed (within 7 days)
  async createReminderIfNeeded(params: {
    billerId: string;
    billId: string;
    dueDate: string;
    amount: number;
    billerName: string;
  }): Promise<{ created: boolean; reason?: string }> {
    const { billerId, billId, dueDate, amount, billerName } = params;
    
    // Check if within 7 days
    const daysUntilDue = this.getDaysUntil(dueDate);
    
    if (daysUntilDue > 7) {
      return { 
        created: false, 
        reason: `Due in ${daysUntilDue} days (more than 7)` 
      };
    }
    
    if (daysUntilDue < 0) {
      return { 
        created: false, 
        reason: 'Already overdue' 
      };
    }

    // Calculate reminder date (3 days before)
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - 3);
    const reminderDateStr = reminderDate.toISOString().split('T')[0];
    
    // Check if reminder date is in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reminderDateObj = new Date(reminderDateStr);
    reminderDateObj.setHours(0, 0, 0, 0);
    
    if (reminderDateObj < today) {
      return { 
        created: false, 
        reason: 'Reminder date is in the past' 
      };
    }

    // Create reminder
    const formattedAmount = new Intl.NumberFormat('en-GB', { 
      style: 'currency', 
      currency: 'GBP' 
    }).format(amount);
    
    await pb.collection('reminders').create({
      biller_id: billerId,
      reminder_date: reminderDateStr,
      type: 'payment_due',
      message: `${billerName} - ${formattedAmount} due on ${new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
      status: 'pending',
    });
    
    return { created: true };
  }

  // ✅ Smart sync: delete old + create new in one operation
  async syncRemindersForPayment(params: {
    billerId: string;
    billId: string;
    nextDueDate: string | null;
    amount: number;
    billerName: string;
    isRecurring: boolean;
    isFullyPaid: boolean;
  }): Promise<{ deleted: number; created: boolean; reason?: string }> {
    const { billerId, billId, nextDueDate, amount, billerName, isRecurring, isFullyPaid } = params;
    
    // If not fully paid or not recurring, just clean up
    if (!isFullyPaid || !isRecurring || !nextDueDate) {
      const result = await this.deleteRemindersForBiller(billerId);
      return { 
        deleted: result.deleted, 
        created: false,
        reason: !isFullyPaid ? 'Not fully paid' : 'Not recurring or no due date'
      };
    }

    // Delete all existing reminders
    const deleteResult = await this.deleteRemindersForBiller(billerId);
    
    // Create new reminder if within 7 days
    const createResult = await this.createReminderIfNeeded({
      billerId,
      billId,
      dueDate: nextDueDate,
      amount,
      billerName,
    });
    
    return {
      deleted: deleteResult.deleted,
      created: createResult.created,
      reason: createResult.reason,
    };
  }

  private getDaysUntil(dateStr: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / 86400000);
  }
}