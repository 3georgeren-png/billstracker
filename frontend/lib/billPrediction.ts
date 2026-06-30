import { supabase } from '@/lib/supabase';

type BillPrediction = {
  predictedAmount: number;
  confidence: 'high' | 'medium' | 'low';
  basedOn: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  lastAmount: number;
  message: string;
};

/**
 * Predict the next bill amount based on historical payments
 */
export async function predictBillAmount(billId: string): Promise<BillPrediction | null> {
  try {
    // Get the bill
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .select('*')
      .eq('id', billId)
      .single();

    if (billError) throw billError;
    if (!bill) return null;

    // Get last 10 payments for this bill
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('bill_id', billId)
      .order('payment_date', { ascending: false })
      .limit(10);

    if (paymentsError) throw paymentsError;

    // Get amounts from payments (exclude £0 payments)
    const amounts = (payments || [])
      .map(p => p.amount)
      .filter(a => a > 0);

    // If no payments, use current balance or last bill amount
    if (amounts.length === 0) {
      const amount = bill.current_balance || bill.last_bill_amount || 0;
      const formattedAmount = formatCurrency(amount);
      return {
        predictedAmount: amount,
        confidence: 'low',
        basedOn: 0,
        trend: 'stable',
        lastAmount: amount,
        message: `Expected: ${formattedAmount}`,
      };
    }

    const lastAmount = amounts[0] || bill.last_bill_amount || 0;

    // Calculate averages
    const recentAmounts = amounts.slice(0, 3);
    const avgRecent = recentAmounts.reduce((sum, a) => sum + a, 0) / recentAmounts.length;
    const overallAvg = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;

    // Determine confidence level
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    
    if (amounts.length >= 4) {
      const max = Math.max(...amounts);
      const min = Math.min(...amounts);
      const range = max - min;
      const avg = overallAvg;
      
      if (range < avg * 0.1) {
        confidence = 'high';
      } else if (range < avg * 0.3) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }
    } else if (amounts.length >= 2) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    
    if (amounts.length >= 3) {
      const first = amounts[amounts.length - 1];
      const last = amounts[0];
      const diff = last - first;
      const avg = overallAvg;
      
      if (diff > avg * 0.1) {
        trend = 'increasing';
      } else if (diff < -avg * 0.1) {
        trend = 'decreasing';
      }
    }

    // Predict amount
    let predictedAmount = recentAmounts.length >= 2 ? avgRecent : overallAvg;
    
    if (trend === 'increasing' && confidence !== 'low') {
      predictedAmount *= 1.03;
    } else if (trend === 'decreasing' && confidence !== 'low') {
      predictedAmount *= 0.97;
    }

    predictedAmount = Math.round(predictedAmount * 100) / 100;

    // ✅ Build clean message
    const formattedAmount = formatCurrency(predictedAmount);
    let message = '';

    if (amounts.length === 1) {
      message = `Expected: ${formattedAmount} 📊 Based on 1 payment`;
    } else if (amounts.length >= 4 && confidence === 'high') {
      message = `Expected: ${formattedAmount} ✅ High confidence`;
      if (trend !== 'stable') {
        message += ` ${trend === 'increasing' ? '📈' : '📉'}`;
      }
    } else if (amounts.length >= 3 && confidence === 'medium') {
      message = `Expected: ${formattedAmount} 📊 Medium confidence`;
      if (trend !== 'stable') {
        message += ` ${trend === 'increasing' ? '📈' : '📉'}`;
      }
    } else if (amounts.length >= 2) {
      message = `Expected: ${formattedAmount} 📊 Based on ${amounts.length} payments`;
    } else {
      message = `Expected: ${formattedAmount} 📊 Based on 1 payment`;
    }

    return {
      predictedAmount,
      confidence,
      basedOn: amounts.length,
      trend,
      lastAmount,
      message,
    };
  } catch (error) {
    console.error('Prediction error:', error);
    return null;
  }
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount);
}

/**
 * Get a user-friendly message for the prediction
 */
export function getPredictionMessage(prediction: BillPrediction | null): string {
  if (!prediction) return 'No prediction available';
  return prediction.message || `Expected: ${formatCurrency(prediction.predictedAmount)}`;
}

/**
 * Get confidence color for UI
 */
export function getConfidenceColor(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high':
      return 'text-emerald-400';
    case 'medium':
      return 'text-amber-400';
    case 'low':
      return 'text-slate-400';
  }
}