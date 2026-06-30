// lib/services/bills.ts
import { supabase } from '@/lib/supabase';

export interface Bill {
  id: string;
  biller_id: string;
  current_balance: number;
  last_bill_date?: string;
  last_bill_amount: number;
  next_bill_date?: string;
  frequency: string;
  default_amount: number;
  amount: number;
  snoozed_until?: string;
  notes?: string;
  created: string;
  updated: string;
  biller?: { name: string; category: string };
}

export async function getBills() {
  const { data, error } = await supabase
    .from('bills')
    .select(`
      *,
      biller:billers(name, category)
    `)
    .order('next_bill_date');

  if (error) throw error;
  return data || [];
}

export async function getBillsWithBiller() {
  const { data, error } = await supabase
    .from('bills')
    .select(`
      *,
      biller:billers(id, name, category, is_active)
    `)
    .order('next_bill_date');

  if (error) throw error;
  return data || [];
}

export async function createBill(bill: Partial<Bill>) {
  const { data, error } = await supabase
    .from('bills')
    .insert([bill])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBill(id: string, updates: Partial<Bill>) {
  const { data, error } = await supabase
    .from('bills')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBill(id: string) {
  const { error } = await supabase
    .from('bills')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}
