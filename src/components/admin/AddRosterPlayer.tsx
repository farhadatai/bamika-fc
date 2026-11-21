import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, UserPlus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { TEAM_OPTIONS } from '../../lib/utils';
import { PLAYER_POSITION_OPTIONS } from '../../lib/formations';

// Admin "Add player" for the Roster tab. The player can be attached to an
// existing parent, a coach (their own kid), the admin's own account, or a new
// parent who is emailed an invite. "Waive fees" clears the player right away.

type Profileish = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  profiles?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
};

type Account = { id: string; name: string; email: string; kind: 'Parent' | 'Coach' | 'You' };

const JERSEY_SIZES = ['YXS', 'YS', 'YM', 'YL', 'YXL', 'S', 'M', 'L', 'XL', '2XL'];

const nameOf = (row: Profileish) => {
  const joined = [row.first_name || row.profiles?.first_name, row.last_name || row.profiles?.last_name].filter(Boolean).join(' ');
  return joined || row.name || row.full_name || '';
};

const emptyPlayer = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: 'Male',
  position: 'TBD',
  jersey_size: 'YM',
  team_assigned: 'Unassigned',
  medical_conditions: '',
};
const emptyParent = { first_name: '', last_name: '', email: '', phone: '' };

const inputClass = 'w-full rounded-lg border border-gray-800 bg-black px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-[#EF4444]';
const labelClass = 'mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500';

