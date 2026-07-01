'use client';
import { useState, useEffect } from 'react';
import { Lock, Delete } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const PIN_VERIFIED_KEY = 'bt_pin_verified';
const PIN_HASH_KEY = 'bt_pin_hash';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours

function isSessionValid(): boolean {
  try {
    const v = localStorage.getItem(PIN_VERIFIED_KEY);
    if (!v) return false;
    return Date.now() - parseInt(v) < SESSION_DURATION;
  } catch { return false; }
}

function storeSession() {
  try { localStorage.setItem(PIN_VERIFIED_KEY, Date.now().toString()); } catch {}
}

function getLocalPin(): string | null {
  try { return localStorage.getItem(PIN_HASH_KEY); } catch { return null; }
}

function storeLocalPin(hashed: string) {
  try { localStorage.setItem(PIN_HASH_KEY, hashed); } catch {}
}

function hashPin(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    hash = ((hash << 5) - hash) + pin.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

type Mode = 'verify' | 'setup' | 'confirm';

export function PinLock({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [mode, setMode] = useState<Mode>('verify');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(true);
  const [storedPinHash, setStoredPinHash] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    checkPinStatus();
  }, []);

  // ✅ Get PIN from Supabase pin_auth table
  const getPinFromDB = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('pin_auth')
        .select('pin_hash')
        .eq('enabled', true)
        .limit(1)
        .single();

      if (error) {
        console.log('📋 No PIN found in Supabase:', error.message);
        return null;
      }

      if (data) {
        console.log('✅ PIN found in Supabase');
        return data.pin_hash;
      }

      return null;
    } catch (error) {
      console.error('❌ Error getting PIN from Supabase:', error);
      return null;
    }
  };

  // ✅ Save PIN to Supabase pin_auth table
  const savePinToDB = async (hashedPin: string): Promise<boolean> => {
    try {
      // Check if PIN already exists
      const { data: existing, error: checkError } = await supabase
        .from('pin_auth')
        .select('id')
        .eq('enabled', true)
        .limit(1);

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing PIN:', checkError);
        return false;
      }

      if (existing && existing.length > 0) {
        // Update existing
        const { error: updateError } = await supabase
          .from('pin_auth')
          .update({
            pin_hash: hashedPin,
            enabled: true,
            updated: new Date().toISOString(),
          })
          .eq('id', existing[0].id);

        if (updateError) {
          console.error('Error updating PIN:', updateError);
          return false;
        }
        console.log('✅ PIN updated in Supabase');
      } else {
        // Create new
        const { error: createError } = await supabase
          .from('pin_auth')
          .insert([{
            pin_hash: hashedPin,
            enabled: true,
            device_name: navigator.userAgent || 'Unknown',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          }]);

        if (createError) {
          console.error('Error creating PIN:', createError);
          return false;
        }
        console.log('✅ PIN created in Supabase');
      }
      return true;
    } catch (error) {
      console.error('❌ Error saving PIN to Supabase:', error);
      return false;
    }
  };

  // ✅ Remove PIN from Supabase pin_auth table
  const removePinFromDB = async (): Promise<boolean> => {
    try {
      const { data: existing, error: checkError } = await supabase
        .from('pin_auth')
        .select('id')
        .eq('enabled', true)
        .limit(1);

      if (checkError) {
        console.error('Error checking existing PIN:', checkError);
        return false;
      }

      if (existing && existing.length > 0) {
        const { error: updateError } = await supabase
          .from('pin_auth')
          .update({
            enabled: false,
            updated: new Date().toISOString(),
          })
          .eq('id', existing[0].id);

        if (updateError) {
          console.error('Error disabling PIN:', updateError);
          return false;
        }
        console.log('✅ PIN disabled in Supabase');
        return true;
      }
      return true;
    } catch (error) {
      console.error('Error disabling PIN:', error);
      return false;
    }
  };

  const checkPinStatus = async () => {
    try {
      setLoading(true);
      
      // Check session first
      if (isSessionValid()) {
        console.log('✅ Session valid - unlocking');
        setUnlocked(true);
        setLoading(false);
        return;
      }

      // Check localStorage first (fast)
      const localPin = getLocalPin();
      if (localPin) {
        console.log('🔒 PIN found in localStorage');
        setStoredPinHash(localPin);
        setMode('verify');
        setLoading(false);
        return;
      }

      // Check database
      const dbPin = await getPinFromDB();
      if (dbPin) {
        console.log('🔒 PIN found in database');
        storeLocalPin(dbPin);
        setStoredPinHash(dbPin);
        setMode('verify');
      } else {
        console.log('🔓 No PIN found - showing setup');
        setMode('setup');
        setStoredPinHash(null);
      }
    } catch (error) {
      console.error('Error checking PIN:', error);
      // Fallback to localStorage
      const localPin = getLocalPin();
      if (localPin) {
        setStoredPinHash(localPin);
        setMode('verify');
      } else {
        setMode('setup');
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ Verify PIN
  const verifyPin = async (enteredPin: string): Promise<boolean> => {
    const hashed = hashPin(enteredPin);
    
    // Check localStorage first (fast)
    const localPin = getLocalPin();
    if (localPin === hashed) {
      console.log('✅ PIN verified from localStorage');
      return true;
    }

    // Check database
    try {
      const dbPin = await getPinFromDB();
      if (dbPin === hashed) {
        console.log('✅ PIN verified from database');
        storeLocalPin(hashed);
        setStoredPinHash(hashed);
        return true;
      }
    } catch (error) {
      console.error('Error verifying PIN from database:', error);
    }

    return false;
  };

  // ✅ Handle PIN submission
  const handlePinSubmit = async () => {
    if (mode === 'verify' && pin.length === 4) {
      const isValid = await verifyPin(pin);
      if (isValid) {
        storeSession();
        setUnlocked(true);
      } else {
        triggerShake();
        setError('Incorrect PIN');
        setTimeout(() => setPin(''), 600);
      }
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const addDigit = (n: string) => {
    setError('');
    if (mode === 'confirm') {
      if (confirmPin.length < 4) setConfirmPin(p => p + n);
    } else {
      if (pin.length < 4) setPin(p => p + n);
    }
  };

  const deleteDigit = () => {
    setError('');
    if (mode === 'confirm') setConfirmPin(p => p.slice(0, -1));
    else setPin(p => p.slice(0, -1));
  };

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (mode === 'verify' && pin.length === 4) {
      handlePinSubmit();
    }
    if (mode === 'setup' && pin.length === 4) {
      setMode('confirm');
    }
    if (mode === 'confirm' && confirmPin.length === 4) {
      if (confirmPin === pin) {
        const hashed = hashPin(pin);
        savePinToDB(hashed).then(success => {
          if (success) {
            storeLocalPin(hashed);
            setStoredPinHash(hashed);
            storeSession();
            setUnlocked(true);
          } else {
            setError('Failed to save PIN to database');
            setTimeout(() => {
              setPin('');
              setConfirmPin('');
              setMode('setup');
            }, 600);
          }
        });
      } else {
        triggerShake();
        setError('PINs do not match');
        setTimeout(() => {
          setPin('');
          setConfirmPin('');
          setMode('setup');
        }, 600);
      }
    }
  }, [pin, confirmPin, mode]);

  // Reset PIN
  const resetPin = async () => {
    try {
      await removePinFromDB();
      localStorage.removeItem(PIN_HASH_KEY);
      localStorage.removeItem(PIN_VERIFIED_KEY);
      setStoredPinHash(null);
      setMode('setup');
      setPin('');
      setConfirmPin('');
      setError('');
      console.log('✅ PIN reset successfully');
    } catch (error) {
      console.error('Error resetting PIN:', error);
    }
  };

  // Not mounted yet
  if (!mounted) return <div style={{ opacity: 0 }}>{children}</div>;
  
  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-[999]">
        <div className="animate-pulse text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }
  
  if (unlocked) return <>{children}</>;

  const currentPin = mode === 'confirm' ? confirmPin : pin;
  const subtitle = {
    setup: 'Set a 4-digit PIN to secure your bills across all devices',
    confirm: 'Enter the same PIN again to confirm',
    verify: 'Enter your PIN to continue',
  }[mode];

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[999] p-6 select-none">
      {/* Logo */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
          <Lock size={28} className="text-sky-400" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-100">BillsTracker</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-[240px]">{subtitle}</p>
          <p className="text-xs text-slate-600 mt-2">🔒 Synced across all devices</p>
        </div>
      </div>

      {/* PIN dots */}
      <div className={`flex gap-5 mb-8 ${shake ? 'animate-bounce' : ''}`}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
            i < currentPin.length
              ? 'bg-sky-400 border-sky-400 scale-110'
              : 'bg-transparent border-slate-600'
          }`} />
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm mb-5 font-medium">⚠ {error}</p>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-72">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => {
          if (key === '') return <div key={i} />;
          if (key === '⌫') return (
            <button key={i} onClick={deleteDigit}
              className="h-16 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center touch-manipulation">
              <Delete size={20} />
            </button>
          );
          return (
            <button key={i} onClick={() => addDigit(key)}
              className="h-16 rounded-2xl bg-slate-800 border border-slate-700 text-white text-2xl font-semibold hover:bg-slate-700 hover:border-sky-500/50 active:scale-95 active:bg-slate-600 transition-all touch-manipulation">
              {key}
            </button>
          );
        })}
      </div>

      {/* Reset PIN */}
      {mode === 'verify' && (
        <button
          onClick={resetPin}
          className="mt-10 text-xs text-slate-600 hover:text-slate-400 transition-colors underline underline-offset-2">
          Forgot PIN? Reset
        </button>
      )}
    </div>
  );
}

export function useLockApp() {
  return () => {
    try { localStorage.removeItem(PIN_VERIFIED_KEY); } catch {}
    window.location.reload();
  };
}
