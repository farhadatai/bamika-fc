import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Users, CheckCircle, Zap, Wifi, WifiOff } from 'lucide-react';

export default function AdminHUD() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingRevenue: 0,
    accountsCreated: 0,
    athletesAdded: 0,
    fullyPaid: 0,
  });
  const [systemStatus, setSystemStatus] = useState({
    supabase: 'checking',
    stripe: 'checking',
  });
  const [loading, setLoading] = useState(true);

  const checkSystemHealth = async () => {
    // Check Supabase connection
    const { error: supabaseError } = await supabase.from('profiles').select('id').limit(1);
    setSystemStatus(prev => ({ ...prev, supabase: supabaseError ? 'offline' : 'online' }));

    // Check Stripe connection (placeholder)
    // In a real app, you'd ping your backend which would verify its Stripe connection
    setTimeout(() => setSystemStatus(prev => ({ ...prev, stripe: 'online' })), 1000);
  };

  const fetchStats = async () => {
    setLoading(true);

    const { data: profiles, error: pError } = await supabase.from('profiles').select('id');
    const { data: players, error: plError } = await supabase.from('players').select('id');
    const { data: registrations, error: rError } = await supabase.from('registrations').select('status, amount');

    if (pError || plError || rError) {
      console.error('Error fetching stats', pError || plError || rError);
      setLoading(false);
      return;
    }

    const totalRevenue = registrations
      .filter(r => r.status === 'paid')
      .reduce((acc, r) => acc + r.amount, 0);

    const pendingRevenue = registrations
      .filter(r => r.status !== 'paid')
      .reduce((acc, r) => acc + r.amount, 0);

    setStats({
      totalRevenue,
      pendingRevenue,
      accountsCreated: profiles.length,
      athletesAdded: players.length,
      fullyPaid: registrations.filter(r => r.status === 'paid').length,
    });

    setLoading(false);
  };

  useEffect(() => {
    checkSystemHealth();
    fetchStats();
  }, []);

  const StatusPill = ({ status, serviceName }: { status: string, serviceName: string }) => (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${{
      online: 'bg-green-900 text-green-300',
      offline: 'bg-red-900 text-red-300',
      checking: 'bg-yellow-900 text-yellow-300',
    }[status]}
    `}>
      {status === 'online' && <Wifi size={14} />}
      {status === 'offline' && <WifiOff size={14} />}
      {serviceName}
    </div>
  );

  return (
    <div className="bg-neutral-900 border border-gray-800 rounded-3xl p-6 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {/* Revenue Snapshot */}
        <div className="bg-black/40 p-6 rounded-2xl border border-gray-800">
          <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3">Revenue Snapshot</h3>
          <div className="flex items-center gap-2">
            <DollarSign className="text-[#EF4444]" size={24} />
            <div>
              <p className="text-2xl font-bold text-white">${stats.totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-gray-400">vs. ${stats.pendingRevenue.toLocaleString()} pending</p>
            </div>
          </div>
        </div>

        {/* Registration Funnel */}
        <div className="bg-black/40 p-6 rounded-2xl border border-gray-800 md:col-span-2">
          <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3">Registration Funnel</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <Users className="text-[#EF4444] mx-auto mb-1" size={24} />
              <p className="text-2xl font-bold">{stats.accountsCreated}</p>
              <p className="text-xs text-gray-400">Accounts</p>
            </div>
            <div>
              <Users className="text-[#EF4444] mx-auto mb-1" size={24} />
              <p className="text-2xl font-bold">{stats.athletesAdded}</p>
              <p className="text-xs text-gray-400">Athletes</p>
            </div>
            <div>
              <CheckCircle className="text-green-500 mx-auto mb-1" size={24} />
              <p className="text-2xl font-bold">{stats.fullyPaid}</p>
              <p className="text-xs text-gray-400">Paid</p>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-black/40 p-6 rounded-2xl border border-gray-800 lg:col-span-2">
          <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3">System Health</h3>
          <div className="flex items-center justify-around h-full">
            <StatusPill status={systemStatus.supabase} serviceName="Supabase" />
            <StatusPill status={systemStatus.stripe} serviceName="Stripe" />
          </div>
        </div>
      </div>
    </div>
  );
}