export default function AddRosterPlayer({
  parents,
  coaches,
  currentUser,
  onAdded,
}: {
  parents: Profileish[];
  coaches: Profileish[];
  currentUser: { id: string; email?: string | null } | null;
  onAdded: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [player, setPlayer] = useState(emptyPlayer);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [accountId, setAccountId] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [parent, setParent] = useState(emptyParent);
  const [waiveFees, setWaiveFees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const accounts = useMemo<Account[]>(() => {
    const list: Account[] = [];
    const seen = new Set<string>();
    const push = (account: Account) => {
      if (!account.id || seen.has(account.id)) return;
      seen.add(account.id);
      list.push(account);
    };
    if (currentUser?.id) push({ id: currentUser.id, name: 'My own account', email: currentUser.email || '', kind: 'You' });
    coaches.forEach((coach) => push({ id: coach.id, name: nameOf(coach) || 'Coach', email: coach.email || coach.profiles?.email || '', kind: 'Coach' }));
    parents.forEach((row) => push({ id: row.id, name: nameOf(row) || row.email || 'Parent', email: row.email || '', kind: 'Parent' }));
    return list;
  }, [parents, coaches, currentUser]);

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    const rows = q
      ? accounts.filter((a) => `${a.name} ${a.email} ${a.kind}`.toLowerCase().includes(q))
      : accounts;
    return rows.slice(0, 40);
  }, [accounts, accountSearch]);

  const selectedAccount = accounts.find((a) => a.id === accountId) || null;

  const reset = () => {
    setPlayer(emptyPlayer);
    setMode('existing');
    setAccountId('');
    setAccountSearch('');
    setParent(emptyParent);
    setWaiveFees(false);
    setError('');
  };

  const close = () => {
    if (saving) return;
    setOpen(false);
    reset();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (mode === 'existing' && !accountId) {
      setError('Choose the account this player belongs to, or switch to "New parent".');
      return;
    }
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Please sign in again.');

      const response = await fetch('/api/admin/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          player,
          waive_fees: waiveFees,
          account: mode === 'existing' ? { mode, profile_id: accountId } : { mode, ...parent },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not add the player.');

      setOpen(false);
      reset();
      onAdded(result.message || 'Player added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the player.');
    } finally {
      setSaving(false);
    }
  };

  const setP = (key: keyof typeof emptyPlayer) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setPlayer((current) => ({ ...current, [key]: event.target.value }));
  const setParentField = (key: keyof typeof emptyParent) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setParent((current) => ({ ...current, [key]: event.target.value }));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-[#EF4444] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-700"
      >
        <UserPlus size={13} /> Add player
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/80 p-4 sm:items-center" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <form onSubmit={submit} className="my-8 w-full max-w-2xl rounded-2xl border border-gray-800 bg-neutral-950 p-5 text-white sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black uppercase italic">Add a player</h3>
                <p className="mt-1 text-sm text-gray-500">The player shows up on the account's dashboard and in this roster.</p>
              </div>
              <button type="button" onClick={close} className="rounded-lg border border-gray-800 p-2 text-gray-400 hover:text-white" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <fieldset className="mb-5">
              <legend className="mb-3 text-[11px] font-black uppercase tracking-widest text-[#D4AF37]">Player</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label><span className={labelClass}>First name</span><input required value={player.first_name} onChange={setP('first_name')} className={inputClass} /></label>
                <label><span className={labelClass}>Last name</span><input required value={player.last_name} onChange={setP('last_name')} className={inputClass} /></label>
                <label><span className={labelClass}>Date of birth</span><input required type="date" value={player.date_of_birth} onChange={setP('date_of_birth')} className={inputClass} /></label>
                <label><span className={labelClass}>Gender</span>
                  <select value={player.gender} onChange={setP('gender')} className={inputClass}>
                    <option>Male</option><option>Female</option><option>Not specified</option>
                  </select>
                </label>
                <label><span className={labelClass}>Team</span>
                  <select value={player.team_assigned} onChange={setP('team_assigned')} className={inputClass}>
                    {TEAM_OPTIONS.map((team) => <option key={team} value={team}>{team}</option>)}
                  </select>
                </label>
                <label><span className={labelClass}>Position</span>
                  <select value={player.position} onChange={setP('position')} className={inputClass}>
                    <option value="TBD">TBD</option>
                    {PLAYER_POSITION_OPTIONS.map((entry) => (
                      <optgroup key={entry.group} label={entry.group}>
                        {entry.options.map((position) => <option key={position} value={position}>{position}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label><span className={labelClass}>Jersey size</span>
                  <select value={player.jersey_size} onChange={setP('jersey_size')} className={inputClass}>
                    {JERSEY_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
                <label className="sm:col-span-2"><span className={labelClass}>Medical notes / allergies (optional)</span>
                  <textarea rows={2} value={player.medical_conditions} onChange={setP('medical_conditions')} className={inputClass} />
                </label>
              </div>
            </fieldset>

            <fieldset className="mb-5">
              <legend className="mb-3 text-[11px] font-black uppercase tracking-widest text-[#D4AF37]">Attach to account</legend>
              <div className="mb-3 inline-flex rounded-lg border border-gray-800 p-1">
                {(['existing', 'new'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`rounded-md px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${mode === value ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                  >
                    {value === 'existing' ? 'Existing parent or coach' : 'New parent'}
                  </button>
                ))}
              </div>

              {mode === 'existing' ? (
                <div>
                  {selectedAccount ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black">{selectedAccount.name} <span className="ml-1 rounded bg-black/40 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-gray-300">{selectedAccount.kind}</span></div>
                        {selectedAccount.email && <div className="truncate text-xs text-gray-400">{selectedAccount.email}</div>}
                      </div>
                      <button type="button" onClick={() => setAccountId('')} className="text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white">Change</button>
                    </div>
                  ) : (
                    <>
                      <label className="relative block">
                        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                        <input
                          value={accountSearch}
                          onChange={(e) => setAccountSearch(e.target.value)}
                          placeholder="Search parents and coaches by name or email"
                          className={`${inputClass} pl-9`}
                        />
                      </label>
                      <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-800">
                        {filteredAccounts.length === 0 ? (
                          <p className="p-3 text-sm text-gray-500">No match. Use "New parent" to invite them.</p>
                        ) : filteredAccounts.map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => setAccountId(account.id)}
                            className="flex w-full items-center justify-between gap-3 border-b border-gray-900 px-3 py-2 text-left last:border-b-0 hover:bg-white/5"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold">{account.name}</span>
                              {account.email && <span className="block truncate text-xs text-gray-500">{account.email}</span>}
                            </span>
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${account.kind === 'Coach' ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : account.kind === 'You' ? 'bg-[#EF4444]/15 text-[#FCA5A5]' : 'bg-blue-500/15 text-blue-300'}`}>{account.kind}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label><span className={labelClass}>Parent first name</span><input required value={parent.first_name} onChange={setParentField('first_name')} className={inputClass} /></label>
                  <label><span className={labelClass}>Parent last name</span><input required value={parent.last_name} onChange={setParentField('last_name')} className={inputClass} /></label>
                  <label><span className={labelClass}>Parent email</span><input required type="email" value={parent.email} onChange={setParentField('email')} className={inputClass} /></label>
                  <label><span className={labelClass}>Phone (optional)</span><input type="tel" value={parent.phone} onChange={setParentField('phone')} className={inputClass} /></label>
                  <p className="text-xs leading-5 text-gray-500 sm:col-span-2">
                    If this email already has an account, the player is attached to it. Otherwise the parent gets an email to set a password and will see the player on their dashboard.
                  </p>
                </div>
              )}
            </fieldset>

            <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-lg border border-gray-800 bg-black p-3">
              <input type="checkbox" checked={waiveFees} onChange={(e) => setWaiveFees(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#EF4444]" />
              <span>
                <span className="block text-sm font-black uppercase tracking-wide">Waive fees</span>
                <span className="block text-xs text-gray-500">Player is cleared right away: no payment button for the family and no payment reminders. Leave unchecked to have the family set up the monthly payment.</span>
              </span>
            </label>

            {error && <p className="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm font-bold text-red-300">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={close} className="rounded-lg border border-gray-800 px-4 py-2.5 text-xs font-black uppercase text-gray-300 hover:text-white">Cancel</button>
              <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#EF4444] px-5 py-2.5 text-xs font-black uppercase text-white hover:bg-red-700 disabled:opacity-60">
                <UserPlus size={14} /> {saving ? 'Adding…' : 'Add player'}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}
