import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Clock,
  CreditCard,
  ExternalLink,
  HandHeart,
  MapPin,
  Megaphone,
  Play,
  Save,
  Shield,
  Shirt,
  Target,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  team_id?: string | null;
  player_id?: string | null;
  priority: string;
  is_pinned: boolean;
  created_at: string;
}

interface PlayerSummary {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  age_group?: string | null;
  team_assigned?: string | null;
  position?: string | null;
  jersey_number?: string | null;
  jersey_size?: string | null;
  payment_status?: string | null;
  status?: string | null;
  photo_url?: string | null;
  uniform_purchased?: boolean | null;
  uniform_confirmation_code?: string | null;
}

interface ScheduleItem {
  id: string;
  title: string;
  date: string;
  time?: string | null;
  location?: string | null;
  type: 'practice' | 'match';
}

interface SponsorSpotlight {
  id: string;
  title: string;
  subtitle?: string | null;
  body: string;
  image_url?: string | null;
  link_url?: string | null;
}

interface UniformOrder {
  id: string;
  player_id?: string | null;
  player_name: string;
  jersey_size?: string | null;
  jersey_number?: string | null;
  team_assigned?: string | null;
  amount_cents?: number | null;
  payment_status?: string | null;
  status?: string | null;
  confirmation_code?: string | null;
  created_at?: string | null;
  paid_at?: string | null;
}

interface ProfileSummary {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
}

interface FamilyAddress {
  address: string;
  city: string;
  state: string;
  zip: string;
}

const EMPTY_FAMILY_ADDRESS: FamilyAddress = {
  address: '',
  city: '',
  state: '',
  zip: '',
};

const getInitials = (firstName = '', lastName = '') => {
  const first = firstName.trim()[0] || '';
  const last = lastName.trim()[0] || '';
  return `${first}${last}`.toUpperCase() || 'FC';
};

const getPlayerName = (player?: PlayerSummary | null) => {
  if (!player) return 'Bamika Player';
  return `${player.first_name || ''} ${player.last_name || ''}`.trim() || player.full_name || 'Bamika Player';
};

const getPlayerInitials = (player?: PlayerSummary | null) => {
  const name = getPlayerName(player);
  const [first = '', ...rest] = name.split(' ');
  return getInitials(first, rest.join(' '));
};

const formatDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const statusClass = (status?: string | null) => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'paid' || normalized === 'active' || normalized === 'waived') return 'text-green-300 bg-green-500/10 border-green-500/30';
  if (normalized === 'pending') return 'text-yellow-200 bg-yellow-500/10 border-yellow-500/30';
  return 'text-gray-300 bg-gray-500/10 border-gray-700';
};

const COACH_MESSAGE_PREFIX = '__BAMIKA_COACH__:';

const parseCoachMessage = (body = '') => {
  if (!body.startsWith(COACH_MESSAGE_PREFIX)) {
    return { coachName: 'Coach', body };
  }

  const [firstLine = '', ...rest] = body.split('\n');
  return {
    coachName: firstLine.replace(COACH_MESSAGE_PREFIX, '').trim() || 'Coach',
    body: rest.join('\n').trim(),
  };
};

const getProfileFirstName = (profile?: ProfileSummary | null, email?: string | null, metadata?: Record<string, unknown>) => {
  const firstName = profile?.first_name?.trim();
  if (firstName) return firstName;

  const fullName = profile?.full_name?.trim();
  if (fullName) return fullName.split(/\s+/)[0];

  const emailName = profile?.email?.split('@')[0] || email?.split('@')[0];
  if (emailName) return emailName;

  const metadataFirstName = typeof metadata?.first_name === 'string' ? metadata.first_name.trim() : '';
  if (metadataFirstName) return metadataFirstName;

  const metadataFullName = typeof metadata?.full_name === 'string' ? metadata.full_name.trim() : '';
  if (metadataFullName) return metadataFullName.split(/\s+/)[0];

  return 'Bamika Family';
};

