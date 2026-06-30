'use client';
import { useState, useEffect } from 'react';
import pb from '@/lib/supabase-adapter';
import { getBudgets, createBudget, updateBudget, deleteBudget } from '@/lib/services/budgets';

export type Budget = {
  id: string;
  category: string;
  amount: number;
  spent: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  created: string;
  updated: string;
};

export function useBudget() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  // Load budgets
  const loadBudgets = async () => {
    try {
      const data = await getBudgets();
      setBudgets(data as Budget[]);
    } catch (error) {
      console.error('Error loading budgets:', error);
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  };

  // Save budget
  const saveBudget = async (budget: Partial<Budget>) => {
    try {
      if (budget.id) {
        await updateBudget(budget.id, budget);
      } else {
        await createBudget(budget);
      }
      await loadBudgets();
      return { success: true, message: 'Budget saved successfully' };
    } catch (error) {
      console.error('Error saving budget:', error);
      return { success: false, message: 'Failed to save budget' };
    }
  };

  // Delete budget
  const deleteBudget = async (id: string) => {
    try {
      await deleteBudget(id);
      await loadBudgets();
      return { success: true, message: 'Budget deleted' };
    } catch (error) {
      console.error('Error deleting budget:', error);
      return { success: false, message: 'Failed to delete budget' };
    }
  };

  // Calculate spending by category for current month
  const getCategorySpending = (bills: any[], payments: any[]) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Get all payments for current month
    const monthPayments = payments.filter((p: any) => {
      const date = new Date(p.payment_date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    // Calculate spending by category
    const spending: Record<string, number> = {};
    
    monthPayments.forEach((p: any) => {
      // For Supabase, the biller data is nested differently
      const bill = bills.find((b: any) => b.biller_id === p.biller_id);
      const category = bill?.biller?.category || 'Other';
      spending[category] = (spending[category] || 0) + p.amount;
    });

    return spending;
  };

  // Calculate budget progress for each category
  const getBudgetProgress = (spending: Record<string, number>) => {
    return budgets.map(budget => {
      const spent = spending[budget.category] || 0;
      const percentage = budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0;
      const remaining = Math.max(budget.amount - spent, 0);
      
      return {
        ...budget,
        spent,
        percentage,
        remaining,
        status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'good',
      };
    });
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  return {
    budgets,
    loading,
    loadBudgets,
    saveBudget,
    deleteBudget,
    getCategorySpending,
    getBudgetProgress,
  };
}