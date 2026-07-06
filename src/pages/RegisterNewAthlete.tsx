import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Camera,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  MapPin,
  Shield,
  Upload,
  User,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

const steps = ['Athlete', 'Photo', 'Waiver', 'Payment'];
const fieldClass = 'w-full rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/20';
const labelClass = 'mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500';
const jerseySizes = ['YXS', 'YS', 'YM', 'YL', 'YXL', 'S', 'M', 'L', 'XL', '2XL'];
const playerSchemaMessage = 'Player registration needs the latest Supabase database update. Run the newest players registration fields SQL migration, then try this step again.';

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

const normalizeFamilyAddress = (address: FamilyAddress): FamilyAddress => ({
  address: address.address.trim(),
  city: address.city.trim(),
  state: address.state.trim().toUpperCase(),
  zip: address.zip.trim(),
});

const isValidFamilyAddress = (address: FamilyAddress) => {
  const normalized = normalizeFamilyAddress(address);
  return Boolean(
    normalized.address
    && normalized.city
    && /^[A-Z]{2}$/.test(normalized.state)
    && /^\d{5}(?:-\d{4})?$/.test(normalized.zip)
  );
};

const isMissingPlayerSchemaError = (message: string) => (
  (message.includes('players') && (
    message.includes('first_name')
    || message.includes('last_name')
    || message.includes('full_name')
    || message.includes('parent_id')
    || message.includes('jersey_size')
    || message.includes('payment_status')
  ))
  || message.includes('row-level security policy')
  || message.includes('permission denied')
);

