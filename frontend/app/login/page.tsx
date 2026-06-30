'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/Toaster';

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/');
      }
    };
    checkAuth();
  }, [router]);

  // Handle lock timer
  useEffect(() => {
    if (locked && lockTimer > 0) {
      const timer = setTimeout(() => {
        setLockTimer(lockTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (locked && lockTimer === 0) {
      setLocked(false);
      setAttempts(0);
      setError('');
      toast('🔓 Lock expired. Try again.');
    }
  }, [locked, lockTimer]);

  const handlePinChange = (index: number, value: string) => {
    if (locked) return;
    
    // Only allow numbers
    if (!/^\d*$/.test(value)) return;
    
    const newPin = [...pin];
    newPin[index] = value.slice(0, 1);
    setPin(newPin);

    // Auto-advance to next field
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits are entered
    if (value && index === 3) {
      const fullPin = newPin.join('');
      if (fullPin.length === 4) {
        handleSubmit(fullPin);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      const fullPin = pin.join('');
      if (fullPin.length === 4) {
        handleSubmit(fullPin);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '');
    const digits = pastedData.slice(0, 4).split('');
    
    const newPin = [...pin];
    digits.forEach((digit, idx) => {
      if (idx < 4) newPin[idx] = digit;
    });
    setPin(newPin);

    // Focus the next empty field or last field
    const nextIndex = Math.min(digits.length, 3);
    inputRefs.current[nextIndex]?.focus();

    // Auto-submit if 4 digits
    if (digits.length === 4) {
      setTimeout(() => handleSubmit(newPin.join('')), 100);
    }
  };

  const handleSubmit = async (fullPin: string) => {
    if (locked) return;
    if (fullPin.length !== 4) {
      setError('Please enter all 4 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check if user has a valid PIN
      const { data: pinRecords, error: pinError } = await supabase
        .from('pin_auth')
        .select('*')
        .eq('enabled', true);

      if (pinError) throw pinError;

      if (!pinRecords || pinRecords.length === 0) {
        setError('No PIN set up. Please contact admin.');
        return;
      }

      // Check if any PIN matches (simplified - in production use hashed PINs)
      // For now, we're checking if the PIN exists in the database
      // Ideally you'd use a hashed comparison
      const foundPin = pinRecords.find((record: any) => record.pin_hash === fullPin);

      if (foundPin) {
        // Create a session or mark as authenticated
        // Since we're using Supabase auth, we might want to create a session
        // For simplicity, we'll store a session flag
        localStorage.setItem('bt_authenticated', 'true');
        localStorage.setItem('bt_user_id', foundPin.user_id || '');
        toast('✅ PIN verified!');
        router.push('/');
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= 5) {
          setLocked(true);
          setLockTimer(30);
          setError('🔒 Too many failed attempts. Locked for 30 seconds.');
          toast('Too many failed attempts', 'error');
        } else {
          setError(`Invalid PIN. ${5 - newAttempts} attempts remaining.`);
          toast('Invalid PIN', 'error');
          // Clear the fields
          setPin(['', '', '', '']);
          inputRefs.current[0]?.focus();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error verifying PIN');
      toast('Error verifying PIN', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-500/10 text-sky-400 mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">BillsTracker</h1>
          <p className="text-sm text-slate-400">Enter your PIN to continue</p>
        </div>

        <div className="card p-6 space-y-6">
          {error && (
            <div className={`p-3 rounded-xl text-sm text-center ${
              locked ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
            }`}>
              {error}
            </div>
          )}

          {locked && lockTimer > 0 && (
            <div className="text-center text-slate-400 text-sm">
              ⏱️ {lockTimer}s remaining
            </div>
          )}

          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((index) => (
              <input
                key={index}
                id={`pin-${index}`}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={pin[index]}
                onChange={(e) => handlePinChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={loading || locked}
                className={`w-14 h-14 text-center text-2xl font-bold rounded-xl bg-slate-800 border-2 transition-all
                  ${loading || locked ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-500'}
                  ${error && !locked ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-sky-500'}
                  text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/30
                `}
                autoFocus={index === 0}
              />
            ))}
          </div>

          <div className="flex justify-center gap-2">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  pin[index] ? 'bg-sky-400' : 'bg-slate-600'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => {
              const fullPin = pin.join('');
              if (fullPin.length === 4) {
                handleSubmit(fullPin);
              } else {
                setError('Please enter all 4 digits');
              }
            }}
            disabled={loading || locked || pin.join('').length !== 4}
            className="w-full btn-primary"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verifying...
              </span>
            ) : (
              'Unlock'
            )}
          </button>

          <button
            onClick={() => {
              setPin(['', '', '', '']);
              inputRefs.current[0]?.focus();
              setError('');
            }}
            className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear PIN
          </button>
        </div>
      </div>
    </div>
  );
}