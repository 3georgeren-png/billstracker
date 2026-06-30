'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestSupabase() {
  const [billers, setBillers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function testConnection() {
      try {
        const { data, error } = await supabase
          .from('billers')
          .select('*')
          .order('name');

        if (error) throw error;
        setBillers(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    testConnection();
  }, []);

  if (loading) return <div className="p-4">Testing connection...</div>;
  if (error) return <div className="p-4 text-red-500">❌ Error: {error}</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-green-600 mb-4">✅ Supabase Connected!</h1>
      <p className="text-gray-600 mb-4">Found {billers.length} billers</p>
      <div className="bg-gray-100 p-4 rounded-lg max-h-96 overflow-auto">
        <pre className="text-sm">
          {JSON.stringify(billers, null, 2)}
        </pre>
      </div>
    </div>
  );
}
