// lib/services/budgets.ts
import { supabase } from '@/lib/supabase';

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  period: string;
  created: string;
  updated: string;
}

export async function getBudgets() {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .order('category');

  if (error) throw error;
  return data || [];
}

export async function createBudget(budget: Partial<Budget>) {
  const { data, error } = await supabase
    .from('budgets')
    .insert([budget])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBudget(id: string, updates: Partial<Budget>) {
  const { data, error } = await supabase
    .from('budgets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBudget(id: string) {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}
