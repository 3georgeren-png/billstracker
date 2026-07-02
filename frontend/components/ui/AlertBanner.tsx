'use client';
import { useState, useEffect, useRef } from 'react';
import { Bell, X, ChevronRight, Calendar, Clock, AlertCircle, Zap, BellRing, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { categoryEmoji } from '@/components/ui/CategoryBadge';
import { toast } from '@/components/ui/Toaster';

type Props = {
  bills: any[];
  daysUntil: (d: string) => number | null;
  fmt: (n: number) => string;
};

type AlertItem = {
  bill: any;
  type: 'reminder' | 'upcoming' | 'overdue';
  days: number;
  message: string;
  priority: 1 | 2 | 3;
  reminderId?: string;
};

declare global {
  interface Window {
    _chevronTimeout?: NodeJS.Timeout | null;
  }
}

export function AlertBanner({ bills, daysUntil, fmt }: Props) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load and calculate alerts
  const loadData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // ✅ Get reminders from Supabase
      const { data: remindersData, error: remindersError } = await supabase
        .from('reminders')
        .select('*, biller:billers(id, name, category)')
        .eq('status', 'pending')
        .order('reminder_date', { ascending: true });

      if (remindersError) {
        console.error('Error loading reminders:', remindersError);
        return;
      }

      // Filter reminders by snoozed_until
      const filteredReminders = (remindersData || []).filter((r: any) => {
        if (!r.snoozed_until || r.snoozed_until === '') return true;
        return r.snoozed_until <= today;
      });

      setReminders(filteredReminders);

      const alertItems: AlertItem[] = [];

      // ── Reminders ──
     const loadData = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // ✅ Get reminders from Supabase
    const { data: remindersData, error: remindersError } = await supabase
      .from('reminders')
      .select('*, biller:billers(id, name, category)')
      .eq('status', 'pending')
      .order('reminder_date', { ascending: true });

    if (remindersError) {
      console.error('Error loading reminders:', remindersError);
      return;
    }

    // ✅ Simplified filtering - ONE clean filter
    const activeReminders = (remindersData || []).filter((r: any) => {
      const days = daysUntil(r.reminder_date);
      
      // Find the associated bill
      const bill = bills.find((b: any) => b.biller_id === r.biller_id);
      
      // ✅ Smart filtering:
      // 1. Must have valid days (not null)
      // 2. Days must be between -3 and 7 (overdue up to 3 days, or upcoming within 7 days)
      // 3. Bill must have balance > 0 (unpaid)
      // 4. Not snoozed
      return days !== null && 
             days >= -3 && 
             days <= 7 && 
             bill?.current_balance > 0 &&
             (!r.snoozed_until || r.snoozed_until <= today);
    });

    setReminders(activeReminders);

    const alertItems: AlertItem[] = [];

    // ── Reminders ──
    activeReminders.forEach((reminder: any) => {
      const days = daysUntil(reminder.reminder_date)!;
      const bill = bills.find((b: any) => b.biller_id === reminder.biller_id);
      if (!bill) return;

      let message = '';
      const isRecurringPaid = bill.frequency && 
        bill.frequency !== 'one_off' && 
        bill.current_balance === 0;

      if (days < 0) {
        message = `Overdue by ${Math.abs(days)}d`;
      } else if (days === 0) {
        message = `Today!`;
      } else if (days === 1) {
        message = `Tomorrow`;
      } else {
        message = `${isRecurringPaid ? 'Next payment in' : 'In'} ${days}d`;
      }

      alertItems.push({
        bill,
        type: 'reminder',
        days,
        message: `${message} - ${reminder.message || 'Payment due'}`,
        priority: 1,
        reminderId: reminder.id,
      });
    });

    // ── Upcoming Bills ──
    bills.forEach((bill: any) => {
      const days = daysUntil(bill.next_bill_date);
      if (days === null) return;

      if (bill.snoozed_until && bill.snoozed_until > today) return;

      const hasReminder = alertItems.some((a: any) => a.bill.id === bill.id);
      if (hasReminder) return;

      // ✅ Only add if bill has balance > 0 (UNPAID) and days between 0-7
      if (bill.current_balance > 0 && days >= 0 && days <= 7) {
        let message = '';
        if (days === 0) {
          message = `Due today!`;
        } else if (days === 1) {
          message = `Due tomorrow`;
        } else {
          message = `Due in ${days}d`;
        }

        alertItems.push({
          bill,
          type: 'upcoming',
          days,
          message: `${message} - No reminder set`,
          priority: 2,
        });
      }
    });

    // ── Overdue Bills ──
    bills.forEach((bill: any) => {
      const days = daysUntil(bill.next_bill_date);
      if (days === null) return;

      if (bill.snoozed_until && bill.snoozed_until > today) return;

      const hasAlert = alertItems.some((a: any) => a.bill.id === bill.id);
      if (hasAlert) return;

      // ✅ Only add if bill has balance > 0 (UNPAID) and overdue
      if (bill.current_balance > 0 && days < 0) {
        alertItems.push({
          bill,
          type: 'overdue',
          days,
          message: `${Math.abs(days)}d overdue!`,
          priority: 3,
        });
      }
    });

    alertItems.sort((a, b) => {
      if (a.type === 'overdue' && b.type !== 'overdue') return -1;
      if (b.type === 'overdue' && a.type !== 'overdue') return 1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.days - b.days;
    });

    setAlerts(alertItems);
  } catch (e) {
    console.error('Failed to load alerts:', e);
  }
};

  // Scroll handler for hiding the bell button
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout | null = null;
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      scrollTimeout = setTimeout(() => {
        const currentScrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        const isAtBottom = currentScrollY + windowHeight >= documentHeight - 100;
        const isAtTop = currentScrollY < 50;

        if (isAtBottom) {
          setIsVisible(false);
        } else if (isAtTop || currentScrollY < lastScrollY) {
          setIsVisible(true);
        } else if (currentScrollY > 100 && currentScrollY > lastScrollY + 10) {
          setIsVisible(false);
        }

        lastScrollY = currentScrollY;
        scrollTimeout = null;
      }, 50);
    };

    const handleResize = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const currentScrollY = window.scrollY;
      const isAtBottom = currentScrollY + windowHeight >= documentHeight - 100;
      
      if (isAtBottom) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
    };

    if (typeof window !== 'undefined') {
      const initialScrollY = window.scrollY;
      if (initialScrollY < 50) {
        setIsVisible(true);
      }

      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleResize, { passive: true });
      
      return () => {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleResize);
        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
        }
      };
    }
  }, []);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    
    const load = async () => {
      if (isMounted) {
        await loadData();
      }
    };
    
    load();
    
    return () => {
      isMounted = false;
    };
  }, [bills]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Prevent body scroll when dropdown is open
  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
      document.body.style.width = '100%';
      
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [open]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  const handleBillClick = (billId: string) => {
    setOpen(false);
    setTimeout(() => {
      router.push(`/bills?highlight=${billId}`);
    }, 100);
  };

  const handleSnoozeAlert = async (alert: AlertItem) => {
    try {
      const snoozeDate = new Date();
      snoozeDate.setDate(snoozeDate.getDate() + 1);
      const snoozeDateStr = snoozeDate.toISOString().split('T')[0];
      
      await supabase
        .from('bills')
        .update({
          snoozed_until: snoozeDateStr,
          updated: new Date().toISOString(),
        })
        .eq('id', alert.bill.id);
      
      toast(`⏰ Alert snoozed until ${snoozeDate.toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'short' 
      })}`);
      
      setOpen(false);
      setRevealedId(null);
      setHoveredId(null);
      
      loadData();
    } catch (error) {
      console.error('Failed to snooze alert:', error);
      toast('Failed to snooze alert', 'error');
    }
  };

  const handleDismissAlert = async (alert: AlertItem) => {
    try {
      const snoozeDate = new Date();
      snoozeDate.setDate(snoozeDate.getDate() + 30);
      const snoozeDateStr = snoozeDate.toISOString().split('T')[0];
      
      await supabase
        .from('bills')
        .update({
          snoozed_until: snoozeDateStr,
          updated: new Date().toISOString(),
        })
        .eq('id', alert.bill.id);
      
      toast('✅ Alert dismissed');
      setOpen(false);
      setRevealedId(null);
      setHoveredId(null);
      
      loadData();
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
      toast('Failed to dismiss alert', 'error');
    }
  };

  // === SWIPE LOGIC (Mobile Only) ===
  const handleTouchStart = (e: React.TouchEvent, alertId: string) => {
    if (window.innerWidth >= 640) return;
    const touch = e.touches[0];
    const target = e.currentTarget as HTMLElement;
    target.dataset.startX = touch.clientX.toString();
    target.dataset.currentX = touch.clientX.toString();
  };

  const handleTouchMove = (e: React.TouchEvent, alertId: string) => {
    if (window.innerWidth >= 640) return;
    const touch = e.touches[0];
    const target = e.currentTarget as HTMLElement;
    target.dataset.currentX = touch.clientX.toString();
    
    const startX = parseFloat(target.dataset.startX || '0');
    const currentX = parseFloat(target.dataset.currentX || '0');
    const deltaX = currentX - startX;
    
    if (deltaX < -30) {
      setRevealedId(alertId);
    } else if (deltaX > 30) {
      setRevealedId(null);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, alert: AlertItem) => {
    if (window.innerWidth >= 640) return;
    const target = e.currentTarget as HTMLElement;
    const startX = parseFloat(target.dataset.startX || '0');
    const currentX = parseFloat(target.dataset.currentX || '0');
    const deltaX = currentX - startX;
    
    if (deltaX < -50) {
      setRevealedId(alert.bill.id);
    } else {
      setRevealedId(null);
    }
  };

  const resetReveal = () => {
    if (window._chevronTimeout) {
      clearTimeout(window._chevronTimeout);
      window._chevronTimeout = null;
    }
    setRevealedId(null);
    setHoveredId(null);
  };

  const totalCount = alerts.length;
  const hasUrgent = alerts.some(a => a.days <= 1);
  const hasOverdue = alerts.some(a => a.type === 'overdue');
  const hasReminders = alerts.some(a => a.type === 'reminder');

  if (totalCount === 0) return null;

  const getAlertStyle = (alert: AlertItem) => {
    if (alert.type === 'overdue') {
      return {
        bg: 'bg-red-500/15',
        border: 'border-red-500/40',
        text: 'text-red-400',
        icon: AlertCircle,
        iconColor: 'text-red-400',
        dot: 'bg-red-500',
        badge: 'bg-red-500/30 text-red-300 border-red-500/40',
        badgeText: '🚨 Overdue',
        glow: 'shadow-red-500/20',
      };
    }
    if (alert.type === 'reminder') {
      if (alert.days < 0) {
        return {
          bg: 'bg-purple-500/10',
          border: 'border-purple-500/30',
          text: 'text-purple-400',
          icon: BellRing,
          iconColor: 'text-purple-400',
          dot: 'bg-purple-500',
          badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
          badgeText: '🔔 Next Payment',
          glow: 'shadow-purple-500/10',
        };
      }
      if (alert.days === 0) {
        return {
          bg: 'bg-orange-500/10',
          border: 'border-orange-500/30',
          text: 'text-orange-400',
          icon: Zap,
          iconColor: 'text-orange-400',
          dot: 'bg-orange-500',
          badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
          badgeText: '🟠 Today',
          glow: 'shadow-orange-500/10',
        };
      }
      if (alert.days === 1) {
        return {
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30',
          text: 'text-amber-400',
          icon: Clock,
          iconColor: 'text-amber-400',
          dot: 'bg-amber-500',
          badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          badgeText: '🟡 Tomorrow',
          glow: 'shadow-amber-500/10',
        };
      }
      return {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
        text: 'text-purple-400',
        icon: BellRing,
        iconColor: 'text-purple-400',
        dot: 'bg-purple-500',
        badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        badgeText: '🔔 Reminder',
        glow: 'shadow-purple-500/10',
      };
    }
    if (alert.days === 0) {
      return {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        text: 'text-orange-400',
        icon: Zap,
        iconColor: 'text-orange-400',
        dot: 'bg-orange-500',
        badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        badgeText: '🟠 Today',
        glow: 'shadow-orange-500/10',
      };
    }
    if (alert.days === 1) {
      return {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        icon: Clock,
        iconColor: 'text-amber-400',
        dot: 'bg-amber-500',
        badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        badgeText: '🟡 Tomorrow',
        glow: 'shadow-amber-500/10',
      };
    }
    return {
      bg: 'bg-sky-500/10',
      border: 'border-sky-500/30',
      text: 'text-sky-400',
      icon: Calendar,
      iconColor: 'text-sky-400',
      dot: 'bg-sky-500',
      badge: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
      badgeText: '📅 Upcoming',
      glow: 'shadow-sky-500/10',
    };
  };

  const getBellColor = () => {
    if (hasOverdue) return 'text-red-400';
    if (hasUrgent) return 'text-amber-400';
    if (hasReminders) return 'text-purple-400';
    return 'text-sky-400';
  };

  const getBadgeColor = () => {
    if (hasOverdue) return 'bg-red-500';
    if (hasUrgent) return 'bg-amber-500';
    if (hasReminders) return 'bg-purple-500';
    return 'bg-sky-500';
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <div 
      ref={ref} 
      className={`fixed top-4 right-4 lg:top-5 lg:right-6 z-50 transition-all duration-300 ease-in-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-16 pointer-events-none'
      }`}
    >
      {/* Bell Button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative w-12 h-12 sm:w-11 sm:h-11 rounded-2xl bg-surface border ${hasOverdue ? 'border-red-500/40' : hasUrgent ? 'border-amber-500/30' : 'border-slate-700/40'} backdrop-blur-sm flex items-center justify-center hover:scale-105 transition-all active:scale-95 shadow-lg hover:shadow-xl ${
          hasOverdue ? 'hover:shadow-red-500/20' : hasUrgent ? 'hover:shadow-amber-500/20' : 'hover:shadow-slate-500/10'
        }`}
        style={{ 
          animation: hasUrgent && !open ? 'gentlePulse 2s ease-in-out infinite' : 'none',
          backgroundColor: 'var(--color-surface)',
        }}
        aria-label="Toggle alerts"
      >
        <Bell 
          size={20} 
          className={getBellColor()} 
          style={{ animation: hasUrgent && !open ? 'bellShake 3s ease-in-out infinite' : 'none' }} 
        />
        <span className={`absolute -top-1 -right-1 min-w-[20px] h-[20px] ${getBadgeColor()} rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-lg`}>
          {totalCount}
        </span>
      </button>

      {/* Dropdown */}
      <div 
        className={`absolute top-12 right-0 w-[calc(100vw-1.5rem)] sm:w-[380px] md:w-[420px] lg:w-[480px] max-w-[calc(100vw-1.5rem)] bg-surface border ${hasOverdue ? 'border-red-500/20' : hasUrgent ? 'border-amber-500/20' : 'border-slate-700/30'} rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 origin-top-right ${
          open ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-3 pointer-events-none'
        }`} 
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        
        {/* Header */}
        <div className={`flex items-center justify-between px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 lg:py-4 border-b ${hasOverdue ? 'border-red-500/20' : hasUrgent ? 'border-amber-500/20' : 'border-slate-700/30'}`}>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center ${hasOverdue ? 'bg-red-500/20' : hasUrgent ? 'bg-amber-500/20' : 'bg-sky-500/20'}`}>
              <Bell size={14} className={`sm:w-4 sm:h-4 ${getBellColor()}`} />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-semibold text-slate-100">
                {totalCount} alert{totalCount > 1 ? 's' : ''}
              </span>
              <p className="text-[8px] sm:text-[10px] text-slate-400">
                {hasOverdue ? '⚠️ Requires immediate attention' : hasUrgent ? '🔔 Urgent reminders' : '📅 Upcoming bills'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setOpen(false)} 
            className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-700/30 text-slate-500 hover:text-slate-200 transition-colors touch-target"
          >
            <X size={14} className="sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Alerts List */}
        <div 
          ref={scrollableRef}
          className="max-h-64 sm:max-h-72 lg:max-h-80 overflow-y-auto overflow-x-visible divide-y divide-slate-700/20 no-scrollbar"
          onScroll={handleScroll}
          style={{ 
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {alerts.map(alert => {
            const biller = alert.bill.biller;
            const isPaid = alert.bill.current_balance === 0;
            const isRecurring = alert.bill.frequency && alert.bill.frequency !== 'one_off';
            
            let displayAmount = alert.bill.current_balance;
            if (alert.type === 'reminder') {
              let amount = alert.bill.last_bill_amount || 0;
              if (amount === 0 && alert.reminderId) {
                const reminder = reminders.find(r => r.id === alert.reminderId);
                if (reminder && reminder.message) {
                  const match = reminder.message.match(/£([\d.]+)/);
                  if (match) {
                    amount = parseFloat(match[1]);
                  }
                }
              }
              if (amount === 0 && alert.bill.frequency) {
                const freqMatch = alert.bill.frequency?.match(/([\d.]+)\/week/);
                if (freqMatch) {
                  amount = parseFloat(freqMatch[1]);
                }
              }
              displayAmount = amount || alert.bill.current_balance;
            } else if (isPaid && isRecurring) {
              displayAmount = alert.bill.last_bill_amount || alert.bill.current_balance;
            }
            
            const style = getAlertStyle(alert);
            const Icon = style.icon;
            const isOverdue = alert.type === 'overdue';
            
            const isRevealed = (isMobile && revealedId === alert.bill.id) || 
                              (!isMobile && hoveredId === alert.bill.id);
            
            return (
              <div
                key={`${alert.bill.id}-${alert.type}`}
                className="relative overflow-visible touch-manipulation alert-item"
                onTouchStart={(e) => handleTouchStart(e, alert.bill.id)}
                onTouchMove={(e) => handleTouchMove(e, alert.bill.id)}
                onTouchEnd={(e) => handleTouchEnd(e, alert)}
                onClick={() => {
                  if (!isRevealed) {
                    handleBillClick(alert.bill.id);
                  } else {
                    resetReveal();
                  }
                }}
              >
                {/* Alert Content */}
                <div
                  className={`
                    flex items-center gap-1.5 sm:gap-2 lg:gap-3 
                    px-2.5 sm:px-3 lg:px-4 
                    py-2.5 sm:py-3 lg:py-3.5
                    hover:bg-slate-800/30 transition-all cursor-pointer active:scale-[0.98] 
                    group border-l-4 ${style.border} 
                    ${isOverdue ? 'urgent-glow' : ''}
                    relative bg-surface
                    alert-item ${isOverdue ? 'overdue' : alert.type === 'reminder' ? 'reminder' : 'upcoming'}
                  `}
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    paddingRight: '0.25rem',
                  }}
                >
                  {/* Emoji/Icon */}
                  <div className={`
                    w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 
                    rounded-xl flex items-center justify-center shrink-0 
                    ${style.bg} ${isOverdue ? 'scale-105' : ''}
                  `}>
                    <span className="text-base sm:text-lg lg:text-xl">
                      {biller?.category ? categoryEmoji(biller.category) : '📄'}
                    </span>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 flex-wrap">
                      <p className="text-xs sm:text-sm lg:text-base font-semibold text-slate-100 truncate max-w-[60px] xs:max-w-[80px] sm:max-w-[120px] lg:max-w-none">
                        {biller?.name ?? '—'}
                      </p>
                      <span className={`
                        text-[6px] sm:text-[7px] lg:text-[9px] 
                        px-1 sm:px-1.5 lg:px-2 
                        py-0.5 rounded-full border 
                        ${style.badge} whitespace-nowrap shrink-0
                      `}>
                        {style.badgeText}
                      </span>
                      {isOverdue && (
                        <span className="text-[6px] sm:text-[7px] lg:text-[9px] px-1 sm:px-1.5 lg:px-2 py-0.5 rounded-full bg-red-500/30 text-red-300 border border-red-500/40 animate-pulse whitespace-nowrap font-bold">
                          ⚠️ URGENT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 sm:gap-1 mt-0.5">
                      <Icon size={10} className={`sm:w-3 sm:h-3 lg:w-4 lg:h-4 ${style.iconColor}`} />
                      <span className={`text-[9px] sm:text-[10px] lg:text-xs ${style.text} truncate font-medium`}>
                        {alert.message}
                      </span>
                    </div>
                  </div>
                  
                  {/* Amount with Actions on the right */}
                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                    <p className={`text-xs sm:text-sm lg:text-base font-bold ${style.text} ml-0.5 sm:ml-1 min-w-[40px] sm:min-w-[50px] lg:min-w-[60px] text-right`}>
                      {fmt(displayAmount)}
                    </p>
                    
                    {/* Actions - Show inline on hover */}
                    <div 
                      className={`flex items-center gap-0.5 transition-all duration-200 ${isRevealed ? 'opacity-100 scale-100 ml-1' : 'opacity-0 scale-95 pointer-events-none w-0 overflow-hidden'}`}
                      data-actions={alert.bill.id}
                      onMouseEnter={() => {
                        if (window._chevronTimeout) {
                          clearTimeout(window._chevronTimeout);
                          window._chevronTimeout = null;
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredId(null);
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBillClick(alert.bill.id);
                        }}
                        className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 transition-all touch-target border border-sky-500/20"
                        title="View bill"
                      >
                        <Eye size={14} className="sm:w-3.5 sm:h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSnoozeAlert(alert);
                        }}
                        className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-all touch-target border border-amber-500/20"
                        title="Snooze for 1 day"
                      >
                        <Clock size={14} className="sm:w-3.5 sm:h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismissAlert(alert);
                        }}
                        className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all touch-target border border-red-500/20"
                        title="Dismiss alert"
                      >
                        <X size={14} className="sm:w-3.5 sm:h-3.5" />
                      </button>
                    </div>
                    
                    {/* Chevron wrapper - hover here to reveal actions */}
                    <div 
                      className="relative flex items-center"
                      onMouseEnter={() => {
                        if (window._chevronTimeout) {
                          clearTimeout(window._chevronTimeout);
                          window._chevronTimeout = null;
                        }
                        !isMobile && setHoveredId(alert.bill.id);
                      }}
                      onMouseLeave={() => {
                        window._chevronTimeout = setTimeout(() => {
                          const actions = document.querySelector(`[data-actions="${alert.bill.id}"]`);
                          if (actions && actions.matches(':hover')) {
                            return;
                          }
                          setHoveredId(null);
                        }, 200);
                      }}
                    >
                      {isRevealed ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse ml-1" />
                      ) : (
                        <ChevronRight 
                          size={14} 
                          className="sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-slate-600 group-hover:text-slate-400 transition-colors ml-0.5 cursor-pointer hover:text-sky-400"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={`px-3 sm:px-4 lg:px-5 py-2 sm:py-2.5 lg:py-3 border-t ${hasOverdue ? 'border-red-500/20' : hasUrgent ? 'border-amber-500/20' : 'border-slate-700/30'}`}>
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 lg:gap-4 flex-wrap">
            {alerts.some(a => a.type === 'reminder') && (
              <span className="flex items-center gap-0.5 sm:gap-1 text-[7px] sm:text-[8px] lg:text-[10px] text-slate-400">
                <BellRing size={8} className="sm:w-3 sm:h-3 lg:w-4 lg:h-4 text-purple-400" />
                <span className="hidden xs:inline">Reminders</span>
              </span>
            )}
            {alerts.some(a => a.type === 'upcoming') && (
              <span className="flex items-center gap-0.5 sm:gap-1 text-[7px] sm:text-[8px] lg:text-[10px] text-slate-400">
                <Calendar size={8} className="sm:w-3 sm:h-3 lg:w-4 lg:h-4 text-sky-400" />
                <span className="hidden xs:inline">Upcoming</span>
              </span>
            )}
            {alerts.some(a => a.type === 'overdue') && (
              <span className="flex items-center gap-0.5 sm:gap-1 text-[7px] sm:text-[8px] lg:text-[10px] text-slate-400">
                <AlertCircle size={8} className="sm:w-3 sm:h-3 lg:w-4 lg:h-4 text-red-400" />
                <span className="hidden xs:inline">Overdue</span>
              </span>
            )}
            <span className="w-px h-3 sm:h-4 bg-slate-700/30 hidden xs:block" />
            <span className="text-[7px] sm:text-[8px] lg:text-[10px] text-slate-500 font-medium">
              {isMobile ? 'Swipe left for actions' : 'Hover the chevron (›) for actions'}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bellShake {
          0%, 60%, 100% { transform: rotate(0deg); }
          65% { transform: rotate(-12deg); }
          70% { transform: rotate(12deg); }
          75% { transform: rotate(-8deg); }
          80% { transform: rotate(8deg); }
          85% { transform: rotate(0deg); }
        }
        @keyframes gentlePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.3); }
          50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
        @keyframes urgentGlow {
          0%, 100% { 
            background-color: rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.3);
          }
          50% { 
            background-color: rgba(239, 68, 68, 0.25);
            border-color: rgba(239, 68, 68, 0.6);
          }
        }
        .urgent-glow {
          animation: urgentGlow 1.5s ease-in-out infinite;
        }
        .touch-target {
          min-height: 44px;
          min-width: 44px;
        }
        @media (max-width: 640px) {
          .touch-target {
            min-height: 40px;
            min-width: 40px;
          }
        }
        .touch-manipulation {
          touch-action: pan-y;
        }

        /* Alert Banner Hover Effects */
        .alert-item {
          transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
          cursor: pointer;
          border-radius: 8px;
        }

        .alert-item:hover {
          background-color: rgba(56, 189, 248, 0.08) !important;
          transform: translateX(4px);
        }

        .alert-item.overdue:hover {
          background-color: rgba(239, 68, 68, 0.12) !important;
        }

        .alert-item.reminder:hover {
          background-color: rgba(168, 85, 247, 0.12) !important;
        }

        .alert-item.upcoming:hover {
          background-color: rgba(56, 189, 248, 0.08) !important;
        }

        .alert-item:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        /* Hide scrollbar but keep functionality */
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>
    </div>
  );
}