const normalizeBirthDate = (value: string) => {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  if (!match) {
    throw new Error('Please choose a valid date of birth before continuing.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (
    Number.isNaN(parsed.getTime())
    || parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new Error('Please choose a valid date of birth before continuing.');
  }

  return parsed.toISOString();
};

export default function RegisterNewAthlete() {
  const { user, userRole } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState('');
  const [familyAddress, setFamilyAddress] = useState<FamilyAddress>(EMPTY_FAMILY_ADDRESS);
  const [addressLoading, setAddressLoading] = useState(true);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    gender: 'Male',
    position: 'TBD',
    jerseySize: 'YM',
    medicalConditions: '',
    birthCertPath: '',
    photoUrl: '',
    waiverSignedAt: '',
  });

  useEffect(() => {
    let active = true;

    const loadFamilyAddress = async () => {
      if (!user) {
        if (active) setAddressLoading(false);
        return;
      }

      const { data, error: addressError } = await supabase
        .from('family_addresses')
        .select('address, city, state, zip')
        .eq('parent_id', user.id)
        .maybeSingle();

      if (!active) return;
      if (addressError) console.warn('Family address could not be loaded:', addressError);
      setFamilyAddress(data || EMPTY_FAMILY_ADDRESS);
      setAddressLoading(false);
    };

    loadFamilyAddress();
    return () => { active = false; };
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const fileName = `${Date.now()}_${file.name}`;

    setLoading(true);
    setError(null);

    try {
      const { error: uploadError } = await supabase.storage
        .from('player-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('player-photos')
        .getPublicUrl(fileName);

      if (data.publicUrl) {
        setFormData({ ...formData, photoUrl: data.publicUrl });
      } else {
        throw new Error('Failed to retrieve public URL');
      }
    } catch (err: unknown) {
      console.error('Photo upload error:', err);
      setError('Failed to upload photo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

    setLoading(true);
    setError(null);

    const { error: uploadError } = await supabase.storage
      .from('birth_certificates')
      .upload(fileName, file);

    if (uploadError) {
      setError('Failed to upload document. Please try again.');
      console.error(uploadError);
    } else {
      setFormData({ ...formData, birthCertPath: fileName });
    }
    setLoading(false);
  };

  const handleWaiverSign = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, waiverSignedAt: e.target.checked ? new Date().toISOString() : '' });
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const normalizedAddress = normalizeFamilyAddress(familyAddress);
      if (!isValidFamilyAddress(normalizedAddress)) {
        throw new Error('Enter a complete mailing address with a two-letter state and a valid ZIP code.');
      }

      const { error: addressError } = await supabase
        .from('family_addresses')
        .upsert({
          parent_id: user.id,
          ...normalizedAddress,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'parent_id' });

      if (addressError) throw new Error(addressError.message || 'Unable to save the family mailing address.');
      setFamilyAddress(normalizedAddress);

      const playerFullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
      const { data: existingPlayer, error: existingPlayerError } = await supabase
        .from('players')
        .select('id, status, payment_status')
        .eq('parent_id', user.id)
        .eq('full_name', playerFullName);

      if (existingPlayerError) {
        throw new Error(isMissingPlayerSchemaError(existingPlayerError.message) ? playerSchemaMessage : existingPlayerError.message);
      }

      const blockingExistingPlayer = (existingPlayer || []).find((player) => {
        const status = String(player.status || '').toLowerCase();
        const paymentStatus = String(player.payment_status || '').toLowerCase();
        return !['inactive', 'deleted', 'cancelled'].includes(status)
          && !['cancelled', 'deleted'].includes(paymentStatus);
      });

      if (blockingExistingPlayer) {
        setError('You have already registered a player with this name. Please check your dashboard.');
        setLoading(false);
        return;
      }

      const safeDob = normalizeBirthDate(formData.dob);

      const { data: newPlayer, error: playerError } = await supabase
        .from('players')
        .insert({
          parent_id: user.id,
          full_name: playerFullName,
          date_of_birth: safeDob,
          gender: formData.gender,
          position: formData.position,
          jersey_size: formData.jerseySize,
          medical_conditions: formData.medicalConditions,
          photo_url: formData.photoUrl,
          team_assigned: 'Unassigned',
          jersey_number: '-',
          status: 'pending_payment',
          payment_status: 'pending',
          waiver_signed: !!formData.waiverSignedAt,
        })
        .select('id')
        .single();

      if (playerError) {
        throw new Error(isMissingPlayerSchemaError(playerError.message) ? playerSchemaMessage : playerError.message);
      }
      if (!newPlayer?.id) throw new Error('Unable to create player profile.');

      const payload = {
        parent_id: user.id,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        dob: safeDob,
        gender: formData.gender,
        position: formData.position,
        jersey_size: formData.jerseySize,
        medical_conditions: formData.medicalConditions,
        birth_cert_path: formData.birthCertPath || 'not_provided',
        photo_url: formData.photoUrl,
        waiver_signed_at: formData.waiverSignedAt,
        include_uniform: false,
        status: 'pending_payment',
        payment_status: 'pending',
      };

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Please log in again before starting payment.');

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          registrationData: payload,
          playerId: newPlayer.id,
          includeUniform: false,
          cancelUrl: `${window.location.origin}${userRole === 'coach' ? '/coach' : '/dashboard'}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to create checkout session');

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to complete registration.');
      setLoading(false);
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 4));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const isStep1Valid = Boolean(formData.firstName && formData.lastName && formData.dob && isValidFamilyAddress(familyAddress) && !addressLoading);
  const isStep2Valid = formData.photoUrl;
  const isStep3Valid = formData.waiverSignedAt && signature.trim().length > 0;

  return (
    <div className="w-full py-6 text-white sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-800 bg-neutral-950">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-6 sm:p-8">
              <button onClick={() => navigate('/dashboard')} className="mb-6 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white">
                Back to dashboard
              </button>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#FCA5A5]">
                Player registration
              </div>
              <h1 className="mt-4 text-3xl font-black uppercase italic leading-tight text-white sm:text-5xl">
                New Athlete <span className="text-[#D4AF37]">Registration</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-400 sm:text-base">
                Confirm one family mailing address, add your player, sign the waiver, and complete the $25 monthly membership checkout.
              </p>
            </div>

            <div className="border-t border-gray-800 bg-black p-6 sm:p-8 lg:border-l lg:border-t-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Checkout summary</div>
              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-gray-800 bg-neutral-950 p-4">
                  <div className="text-sm font-bold text-gray-300">Monthly club fee</div>
                  <div className="mt-1 text-3xl font-black text-[#EF4444]">$25/mo</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-gray-800 bg-neutral-900 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {steps.map((label, idx) => {
              const current = idx + 1;
              const active = step >= current;
              return (
                <div key={label} className={`rounded-xl border px-2 py-3 sm:px-3 ${active ? 'border-[#EF4444]/60 bg-[#EF4444]/10' : 'border-gray-800 bg-black'}`}>
                  <div className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${active ? 'bg-[#EF4444] text-white' : 'bg-neutral-800 text-gray-500'}`}>
                    {current}
                  </div>
                  <div className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-white' : 'text-gray-600'}`}>{label}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5 shadow-2xl shadow-black/30 sm:p-8">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
              <AlertCircle size={20} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EF4444]">
                  <User size={21} />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase italic">Athlete Information</h2>
                  <p className="text-sm text-gray-500">Basic player details and jersey sizing for team records.</p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className={labelClass}>First Name *</label>
                  <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} className={fieldClass} required />
                </div>
                <div>
                  <label className={labelClass}>Last Name *</label>
                  <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} className={fieldClass} required />
                </div>
                <div>
                  <label className={labelClass}>Date of Birth *</label>
                  <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} className={fieldClass} required />
                </div>
                <div>
                  <label className={labelClass}>Gender *</label>
                  <select name="gender" value={formData.gender} onChange={handleInputChange} className={fieldClass}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Preferred Position</label>
                  <select name="position" value={formData.position} onChange={handleInputChange} className={fieldClass}>
                    <option value="TBD">TBD</option>
                    <option value="Forward">Forward</option>
                    <option value="Midfielder">Midfielder</option>
                    <option value="Defender">Defender</option>
                    <option value="Goalkeeper">Goalkeeper</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Jersey Size</label>
                  <select name="jerseySize" value={formData.jerseySize} onChange={handleInputChange} className={fieldClass}>
                    {jerseySizes.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Medical Conditions</label>
                  <textarea name="medicalConditions" value={formData.medicalConditions} onChange={handleInputChange} rows={4} className={fieldClass} placeholder="Allergies, asthma, previous injuries, medications, or anything coaches should know." />
                </div>
              </div>

              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h3 className="font-black uppercase italic text-white">Family Mailing Address</h3>
                    <p className="mt-1 text-sm leading-6 text-gray-400">Enter this once. It is saved to your family profile and automatically linked to every player for GotSport reports.</p>
                  </div>
                </div>
                {addressLoading ? (
                  <div className="text-sm font-bold text-gray-500">Loading saved address...</div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="md:col-span-2">
                      <span className={labelClass}>Street Address *</span>
                      <input required autoComplete="street-address" value={familyAddress.address} onChange={(event) => setFamilyAddress((current) => ({ ...current, address: event.target.value }))} className={fieldClass} />
                    </label>
                    <label>
                      <span className={labelClass}>City *</span>
                      <input required autoComplete="address-level2" value={familyAddress.city} onChange={(event) => setFamilyAddress((current) => ({ ...current, city: event.target.value }))} className={fieldClass} />
                    </label>
                    <div className="grid grid-cols-[0.7fr_1.3fr] gap-3">
                      <label>
                        <span className={labelClass}>State *</span>
                        <input required maxLength={2} autoComplete="address-level1" placeholder="CA" value={familyAddress.state} onChange={(event) => setFamilyAddress((current) => ({ ...current, state: event.target.value.toUpperCase() }))} className={`${fieldClass} uppercase`} />
                      </label>
                      <label>
                        <span className={labelClass}>ZIP *</span>
                        <input required autoComplete="postal-code" inputMode="numeric" placeholder="93722" value={familyAddress.zip} onChange={(event) => setFamilyAddress((current) => ({ ...current, zip: event.target.value }))} className={fieldClass} />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button onClick={nextStep} disabled={!isStep1Valid} className="inline-flex items-center gap-2 rounded-xl bg-[#EF4444] px-5 py-3 text-sm font-black uppercase text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                  Photo Upload <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EF4444]">
                  <Camera size={21} />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase italic">Photo & Documents</h2>
                  <p className="text-sm text-gray-500">A clear roster photo helps coaches and admins identify players.</p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-2xl border border-gray-800 bg-black p-5">
                  <input type="file" id="playerPhoto" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  <label htmlFor="playerPhoto" className="flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 bg-neutral-950 p-6 text-center transition hover:border-[#EF4444]">
                    {formData.photoUrl ? (
                      <>
                        <img src={formData.photoUrl} alt="Player preview" className="h-36 w-36 rounded-2xl border-2 border-green-500/60 object-cover shadow-xl" />
                        <span className="mt-4 inline-flex items-center gap-2 text-sm font-black uppercase text-green-300"><CheckCircle size={16} /> Photo uploaded</span>
                        <span className="mt-1 text-xs text-gray-500">Click to replace</span>
                      </>
                    ) : (
                      <>
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-900 text-gray-400">
                          <Camera size={32} />
                        </div>
                        <span className="font-black uppercase tracking-widest text-white">Upload player photo *</span>
                        <span className="mt-2 text-sm text-gray-500">JPG or PNG works best</span>
                      </>
                    )}
                  </label>
                </div>

                <div className="rounded-2xl border border-gray-800 bg-black p-5">
                  <div className="flex items-center gap-3">
                    <FileText className="text-[#D4AF37]" size={24} />
                    <div>
                      <h3 className="font-black uppercase italic">Birth Certificate</h3>
                      <p className="text-sm text-gray-500">Optional, but useful for age verification.</p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-col gap-3 rounded-xl border border-gray-800 bg-neutral-950 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <input type="file" id="birthCert" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
                    <label htmlFor="birthCert" className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-700 px-4 py-3 text-sm font-black uppercase text-gray-300 transition hover:border-[#EF4444] hover:text-white">
                      <Upload size={18} /> Upload document
                    </label>
                    {formData.birthCertPath ? (
                      <span className="inline-flex items-center gap-2 text-sm font-black uppercase text-green-300"><CheckCircle size={16} /> Uploaded</span>
                    ) : (
                      <span className="text-sm text-gray-500">No document selected</span>
                    )}
                  </div>
                  <div className="mt-5 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm leading-6 text-[#FDE68A]">
                    The player photo is required because it appears on roster cards and coach dashboards.
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button onClick={prevStep} className="inline-flex items-center gap-2 text-sm font-black uppercase text-gray-400 hover:text-white">
                  <ChevronLeft size={18} /> Back
                </button>
                <button onClick={nextStep} disabled={!isStep2Valid || loading} className="inline-flex items-center gap-2 rounded-xl bg-[#EF4444] px-5 py-3 text-sm font-black uppercase text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                  Waiver <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EF4444]">
                  <Shield size={21} />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase italic">Liability Waiver</h2>
                  <p className="text-sm text-gray-500">Review and sign before checkout.</p>
                </div>
              </div>

              <div className="max-h-[320px] overflow-y-auto rounded-2xl border border-gray-800 bg-black p-5 text-sm leading-7 text-gray-300">
                <h3 className="mb-4 text-center font-black uppercase tracking-widest text-white">Release of Liability for Minor Participants</h3>
                <p className="mb-4">
                  In consideration of my child, <span className="font-black text-white">{formData.firstName} {formData.lastName}</span>, being allowed to participate in Bamika FC activities, I acknowledge and accept the risks connected with soccer training, games, travel, and club events.
                </p>
                <p className="mb-4">
                  I release and hold harmless Bamika FC, its coaches, volunteers, staff, facilities, and partners from claims related to injury, illness, or loss connected to participation, except where prohibited by law.
                </p>
                <p className="font-black uppercase text-white">
                  I have read this agreement, understand its terms, and sign it freely as the parent or legal guardian.
                </p>
              </div>

              <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={!!formData.waiverSignedAt} onChange={handleWaiverSign} className="mt-1 h-5 w-5 rounded border-gray-700 bg-black text-[#EF4444] focus:ring-[#EF4444]" />
                  <span className="text-sm font-bold text-white">I agree to the waiver terms above.</span>
                </label>

                <div className="mt-5">
                  <label className={labelClass}>Parent/Guardian Signature</label>
                  <input type="text" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Type full legal name" className={`${fieldClass} text-lg italic`} />
                </div>
              </div>

              <div className="flex justify-between">
                <button onClick={prevStep} className="inline-flex items-center gap-2 text-sm font-black uppercase text-gray-400 hover:text-white">
                  <ChevronLeft size={18} /> Back
                </button>
                <button onClick={nextStep} disabled={!isStep3Valid} className="inline-flex items-center gap-2 rounded-xl bg-[#EF4444] px-5 py-3 text-sm font-black uppercase text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                  Review & Pay <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EF4444]">
                  <CreditCard size={21} />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase italic">Review & Pay</h2>
                  <p className="text-sm text-gray-500">Confirm registration details before secure checkout.</p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
                <div className="rounded-2xl border border-gray-800 bg-black p-5">
                  <h3 className="mb-4 font-black uppercase italic">Player Summary</h3>
                  <div className="space-y-3">
                    {[
                      ['Player Name', `${formData.firstName} ${formData.lastName}`],
                      ['Position', formData.position],
                      ['Jersey Size', formData.jerseySize],
                      ['Family Address', `${familyAddress.city}, ${familyAddress.state} ${familyAddress.zip}`],
                      ['Waiver', `Signed by ${signature}`],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-4 border-b border-gray-800 pb-3 text-sm">
                        <span className="font-bold text-gray-500">{label}</span>
                        <span className="text-right font-black text-white">{value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-4 border-b border-gray-800 pb-3 text-sm">
                      <span className="font-bold text-gray-500">Photo</span>
                      <span className="inline-flex items-center gap-2 font-black text-green-300"><CheckCircle size={16} /> Uploaded</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-800 bg-black p-5">
                  <h3 className="mb-4 font-black uppercase italic">Today at Checkout</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                      <span className="text-sm font-bold text-gray-500">Monthly Fee</span>
                      <span className="font-black">$25/mo</span>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-lg font-black uppercase italic">Due Now</span>
                      <span className="text-2xl font-black text-[#EF4444]">$25/mo</span>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-neutral-950 p-3 text-xs leading-5 text-gray-500">
                      Stripe checkout contains only the $25 monthly membership. Uniforms can be ordered separately later from the parent dashboard.
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-center text-sm italic text-gray-500">
                You will be redirected to secure Stripe checkout. The player profile is already saved as pending payment.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button onClick={prevStep} className="inline-flex items-center gap-2 text-sm font-black uppercase text-gray-400 hover:text-white">
                  <ChevronLeft size={18} /> Back
                </button>
                <button onClick={handleSubmit} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#EF4444] px-6 py-4 text-sm font-black uppercase text-white shadow-xl transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {loading ? 'Processing...' : 'Proceed to Payment'} <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
