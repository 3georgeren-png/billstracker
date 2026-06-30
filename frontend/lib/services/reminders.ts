// lib/services/reminders.ts
import { supabase } from '@/lib/supabase';

export interface Reminder {
  id: string;
  biller_id: string;
  reminder_date: string;
  type: string;
  message: string;
  status: string;
  snoozed_until?: string;
  created: string;
  updated: string;
  biller?: { name: string };
}

export async function getReminders() {
  const { data, error } = await supabase
    .from('reminders')
    .select(`
      *,
      biller:billers(name)
    `)
    .eq('status', 'pending')
    .order('reminder_date');

  if (error) throw error;
  return data || [];
}

export async function createReminder(reminder: Partial<Reminder>) {
  const { data, error } = await supabase
    .from('reminders')
    .insert([reminder])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateReminder(id: string, updates: Partial<Reminder>) {
  const { data, error } = await supabase
    .from('reminders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
