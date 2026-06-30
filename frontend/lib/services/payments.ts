// lib/services/payments.ts
import { supabase } from '@/lib/supabase';

export interface Payment {
  id: string;
  biller_id: string;
  bill_id?: string;
  amount: number;
  payment_date: string;
  method: string;
  receipt?: string;
  notes?: string;
  created: string;
  updated: string;
  biller?: { name: string };
}

export async function getPayments() {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      biller:billers(name)
    `)
    .order('payment_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createPayment(payment: Partial<Payment>) {
  const { data, error } = await supabase
    .from('payments')
    .insert([payment])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePayment(id: string, updates: Partial<Payment>) {
  const { data, error } = await supabase
    .from('payments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePayment(id: string) {
  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}