export default function Dashboard() {
  const { user, userRole } = useAuthStore();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [familyAddress, setFamilyAddress] = useState<FamilyAddress>(EMPTY_FAMILY_ADDRESS);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressMessage, setAddressMessage] = useState('');
  const [addressError, setAddressError] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [teamMessages, setTeamMessages] = useState<Announcement[]>([]);
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [sponsors, setSponsors] = useState<SponsorSpotlight[]>([]);
  const [uniformOrders, setUniformOrders] = useState<UniformOrder[]>([]);
  const [selectedUniformPlayerId, setSelectedUniformPlayerId] = useState('');
  const [uniformOrderLoading, setUniformOrderLoading] = useState<string | null>(null);
  const [uniformOrderError, setUniformOrderError] = useState('');
  const [loading, setLoading] = useState(true);
  const [payLoadingId, setPayLoadingId] = useState<string | null>(null);
  const [payError, setPayError] = useState('');

  // Lets a parent start the monthly membership payment for a player who
  // registered but never finished the Stripe checkout. Reuses the same
  // checkout endpoint as registration; once paid, the player is marked paid
  // automatically by the Stripe-sync bridge (no manual sync needed).
  const isPlayerPaid = (player: PlayerSummary) =>
    (player.payment_status || '').toLowerCase() === 'paid'
    || (player.payment_status || '').toLowerCase() === 'active';

  const handlePayNow = async (player: PlayerSummary) => {
    setPayError('');
    setPayLoadingId(player.id);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player.id,
          registrationData: {
            first_name: player.first_name || '',
            last_name: player.last_name || '',
            status: 'pending_payment',
            payment_status: 'pending',
          },
          successUrl: `${window.location.origin}/dashboard?paid=true`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not start payment.');
      if (!data.url) throw new Error('Payment link was not returned. Please try again.');
      window.location.href = data.url;
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : 'Could not start payment.');
      setPayLoadingId(null);
    }
  };

  const firstName = getProfileFirstName(profile, user?.email, user?.user_metadata);
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const isAdmin = userRole === 'admin';
  const isCoach = userRole === 'coach';
  const isParent = !isAdmin && !isCoach;

  useEffect(() => {
    const fetchHubData = async () => {
      if (!user) return;
      setLoading(true);

      const audiences = userRole === 'coach'
        ? ['coaches', 'everyone', 'public']
        : userRole === 'admin'
          ? ['coaches', 'parents', 'everyone', 'public']
          : ['parents', 'everyone', 'public'];

      const [
        profileResponse,
        addressResponse,
        announcementsResponse,
        playersResponse,
        practicesResponse,
        matchesResponse,
        sponsorsResponse,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('first_name, last_name, full_name, email')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('family_addresses')
          .select('address, city, state, zip')
          .eq('parent_id', user.id)
          .maybeSingle(),
        supabase
          .from('announcements')
          .select('*')
          .in('audience', audiences)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('players')
          .select('*')
          .eq('parent_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('events')
          .select('id, title, date, time, location')
          .gte('date', today)
          .order('date', { ascending: true })
          .order('time', { ascending: true })
          .limit(3),
        supabase
          .from('games')
          .select('id, opponent, date, time, location')
          .gte('date', today)
          .order('date', { ascending: true })
          .order('time', { ascending: true })
          .limit(3),
        supabase
          .from('recognition_items')
          .select('id, title, subtitle, body, image_url, link_url')
          .eq('type', 'sponsor')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(2),
      ]);

      if (profileResponse.error) {
        console.warn('Profile unavailable for dashboard greeting:', profileResponse.error);
        setProfile(null);
      } else {
        setProfile(profileResponse.data || null);
      }

      if (addressResponse.error) {
        console.warn('Family address unavailable:', addressResponse.error);
        setFamilyAddress(EMPTY_FAMILY_ADDRESS);
      } else {
        setFamilyAddress(addressResponse.data || EMPTY_FAMILY_ADDRESS);
      }

      let teamAnnouncements: Announcement[] = [];
      let parentUniformOrders: UniformOrder[] = [];
      const basePlayers = isParent ? playersResponse.data || [] : [];

      if (isParent) {
        const { data: uniformData, error: uniformError } = await supabase
          .from('uniform_orders')
          .select('*')
          .eq('parent_id', user.id)
          .order('created_at', { ascending: false });

        if (uniformError) {
          console.warn('Uniform orders unavailable:', uniformError);
        } else {
          parentUniformOrders = uniformData || [];
        }

        const teams = [...new Set(basePlayers.map((player) => player.team_assigned).filter((team) => team && team !== 'Unassigned'))];
        const playerIds = basePlayers.map((player) => player.id).filter(Boolean);

        if (teams.length > 0) {
          const { data: teamData, error: teamMessagesError } = await supabase
            .from('announcements')
            .select('*')
            .eq('audience', 'team')
            .in('team_id', teams)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });

          if (teamMessagesError) {
            console.warn('Team messages unavailable:', teamMessagesError);
          } else {
            teamAnnouncements = teamData || [];
          }
        }

        if (playerIds.length > 0) {
          const { data: playerData, error: playerMessagesError } = await supabase
            .from('announcements')
            .select('*')
            .eq('audience', 'player')
            .in('player_id', playerIds)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });

          if (playerMessagesError) {
            console.warn('Player messages unavailable:', playerMessagesError);
          } else {
            teamAnnouncements = [...teamAnnouncements, ...(playerData || [])];
          }
        }
      }

      const teamWideAnnouncements = teamAnnouncements.filter((announcement) => announcement.audience !== 'player');
      const mergedAnnouncements = [...(announcementsResponse.data || []), ...teamWideAnnouncements]
        .filter((announcement, index, all) => all.findIndex((item) => item.id === announcement.id) === index)
        .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 4);

      const practiceItems: ScheduleItem[] = (practicesResponse.data || []).map((event) => ({
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        location: event.location,
        type: 'practice',
      }));

      const matchItems: ScheduleItem[] = (matchesResponse.data || []).map((game) => ({
        id: game.id,
        title: `vs. ${game.opponent}`,
        date: game.date,
        time: game.time,
        location: game.location,
        type: 'match',
      }));

      setAnnouncements(mergedAnnouncements);
      setTeamMessages(teamAnnouncements);
      setPlayers(basePlayers);
      setUniformOrders(parentUniformOrders);
      setSponsors(sponsorsResponse.error ? [] : sponsorsResponse.data || []);
      setSchedule([...practiceItems, ...matchItems].sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`)).slice(0, 4));
      setLoading(false);
    };

    fetchHubData();
  }, [today, user, userRole, isParent]);

  useEffect(() => {
    if (!players.length) {
      setSelectedUniformPlayerId('');
      return;
    }

    if (!players.some((player) => player.id === selectedUniformPlayerId)) {
      setSelectedUniformPlayerId(players[0].id);
    }
  }, [players, selectedUniformPlayerId]);

  const primaryPlayer = players[0];
  const selectedUniformPlayer = players.find((player) => player.id === selectedUniformPlayerId) || players[0];
  const selectedUniformPlayerOrders = selectedUniformPlayer
    ? uniformOrders.filter((order) => order.player_id === selectedUniformPlayer.id)
    : [];
  const getPlayerMessages = (player: PlayerSummary) => teamMessages
    .filter((message) => (
      (message.audience === 'player' && message.player_id === player.id)
      || (message.audience === 'team' && message.team_id && message.team_id === player.team_assigned)
    ))
    .slice(0, 2);

  const quickActions = [
    ...(userRole === 'admin'
      ? [{ title: 'Open Admin Tools', body: 'Manage registrations, rosters, coaches, schedules, payments, sponsors, and club content.', to: '/admin', icon: Shield }]
      : []),
    ...(userRole === 'coach'
      ? [{ title: 'Open Coach Tools', body: 'Manage your assigned roster, player details, and team communication.', to: '/coach', icon: Users }]
      : []),
    ...(isParent
      ? [
        { title: players.length > 0 ? 'Add Athlete' : 'Register Athlete', body: players.length > 0 ? 'Add another player to your family account.' : 'Start the player registration process for your family.', to: '/register-new-athlete', icon: User },
        { title: 'Training Lab', body: 'Watch Bamika FC drills and player tutorials.', to: '/training-lab', icon: Play },
      ]
      : []),
  ];
  const welcomeTitle = isAdmin ? 'Admin Dashboard' : isCoach ? 'Coach Dashboard' : 'Family Dashboard';
  const welcomeBody = isAdmin
    ? 'A clean overview for club operations. Use Admin Tools when you need to manage records, payments, rosters, schedules, sponsors, and content.'
    : isCoach
      ? 'A focused coach overview. Use Coach Tools for roster updates, player details, and team messages.'
      : 'Track player status, upcoming practices, match days, announcements, and family resources in one place.';

  const handleUniformOrder = async () => {
    if (!selectedUniformPlayer) return;
    setUniformOrderError('');
    setUniformOrderLoading(selectedUniformPlayer.id);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error('Please log in again before ordering a uniform.');
      }

      const response = await fetch('/api/uniform-orders/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ playerId: selectedUniformPlayer.id }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to start uniform checkout.');

      if (result.url) {
        window.location.href = result.url;
        return;
      }

      throw new Error('Stripe did not return a checkout link.');
    } catch (error) {
      setUniformOrderError(error instanceof Error ? error.message : 'Unable to start uniform checkout.');
      setUniformOrderLoading(null);
    }
  };

  const handleAddressSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    setAddressMessage('');
    setAddressError('');

    const normalizedAddress = {
      address: familyAddress.address.trim(),
      city: familyAddress.city.trim(),
      state: familyAddress.state.trim().toUpperCase(),
      zip: familyAddress.zip.trim(),
    };

    if (Object.values(normalizedAddress).some((value) => !value)) {
      setAddressError('Street address, city, state, and ZIP are all required.');
      return;
    }

    if (!/^\d{5}(?:-\d{4})?$/.test(normalizedAddress.zip)) {
      setAddressError('Enter a valid 5-digit ZIP code or ZIP+4.');
      return;
    }

    setAddressSaving(true);
    const { data: savedAddress, error } = await supabase
      .from('family_addresses')
      .upsert({
        parent_id: user.id,
        ...normalizedAddress,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'parent_id' })
      .select('address, city, state, zip')
      .single();

    if (error) {
      setAddressError(error.message || 'Unable to save the family address.');
    } else {
      setFamilyAddress(savedAddress || normalizedAddress);
      setAddressMessage(`Address saved and linked to ${players.length} athlete${players.length === 1 ? '' : 's'}.`);
    }
    setAddressSaving(false);
  };

  return (
    <div className="w-full py-6 text-white sm:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-2xl border border-gray-800 bg-neutral-950">
          <div className={`grid gap-0 ${isParent && primaryPlayer ? 'lg:grid-cols-[1.4fr_0.8fr]' : ''}`}>
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#FCA5A5]">
                Central hub
              </div>
              <h1 className="max-w-3xl text-4xl font-black uppercase italic leading-tight text-white sm:text-5xl">
                {welcomeTitle}, <span className="text-[#EF4444]">{firstName}</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-gray-400">
                {welcomeBody}
              </p>

              <div className={`mt-8 grid gap-3 ${isParent ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
                {isParent && (
                <div className="rounded-xl border border-gray-800 bg-black p-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <Users size={15} className="text-[#EF4444]" />
                    Athletes
                  </div>
                  <div className="mt-2 text-3xl font-black">{players.length}</div>
                </div>
                )}
                {isAdmin && (
                <div className="rounded-xl border border-gray-800 bg-black p-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <Shield size={15} className="text-[#EF4444]" />
                    Admin tools
                  </div>
                  <div className="mt-2 text-3xl font-black">Open</div>
                </div>
                )}
                {isCoach && (
                <div className="rounded-xl border border-gray-800 bg-black p-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <Users size={15} className="text-[#EF4444]" />
                    Coach tools
                  </div>
                  <div className="mt-2 text-3xl font-black">Open</div>
                </div>
                )}
                <div className="rounded-xl border border-gray-800 bg-black p-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <CalendarDays size={15} className="text-[#EF4444]" />
                    Upcoming
                  </div>
                  <div className="mt-2 text-3xl font-black">{schedule.length}</div>
                </div>
                <div className="rounded-xl border border-gray-800 bg-black p-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <Megaphone size={15} className="text-[#EF4444]" />
                    Updates
                  </div>
                  <div className="mt-2 text-3xl font-black">{announcements.length}</div>
                </div>
              </div>
            </div>

            <div className={`border-t border-gray-800 bg-[linear-gradient(140deg,#171717,#000)] p-6 sm:p-8 lg:border-l lg:border-t-0 ${isParent && primaryPlayer ? '' : 'hidden'}`}>
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Featured athlete</div>
              {primaryPlayer ? (
                <div className="mt-5">
                  <div className="flex items-center gap-4">
                    {primaryPlayer.photo_url ? (
                      <img src={primaryPlayer.photo_url} alt={getPlayerName(primaryPlayer)} className="h-20 w-20 rounded-2xl border border-gray-800 object-cover" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-gray-800 bg-neutral-900 text-xl font-black text-[#EF4444]">
                        {getPlayerInitials(primaryPlayer)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate text-2xl font-black uppercase italic">{getPlayerName(primaryPlayer)}</h2>
                      <p className="mt-1 text-sm font-bold text-gray-400">{primaryPlayer.team_assigned || 'Unassigned'} • {primaryPlayer.age_group || 'Age group TBA'}</p>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-gray-800 bg-black p-3">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500"><Target size={14} /> Position</div>
                      <div className="mt-2 font-black">{primaryPlayer.position || 'TBD'}</div>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-black p-3">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500"><Shirt size={14} /> Jersey</div>
                      <div className="mt-2 font-black">{primaryPlayer.jersey_number || primaryPlayer.jersey_size || 'TBD'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-gray-800 bg-black p-6">
                  <Trophy className="text-[#EF4444]" size={32} />
                  <h2 className="mt-4 text-xl font-black uppercase italic">No athlete yet</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-500">Register your player to unlock team placement, uniform, and payment status here.</p>
                  <Link to="/register-new-athlete" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#EF4444] px-4 py-2 text-xs font-black uppercase text-white">
                    Register athlete <ArrowRight size={15} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {sponsors.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-[#D4AF37]/30 bg-neutral-950 shadow-2xl shadow-black/30">
            <div className="border-b border-[#D4AF37]/20 bg-[#D4AF37]/10 px-5 py-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">
                <HandHeart size={15} />
                Bamika FC sponsor spotlight
              </div>
            </div>
            <div className="grid gap-0 lg:grid-cols-2">
              {sponsors.map((sponsor) => (
                <article key={sponsor.id} className="grid gap-0 border-b border-gray-800 last:border-b-0 sm:grid-cols-[220px_1fr] lg:border-b-0 lg:border-r lg:last:border-r-0 lg:border-gray-800">
                  <div className="bg-black p-4">
                    {sponsor.image_url ? (
                      <img src={sponsor.image_url} alt={sponsor.title} className="h-44 w-full rounded-xl border border-gray-800 bg-black object-contain" />
                    ) : (
                      <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-gray-800 bg-black">
                        <HandHeart className="text-[#D4AF37]" size={42} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center p-5">
                    {sponsor.subtitle && <p className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">{sponsor.subtitle}</p>}
                    <h2 className="mt-2 text-2xl font-black uppercase italic text-white">{sponsor.title}</h2>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-400">{sponsor.body}</p>
                    {sponsor.link_url && (
                      <a href={sponsor.link_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black hover:bg-white">
                        View Sponsor <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {isParent && (
          <section className="rounded-2xl border border-blue-500/30 bg-neutral-950 p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-300">
                  <MapPin size={15} /> Family profile
                </div>
                <h2 className="mt-2 text-xl font-black uppercase italic text-white">Mailing Address</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
                  This address is securely linked to every athlete in your family and is used for required GotSport registration exports.
                </p>
              </div>
              <span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${Object.values(familyAddress).every(Boolean) ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'}`}>
                {Object.values(familyAddress).every(Boolean) ? 'Address complete' : 'Address needed'}
              </span>
            </div>

            <form onSubmit={handleAddressSave} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_0.55fr_0.7fr_auto]">
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">Street address</span>
                <input required value={familyAddress.address} onChange={(event) => setFamilyAddress((current) => ({ ...current, address: event.target.value }))} autoComplete="street-address" className="w-full rounded-lg border border-gray-800 bg-black px-3 py-3 text-sm font-bold text-white outline-none focus:border-blue-400" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">City</span>
                <input required value={familyAddress.city} onChange={(event) => setFamilyAddress((current) => ({ ...current, city: event.target.value }))} autoComplete="address-level2" className="w-full rounded-lg border border-gray-800 bg-black px-3 py-3 text-sm font-bold text-white outline-none focus:border-blue-400" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">State</span>
                <input required maxLength={2} value={familyAddress.state} onChange={(event) => setFamilyAddress((current) => ({ ...current, state: event.target.value.toUpperCase() }))} autoComplete="address-level1" placeholder="CA" className="w-full rounded-lg border border-gray-800 bg-black px-3 py-3 text-sm font-bold uppercase text-white outline-none focus:border-blue-400" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">ZIP</span>
                <input required value={familyAddress.zip} onChange={(event) => setFamilyAddress((current) => ({ ...current, zip: event.target.value }))} autoComplete="postal-code" inputMode="numeric" className="w-full rounded-lg border border-gray-800 bg-black px-3 py-3 text-sm font-bold text-white outline-none focus:border-blue-400" />
              </label>
              <button disabled={addressSaving} className="mt-auto inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-blue-500 px-5 py-3 text-xs font-black uppercase text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60">
                <Save size={15} /> {addressSaving ? 'Saving...' : 'Save Address'}
              </button>
            </form>
            {addressError && <p className="mt-3 text-sm font-bold text-red-300">{addressError}</p>}
            {addressMessage && <p className="mt-3 text-sm font-bold text-green-300">{addressMessage}</p>}
          </section>
        )}

        <div className={`grid gap-6 ${isParent ? 'lg:grid-cols-[1.1fr_0.9fr]' : 'lg:grid-cols-1'}`}>
          {isParent && (
          <section className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black uppercase italic">My Athletes</h2>
                <p className="mt-1 text-sm text-gray-500">Team placement, jersey details, and registration status.</p>
              </div>
              {players.length > 0 && (
              <Link to="/register-new-athlete" className="hidden rounded-lg border border-gray-700 px-3 py-2 text-[10px] font-black uppercase text-gray-300 hover:border-[#EF4444] hover:text-white sm:inline-flex">
                Add Player
              </Link>
              )}
            </div>

            {loading ? (
              <div className="rounded-xl border border-gray-800 bg-black p-6 text-center text-sm font-bold uppercase tracking-widest text-gray-500">Loading hub...</div>
            ) : players.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-800 bg-black p-8 text-center">
                <User className="mx-auto text-[#EF4444]" size={36} />
                <h3 className="mt-4 text-lg font-black uppercase italic">Start with player registration</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">Once your athlete is registered, their team, number, payment, and coach details will appear here.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {players.map((player) => (
                    <article key={player.id} className="rounded-xl border border-gray-800 bg-black p-4">
                      <div className="flex items-center gap-3">
                        {player.photo_url ? (
                          <img src={player.photo_url} alt={getPlayerName(player)} className="h-14 w-14 rounded-xl border border-gray-800 object-cover" />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-gray-800 bg-neutral-900 font-black text-[#EF4444]">
                            {getPlayerInitials(player)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="truncate font-black uppercase italic">{getPlayerName(player)}</h3>
                          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-gray-500">{player.team_assigned || 'Unassigned'}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg border border-gray-800 bg-neutral-950 p-3">
                          <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Position</div>
                          <div className="mt-1 font-bold text-gray-200">{player.position || 'TBD'}</div>
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-neutral-950 p-3">
                          <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Jersey</div>
                          <div className="mt-1 font-bold text-gray-200">{player.jersey_number || player.jersey_size || 'TBD'}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(player.status)}`}>
                          {player.status || 'Pending'}
                        </span>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(player.payment_status)}`}>
                          <CreditCard className="mr-1 inline" size={12} />
                          {player.payment_status || 'Payment pending'}
                        </span>
                      </div>

                      {!isPlayerPaid(player) && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => handlePayNow(player)}
                            disabled={payLoadingId === player.id}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#EF4444] px-4 py-2.5 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <CreditCard size={15} />
                            {payLoadingId === player.id ? 'Starting payment…' : 'Set up monthly payment'}
                          </button>
                          <p className="mt-1.5 text-center text-[11px] font-bold text-gray-500">
                            Finish setting up {player.first_name || 'your player'}&apos;s membership payment.
                          </p>
                          {payError && payLoadingId === null && (
                            <p className="mt-1 text-center text-[11px] font-bold text-[#FCA5A5]">{payError}</p>
                          )}
                        </div>
                      )}

                      <div className="mt-3 rounded-lg border border-gray-800 bg-neutral-950 p-3">
                        <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Uniform</div>
                        {player.uniform_purchased ? (
                          <>
                            <div className="mt-1 text-xs font-black uppercase text-green-300">Purchased</div>
                            <div className="mt-1 text-[11px] font-black uppercase tracking-widest text-[#D4AF37]">
                              Code: {player.uniform_confirmation_code || 'Pending'}
                            </div>
                          </>
                        ) : (
                          <div className="mt-1 text-xs font-bold text-gray-400">Available to order below</div>
                        )}
                      </div>

                      {getPlayerMessages(player).length > 0 && (
                        <div className="mt-4 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 p-3">
                          <div className="mb-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[#FCA5A5]">
                            <Megaphone size={13} />
                            Coach messages
                          </div>
                          <div className="space-y-2">
                            {getPlayerMessages(player).map((message) => (
                              <div key={message.id} className="border-t border-[#EF4444]/20 pt-2 first:border-t-0 first:pt-0">
                                <div className="text-xs font-black uppercase italic text-white">{message.title}</div>
                                <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-[#FCA5A5]">
                                  From {parseCoachMessage(message.body).coachName}
                                </div>
                                <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs leading-5 text-gray-300">{parseCoachMessage(message.body).body}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>

                <div className="mt-5 rounded-xl border border-[#D4AF37]/30 bg-black p-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">
                    <Shirt size={15} />
                    Uniform order
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                    <select
                      value={selectedUniformPlayer?.id || ''}
                      onChange={(event) => setSelectedUniformPlayerId(event.target.value)}
                      className="w-full rounded-lg border border-gray-800 bg-neutral-950 px-3 py-3 text-sm font-bold text-white outline-none focus:border-[#D4AF37]"
                    >
                      {players.map((player) => (
                        <option key={player.id} value={player.id}>
                          {getPlayerName(player)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleUniformOrder}
                      disabled={!selectedUniformPlayer || uniformOrderLoading === selectedUniformPlayer?.id}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-3 text-xs font-black uppercase text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uniformOrderLoading === selectedUniformPlayer?.id ? 'Starting...' : 'Order Uniform $100'}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  {selectedUniformPlayer && (
                    <div className="mt-3 grid gap-2 text-xs text-gray-400 sm:grid-cols-3">
                      <div className="rounded-lg border border-gray-800 bg-neutral-950 p-3">
                        <span className="block text-[9px] font-black uppercase tracking-widest text-gray-600">Player</span>
                        <span className="mt-1 block font-black text-white">{getPlayerName(selectedUniformPlayer)}</span>
                      </div>
                      <div className="rounded-lg border border-gray-800 bg-neutral-950 p-3">
                        <span className="block text-[9px] font-black uppercase tracking-widest text-gray-600">Size</span>
                        <span className="mt-1 block font-black text-white">{selectedUniformPlayer.jersey_size || 'TBD'}</span>
                      </div>
                      <div className="rounded-lg border border-gray-800 bg-neutral-950 p-3">
                        <span className="block text-[9px] font-black uppercase tracking-widest text-gray-600">Number</span>
                        <span className="mt-1 block font-black text-white">{selectedUniformPlayer.jersey_number || 'TBD'}</span>
                      </div>
                    </div>
                  )}
                  {uniformOrderError && (
                    <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs font-bold text-red-200">
                      {uniformOrderError}
                    </div>
                  )}
                  {selectedUniformPlayerOrders.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Recent uniform orders</div>
                      {selectedUniformPlayerOrders.slice(0, 2).map((order) => (
                        <div key={order.id} className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-neutral-950 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="font-black uppercase text-white">{order.player_name}</div>
                            <div className="mt-1 text-gray-500">Size {order.jersey_size || 'TBD'} - #{order.jersey_number || 'TBD'}</div>
                          </div>
                          <div className="text-left sm:text-right">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${statusClass(order.payment_status)}`}>
                              {order.payment_status || 'Pending'}
                            </span>
                            {order.confirmation_code && (
                              <div className="mt-1 font-black uppercase tracking-widest text-[#D4AF37]">{order.confirmation_code}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
          )}

          <section className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
            <div className="mb-5 flex items-center gap-2">
              <CalendarDays className="text-[#EF4444]" size={20} />
              <h2 className="text-xl font-black uppercase italic">Next Up</h2>
            </div>

            {schedule.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-800 bg-black p-8 text-center text-sm text-gray-500">No upcoming practices or matches yet.</div>
            ) : (
              <div className="space-y-3">
                {schedule.map((item) => (
                  <article key={`${item.type}-${item.id}`} className="rounded-xl border border-gray-800 bg-black p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest ${item.type === 'match' ? 'bg-[#EF4444] text-white' : 'bg-[#D4AF37]/15 text-[#D4AF37]'}`}>
                          {item.type}
                        </span>
                        <h3 className="mt-3 font-black uppercase italic">{item.title}</h3>
                        <div className="mt-2 space-y-1 text-sm text-gray-400">
                          <div className="flex items-center gap-2"><Clock size={14} /> {formatDate(item.date)}{item.time ? ` at ${item.time}` : ''}</div>
                          {item.location && <div className="flex items-center gap-2"><MapPin size={14} /> {item.location}</div>}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
            <div className="mb-5 flex items-center gap-2">
              <Megaphone className="text-[#EF4444]" size={20} />
              <h2 className="text-xl font-black uppercase italic">Club Announcements</h2>
            </div>

            {announcements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-800 bg-black p-8 text-center text-sm text-gray-500">No club announcements right now.</div>
            ) : (
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <article key={announcement.id} className={`rounded-xl border p-4 ${announcement.priority === 'important' ? 'border-[#EF4444]/70 bg-[#EF4444]/10' : 'border-gray-800 bg-black'}`}>
                    <div className="mb-2 flex flex-wrap gap-2">
                      {announcement.is_pinned && (
                        <span className="rounded-full bg-[#D4AF37]/15 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">Pinned</span>
                      )}
                      <span className="rounded-full border border-gray-700 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-gray-400">
                        {announcement.audience}
                      </span>
                    </div>
                    <h3 className="font-black uppercase italic text-white">{announcement.title}</h3>
                    <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-gray-400">{announcement.body}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
            <h2 className="mb-5 text-xl font-black uppercase italic">Quick Actions</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.title} to={action.to} className="group rounded-xl border border-gray-800 bg-black p-5 transition-all hover:border-[#EF4444] hover:bg-neutral-950">
                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#EF4444] text-white">
                      <Icon size={20} />
                    </div>
                    <h3 className="font-black uppercase italic">{action.title}</h3>
                    <p className="mt-2 min-h-[48px] text-sm leading-6 text-gray-500">{action.body}</p>
                    <div className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400 group-hover:text-white">
                      Open <ArrowRight size={14} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
