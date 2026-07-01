'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [pinData, setPinData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    async function testConnection() {
      try {
        setStatus('🔑 Testing Supabase connection...');
        
        // Test: Fetch from pin_auth table
        const { data: pinAuth, error: pinError } = await supabase
          .from('pin_auth')
          .select('*')
          .limit(5);

        if (pinError) {
          setError(pinError.message);
          setStatus('❌ Error: ' + pinError.message);
          console.error('Pin Auth Error:', pinError);
        } else {
          setPinData(pinAuth || []);
          setStatus(`✅ Connected! Found ${pinAuth?.length || 0} PIN records`);
        }
      } catch (err: any) {
        setError(err.message);
        setStatus('❌ Error: ' + err.message);
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    }

    testConnection();
  }, []);

  return (
    <div className="p-8 max-w-3xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-4">🔐 Supabase PIN Auth Test</h1>
      
      <div className={`p-4 rounded-lg mb-6 ${
        status.includes('✅') ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
        status.includes('❌') ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
        'bg-blue-500/10 text-blue-400 border border-blue-500/20'
      }`}>
        {status}
      </div>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4 text-red-400">
          <strong>Error Details:</strong> {error}
        </div>
      )}
      
      <div className="bg-slate-800/50 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-2">📋 PIN Records:</h2>
        {loading ? (
          <p className="text-slate-400">Loading...</p>
        ) : pinData.length === 0 ? (
          <p className="text-slate-400">No PIN records found in pin_auth table</p>
        ) : (
          <pre className="text-xs text-slate-300 overflow-auto max-h-96">
            {JSON.stringify(pinData, null, 2)}
          </pre>
        )}
      </div>

      <div className="mt-4 text-xs text-slate-500 border-t border-slate-700 pt-4">
        <p>🔑 Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
        <p>🔑 Key length: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0}</p>
      </div>
    </div>
  );
}
