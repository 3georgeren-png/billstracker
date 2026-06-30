'use client';
import pb from '@/lib/supabase-adapter';
import { usePathname } from 'next/navigation';
import { Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

const titles: Record<string, string> = {
  '/':              'Dashboard',
  '/billers':       'Billers',
  '/bills':         'Bill Records',
  '/payments':      'Payments',
  '/direct-debits': 'Direct Debits',
  '/reminders':     'Reminders',
  '/reports':       'Reports',
  '/settings':      'Settings',
};

export function TopBar() {
  const path = usePathname();
  const [connected, setConnected] = useState<boolean | null>(null);
  const title = Object.entries(titles).find(([key]) =>
    key === '/' ? path === '/' : path.startsWith(key)
  )?.[1] ?? 'BillsTracker';

  useEffect(() => {
    async function check() {
      try {
        await pb.health.check();
        setConnected(true);
      } catch {
        setConnected(false);
      }
    }
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-slate-900/80 border-b border-slate-700/50 px-4 lg:px-8 py-3.5 flex items-center justify-between shrink-0">
      <h1 className="text-base font-semibold text-slate-100 lg:text-lg">{title}</h1>
      <div className="flex items-center gap-2">
        {connected === null ? null : connected ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <Wifi size={14} />
            <span className="hidden sm:inline">Live sync</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
            <WifiOff size={14} />
            <span className="hidden sm:inline">Offline</span>
          </div>
        )}
      </div>
    </header>
  );
}
