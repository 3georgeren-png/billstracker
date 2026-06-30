// lib/supabase-adapter.ts
import { supabase } from './supabase';
import { getBillers, createBiller, updateBiller, deleteBiller } from './services/billers';
import { getBills, createBill, updateBill, deleteBill } from './services/bills';
import { getPayments, createPayment, updatePayment, deletePayment } from './services/payments';
import { getReminders, createReminder, updateReminder, deleteReminder } from './services/reminders';
import { getDirectDebits, createDirectDebit, updateDirectDebit, deleteDirectDebit } from './services/directDebits';
import { getBudgets, createBudget, updateBudget, deleteBudget } from './services/budgets';
import { login, logout, getCurrentUser, isAuthenticated } from './services/auth';

// Mock collection interface
class CollectionAdapter {
  private name: string;
  
  constructor(name: string) {
    this.name = name;
  }

  async getFullList(options?: any) {
    const collections: Record<string, any> = {
      billers: getBillers,
      bills: getBills,
      payments: getPayments,
      reminders: getReminders,
      direct_debits: getDirectDebits,
      budgets: getBudgets,
    };
    
    const fn = collections[this.name];
    if (!fn) {
      console.warn(`Collection "${this.name}" not implemented in Supabase adapter`);
      return [];
    }
    
    const result = await fn();
    return result;
  }

  async getOne(id: string) {
    const { data, error } = await supabase
      .from(this.name)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  async create(data: any) {
    const collections: Record<string, any> = {
      billers: createBiller,
      bills: createBill,
      payments: createPayment,
      reminders: createReminder,
      direct_debits: createDirectDebit,
      budgets: createBudget,
    };
    
    const fn = collections[this.name];
    if (!fn) {
      console.warn(`Collection "${this.name}" create not implemented`);
      return data;
    }
    
    return await fn(data);
  }

  async update(id: string, data: any) {
    const collections: Record<string, any> = {
      billers: updateBiller,
      bills: updateBill,
      payments: updatePayment,
      reminders: updateReminder,
      direct_debits: updateDirectDebit,
      budgets: updateBudget,
    };
    
    const fn = collections[this.name];
    if (!fn) {
      console.warn(`Collection "${this.name}" update not implemented`);
      return data;
    }
    
    return await fn(id, data);
  }

  async delete(id: string) {
    const collections: Record<string, any> = {
      billers: deleteBiller,
      bills: deleteBill,
      payments: deletePayment,
      reminders: deleteReminder,
      direct_debits: deleteDirectDebit,
      budgets: deleteBudget,
    };
    
    const fn = collections[this.name];
    if (!fn) {
      console.warn(`Collection "${this.name}" delete not implemented`);
      return;
    }
    
    return await fn(id);
  }

  subscribe(event: string, callback: Function) {
    // Supabase realtime subscription
    const channel = supabase
      .channel(`${this.name}-changes`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: this.name },
        () => callback()
      )
      .subscribe();
    
    return { unsubscribe: () => supabase.removeChannel(channel) };
  }

  unsubscribe() {
    // Cleanup handled by component
  }
}

// Auth methods
const auth = {
  async authWithPassword(email: string, password: string) {
    return await login(email, password);
  },
  async signOut() {
    return await logout();
  },
  async getCurrentUser() {
    return await getCurrentUser();
  },
  async isAuthenticated() {
    return await isAuthenticated();
  }
};

// Health check
const health = {
  async check() {
    try {
      const { data, error } = await supabase.from('billers').select('count', { count: 'exact', head: true });
      if (error) throw error;
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
};

// Main adapter - mimics PocketBase
const pb = {
  collection: (name: string) => new CollectionAdapter(name),
  authStore: {
    token: '',
    model: null,
    isValid: false,
    loadFromCookie: () => {},
    save: () => {},
    clear: () => {},
  },
  auth,
  health,
  realtime: {
    subscribe: () => {},
    unsubscribe: () => {},
  },
  files: {
    getUrl: (record: any, filename: string) => {
      return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/uploads/${record.id}/${filename}`;
    }
  }
};

export default pb;
export { pb };
