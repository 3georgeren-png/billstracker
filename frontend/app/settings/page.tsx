'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Shield, Lock, Info, Trash2, RefreshCw, Check, X, AlertCircle,
  Moon, Sun, Globe, Database, Smartphone, Laptop, ShieldCheck,
  Key, Fingerprint, Bell, User, Settings as SettingsIcon,
  ChevronRight, ExternalLink, Sparkles, Zap, Cpu, Wifi,
  Save
} from 'lucide-react';
import { toast } from '@/components/ui/Toaster';

const PIN_HASH_KEY = 'bt_pin_hash';

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  // SMS Reminders state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneSaved, setPhoneSaved] = useState(false);

  useEffect(() => {
    setMounted(true);
    checkPinStatus();
    const savedTheme = localStorage.getItem('bt_theme') as 'light' | 'dark' || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Load saved phone number
    const savedPhone = localStorage.getItem('bt_phone_number');
    if (savedPhone) {
      setPhoneNumber(savedPhone);
      setPhoneSaved(true);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('bt_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    toast(`Switched to ${newTheme} mode`);
  };

  // Save phone number
  const savePhoneNumber = () => {
    if (!phoneNumber || phoneNumber.trim() === '') {
      toast('Please enter a valid phone number', 'error');
      return;
    }
    localStorage.setItem('bt_phone_number', phoneNumber.trim());
    setPhoneSaved(true);
    toast('✅ Phone number saved!');
  };

  // ✅ Check PIN status from Supabase
  const checkPinStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pin_auth')
        .select('*')
        .eq('is_enabled', true)
        .limit(1);

      if (error) {
        console.error('Error checking PIN:', error);
        // Fallback to localStorage
        const localPin = localStorage.getItem(PIN_HASH_KEY);
        setPinEnabled(!!localPin);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        setPinEnabled(true);
        localStorage.setItem(PIN_HASH_KEY, data[0].pin_hash);
      } else {
        setPinEnabled(false);
      }
    } catch (error) {
      console.error('Error in checkPinStatus:', error);
      const localPin = localStorage.getItem(PIN_HASH_KEY);
      setPinEnabled(!!localPin);
    } finally {
      setLoading(false);
    }
  };

  const hashPin = (pin: string): string => {
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
      hash = ((hash << 5) - hash) + pin.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  };

  // ✅ Save PIN to Supabase
  const savePin = async () => {
    setError('');
    setSuccess('');

    if (newPin.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    try {
      const hashedPin = hashPin(newPin);

      // Check if PIN already exists
      const { data: existing, error: checkError } = await supabase
        .from('pin_auth')
        .select('id')
        .eq('is_enabled', true)
        .limit(1);

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing PIN:', checkError);
        setError('Database error');
        return;
      }

      let result;

      if (existing && existing.length > 0) {
        // Update existing
        result = await supabase
          .from('pin_auth')
          .update({
            pin_hash: hashedPin,
            is_enabled: true,
            device_name: navigator.userAgent || 'Unknown',
            updated: new Date().toISOString(),
          })
          .eq('id', existing[0].id);
      } else {
        // Create new
        result = await supabase
          .from('pin_auth')
          .insert([{
            pin_hash: hashedPin,
            is_enabled: true,
            device_name: navigator.userAgent || 'Unknown',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          }]);
      }

      if (result.error) {
        console.error('Error saving PIN:', result.error);
        setError('Failed to save PIN');
        return;
      }

      localStorage.setItem(PIN_HASH_KEY, hashedPin);
      setPinEnabled(true);
      setSuccess('PIN set successfully! ✅');
      toast('✅ PIN set successfully!');
      setNewPin('');
      setConfirmPin('');
      setIsSettingPin(false);
      try { localStorage.removeItem('bt_pin_verified'); } catch {}
      
    } catch (err: any) {
      console.error('Error saving PIN:', err);
      setError(`Failed to save: ${err.message || 'Unknown error'}`);
    }
  };

  // ✅ Remove PIN from Supabase
  const removePin = async () => {
    try {
      const { data: existing, error: checkError } = await supabase
        .from('pin_auth')
        .select('id')
        .eq('is_enabled', true)
        .limit(1);

      if (checkError) {
        console.error('Error checking existing PIN:', checkError);
        // Fallback: just clear localStorage
        localStorage.removeItem(PIN_HASH_KEY);
        localStorage.removeItem('bt_pin_verified');
        setPinEnabled(false);
        toast('PIN disabled successfully');
        return;
      }

      if (existing && existing.length > 0) {
        const { error: updateError } = await supabase
          .from('pin_auth')
          .update({
            is_enabled: false,
            updated: new Date().toISOString(),
          })
          .eq('id', existing[0].id);

        if (updateError) {
          console.error('Error disabling PIN:', updateError);
        }
      }
      
      localStorage.removeItem(PIN_HASH_KEY);
      localStorage.removeItem('bt_pin_verified');
      setPinEnabled(false);
      toast('PIN disabled successfully');
      setNewPin('');
      setConfirmPin('');
      setIsSettingPin(false);
      
    } catch (error) {
      console.error('Error removing PIN:', error);
      localStorage.removeItem(PIN_HASH_KEY);
      localStorage.removeItem('bt_pin_verified');
      setPinEnabled(false);
      toast('PIN disabled successfully');
    }
  };

  const lockApp = () => {
    try { localStorage.removeItem('bt_pin_verified'); } catch {}
    toast('App locked');
    setTimeout(() => window.location.reload(), 800);
  };

  const clearCache = async () => {
    try {
      const pin = localStorage.getItem(PIN_HASH_KEY);
      const theme = localStorage.getItem('bt_theme');
      
      localStorage.clear();
      
      if (pin) localStorage.setItem(PIN_HASH_KEY, pin);
      if (theme) localStorage.setItem('bt_theme', theme);

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k: string) => caches.delete(k)));
      }
      toast('Cache cleared — reloading...');
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      toast('Could not clear cache', 'error');
    }
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 md:px-6 pt-[72px] sm:pt-2 pb-24 sm:pb-6">
        <div className="w-full max-w-full">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-700/30 rounded w-1/3"></div>
            <div className="h-20 bg-slate-700/30 rounded-xl"></div>
            <div className="h-32 bg-slate-700/30 rounded-xl"></div>
            <div className="h-32 bg-slate-700/30 rounded-xl"></div>
            <div className="h-32 bg-slate-700/30 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 md:px-6 pt-[72px] sm:pt-2 pb-24 sm:pb-6">
      <div className="w-full max-w-full">
        
        {/* ── Header ── */}
        <div 
          className="flex items-center justify-between gap-3 min-h-[44px] sm:min-h-[56px] p-3 sm:p-4 rounded-xl border backdrop-blur-sm transition-all duration-300"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            marginTop: '0px',
            position: 'relative',
            zIndex: 10
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-accent-bg)' }}
            >
              <SettingsIcon size={18} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h1 
                className="text-xl sm:text-2xl font-bold tracking-tight truncate"
                style={{ color: 'var(--color-text)' }}
              >
                Settings
              </h1>
              <p 
                className="text-[10px] sm:text-xs font-medium tracking-wider uppercase"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Manage your app preferences
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-all touch-target"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {/* Version Badge */}
            <span className="hidden sm:inline text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              v1.0.0
            </span>
          </div>
        </div>

        {/* ── Theme Card ── */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-accent-bg)' }}>
                {theme === 'dark' ? <Moon size={18} style={{ color: 'var(--color-accent)' }} /> : <Sun size={18} style={{ color: 'var(--color-accent)' }} />}
              </div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Appearance</h3>
                <p className="text-xs capitalize" style={{ color: 'var(--color-text-muted)' }}>{theme} mode</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs capitalize" style={{ color: 'var(--color-text-dim)' }}>{theme}</span>
              <button
                onClick={toggleTheme}
                className="relative w-12 h-7 rounded-full transition-colors flex items-center px-1"
                style={{ backgroundColor: 'var(--color-surface-2)' }}
              >
                <div 
                  className={`w-5 h-5 rounded-full transition-all duration-300`}
                  style={{ 
                    backgroundColor: 'var(--color-accent)',
                    transform: theme === 'light' ? 'translateX(20px)' : 'translateX(0)'
                  }} 
                />
              </button>
            </div>
          </div>
        </div>

        {/* ── SMS Reminders Card ── */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 mt-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-accent-bg)' }}>
              <Smartphone size={18} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>SMS Reminders</h3>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Get SMS alerts for overdue bills</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="tel"
              placeholder="+44 123 456 789"
              className="input flex-1"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
            />
            <button 
              onClick={savePhoneNumber} 
              className="btn-primary px-4 py-2.5 flex items-center gap-2"
            >
              <Save size={16} /> Save Number
            </button>
          </div>
          
          <p className="text-[10px] mt-2" style={{ color: 'var(--color-text-dim)' }}>
            📱 Free SMS (1 per day) • Include country code (e.g., +44 for UK)
          </p>
          
          {phoneSaved && (
            <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                ✅ Number saved: <span className="font-mono">{phoneNumber}</span>
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Auto-SMS will send when bills are overdue or due soon
              </p>
            </div>
          )}
        </div>

        {/* ── Security Section ── */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 mt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ 
              backgroundColor: pinEnabled ? 'var(--color-success-bg)' : 'var(--color-accent-bg)' 
            }}>
              <Shield size={18} style={{ color: pinEnabled ? 'var(--color-success)' : 'var(--color-accent)' }} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Security</h3>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {pinEnabled ? 'PIN protection enabled' : 'No PIN set'}
              </p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              pinEnabled 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' 
                : 'bg-slate-700/40 text-slate-400 border border-slate-600'
            }`}>
              {pinEnabled ? '🔒 Protected' : '🔓 Unlocked'}
            </span>
          </div>

          {pinEnabled ? (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Your PIN is synced across all devices</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={lockApp}
                  className="px-4 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 touch-target"
                >
                  <Lock size={14} /> Lock App
                </button>
                <button
                  onClick={removePin}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 touch-target"
                >
                  <Trash2 size={14} /> Disable PIN
                </button>
              </div>
            </div>
          ) : (
            <div>
              {!isSettingPin ? (
                <button
                  onClick={() => setIsSettingPin(true)}
                  className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-400 hover:to-blue-400 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-sky-500/20 flex items-center gap-2 touch-target"
                >
                  <Lock size={14} /> Set PIN
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>New PIN (4 digits)</label>
                      <input
                        type="password"
                        maxLength={4}
                        value={newPin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (val.length <= 4) setNewPin(val);
                          setError('');
                          setSuccess('');
                        }}
                        className="input text-center text-xl tracking-[8px]"
                        placeholder="••••"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>Confirm PIN</label>
                      <input
                        type="password"
                        maxLength={4}
                        value={confirmPin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (val.length <= 4) setConfirmPin(val);
                          setError('');
                          setSuccess('');
                        }}
                        className="input text-center text-xl tracking-[8px]"
                        placeholder="••••"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-400">
                      <AlertCircle size={16} /> {error}
                    </div>
                  )}
                  {success && (
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                      <Check size={16} /> {success}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={savePin}
                      disabled={newPin.length !== 4 || confirmPin.length !== 4}
                      className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Check size={14} /> Set PIN
                    </button>
                    <button
                      onClick={() => {
                        setIsSettingPin(false);
                        setNewPin('');
                        setConfirmPin('');
                        setError('');
                        setSuccess('');
                      }}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <X size={14} /> Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Cache & Storage ── */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 mt-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-accent-bg)' }}>
              <Database size={18} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Cache & Storage</h3>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Clear cached data if needed</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={clearCache} className="btn-secondary text-sm px-4 py-2 flex items-center gap-2 touch-target">
              <RefreshCw size={14} /> Clear Cache
            </button>
            <button onClick={() => window.location.reload()} className="btn-ghost text-sm px-4 py-2 flex items-center gap-2 touch-target">
              <RefreshCw size={14} /> Reload
            </button>
          </div>
        </div>

        {/* ── About ── */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 mt-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-accent-bg)' }}>
              <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>About BillsTracker</h3>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Home Edition</p>
            </div>
          </div>
          <div className="space-y-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <p className="flex items-center gap-2">
              <span>Built with</span>
              <span style={{ color: 'var(--color-accent)' }}>Next.js</span>
              <span>+</span>
              <span style={{ color: 'var(--color-success)' }}>Supabase</span>
            </p>
            <p>PIN synced across all devices</p>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-dim)' }}>Version 1.0.0</p>
          </div>
        </div>

      </div>
    </div>
  );
}
