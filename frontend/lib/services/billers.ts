// lib/services/billers.ts
import { supabase } from '@/lib/supabase';

export interface Biller {
  id: string;
  name: string;
  category: string;
  account_number?: string;
  contact_info?: string;
  notes?: string;
  vulnerability_flag: boolean;
  is_active: boolean;
  default_amount?: number;
  frequency?: string;
  created: string;
  updated: string;
}

export async function getBillers() {
  const { data, error } = await supabase
    .from('billers')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getBillerById(id: string) {
  const { data, error } = await supabase
    .from('billers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createBiller(biller: Partial<Biller>) {
  const { data, error } = await supabase
    .from('billers')
    .insert([biller])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBiller(id: string, updates: Partial<Biller>) {
  const { data, error } = await supabase
    .from('billers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBiller(id: string) {
  const { error } = await supabase
    .from('billers')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}
