// lib/services/directDebits.ts
import { supabase } from '@/lib/supabase';

export interface DirectDebit {
  id: string;
  biller_id: string;
  amount: number;
  collection_day: number;
  next_dd_date?: string;
  status: string;
  notes?: string;
  created: string;
  updated: string;
  biller?: { name: string };
}

export async function getDirectDebits() {
  const { data, error } = await supabase
    .from('direct_debits')
    .select(`
      *,
      biller:billers(name)
    `)
    .eq('status', 'active')
    .order('next_dd_date');

  if (error) throw error;
  return data || [];
}

export async function createDirectDebit(dd: Partial<DirectDebit>) {
  const { data, error } = await supabase
    .from('direct_debits')
    .insert([dd])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateDirectDebit(id: string, updates: Partial<DirectDebit>) {
  const { data, error } = await supabase
    .from('direct_debits')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
