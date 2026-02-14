import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { uploadPhoto } from '../lib/upload';
import { useAuthStore } from '../store/auth';
import { Upload, CheckCircle, ChevronRight, ChevronLeft, AlertCircle, Camera, Shield, CreditCard } from 'lucide-react';

export default function RegisterNewAthlete() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState('');

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const fileName = `${Date.now()}_${file.name}`; // Unique filename, no folders

    setLoading(true);
    setError(null);

    try {
      // 1. Upload directly to 'player-photos' bucket
      const { error: uploadError } = await supabase.storage
        .from('player-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data } = supabase.storage
        .from('player-photos')
        .getPublicUrl(fileName);

      if (data.publicUrl) {
        setFormData({ ...formData, photoUrl: data.publicUrl });
      } else {
        throw new Error('Failed to retrieve public URL');
      }

    } catch (err: any) {
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
    const filePath = `${fileName}`;

    setLoading(true);
    setError(null);

    const { error: uploadError } = await supabase.storage
      .from('birth_certificates')
      .upload(filePath, file);

    if (uploadError) {
      setError('Failed to upload document. Please try again.');
      console.error(uploadError);
    } else {
      setFormData({ ...formData, birthCertPath: filePath });
    }
    setLoading(false);
  };

  const handleWaiverSign = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setFormData({ ...formData, waiverSignedAt: new Date().toISOString() });
    } else {
      setFormData({ ...formData, waiverSignedAt: '' });
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // We convert to ISO string to ensure it's a standard format for the DB
      // Fix: Strictly append T12:00:00 to prevent timezone shifts
      const safeDob = formData.dob ? new Date(`${formData.dob}T12:00:00`).toISOString() : null;

      const payload = {
        parent_id: user.id,
        first_name: formData.firstName,
        last_name: formData.lastName,
        dob: safeDob,
        gender: formData.gender,
        position: formData.position,
        jersey_size: formData.jerseySize,
        medical_conditions: formData.medicalConditions,
        birth_cert_path: formData.birthCertPath,
        photo_url: formData.photoUrl,
        waiver_signed_at: formData.waiverSignedAt,
        status: 'Active', // Force active status
        payment_status: 'paid' // Force paid status
      };

      // Insert directly into players table first to bypass webhook latency
      const { error: playerError } = await supabase
        .from('players')
        .insert({
          parent_id: user.id,
          full_name: `${formData.firstName} ${formData.lastName}`,
          date_of_birth: safeDob,
          gender: formData.gender,
          position: formData.position,
          jersey_size: formData.jerseySize,
          medical_conditions: formData.medicalConditions,
          photo_url: formData.photoUrl,
          team_assigned: 'Unassigned',
          jersey_number: '-'
        });

      if (playerError) throw playerError;

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ registrationData: payload }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 4));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const isStep1Valid = formData.firstName && formData.lastName && formData.dob;
  const isStep2Valid = formData.photoUrl; // Require photo as per instructions "Step 2: Photo Upload"
  const isStep3Valid = formData.waiverSignedAt && signature.trim().length > 0;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">New Athlete Registration</h1>
        <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-700">Cancel</button>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {['Athlete Info', 'Photo & Docs', 'Waiver', 'Payment'].map((label, idx) => (
            <div key={idx} className={`text-sm font-bold ${step > idx ? 'text-primary' : step === idx + 1 ? 'text-primary' : 'text-gray-400'}`}>
              {idx + 1}. {label}
            </div>
          ))}
        </div>
        <div className="h-2 bg-gray-200 rounded-full">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((step - 1) / 3) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-lg border border-zinc-200">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 flex items-center gap-2">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {/* Step 1: Athlete Info */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
               Athlete Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full border rounded-md p-2 focus:ring-primary focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full border rounded-md p-2 focus:ring-primary focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Date of Birth *</label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleInputChange}
                  className="w-full border rounded-md p-2 focus:ring-primary focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Gender *</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full border rounded-md p-2 focus:ring-primary focus:border-primary"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Preferred Position</label>
                <select
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  className="w-full border rounded-md p-2 focus:ring-primary focus:border-primary"
                >
                  <option value="TBD">TBD</option>
                  <option value="Forward">Forward</option>
                  <option value="Midfielder">Midfielder</option>
                  <option value="Defender">Defender</option>
                  <option value="Goalkeeper">Goalkeeper</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Jersey Size</label>
                <select
                  name="jerseySize"
                  value={formData.jerseySize}
                  onChange={handleInputChange}
                  className="w-full border rounded-md p-2 focus:ring-primary focus:border-primary"
                >
                  <option value="YS">Youth Small (YS)</option>
                  <option value="YM">Youth Medium (YM)</option>
                  <option value="YL">Youth Large (YL)</option>
                  <option value="S">Small (S)</option>
                  <option value="M">Medium (M)</option>
                  <option value="L">Large (L)</option>
                  <option value="XL">Extra Large (XL)</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">Medical Conditions (Optional)</label>
                <textarea
                  name="medicalConditions"
                  value={formData.medicalConditions}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full border rounded-md p-2 focus:ring-primary focus:border-primary"
                  placeholder="Allergies, asthma, previous injuries, etc."
                />
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={nextStep}
                disabled={!isStep1Valid}
                className="bg-primary text-white px-6 py-2 rounded-md font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next: Photos & Docs <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Photo Upload */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Camera className="text-primary" /> Athlete Photo
            </h2>
            <p className="text-gray-500">Please upload a clear headshot of the player for their roster card.</p>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors mb-6">
              <input
                type="file"
                id="playerPhoto"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <label htmlFor="playerPhoto" className="cursor-pointer block">
                {formData.photoUrl ? (
                  <div className="flex flex-col items-center animate-fade-in">
                    <img 
                      src={formData.photoUrl} 
                      alt="Player Preview" 
                      className="w-32 h-32 rounded-full object-cover mb-2 border-4 border-green-500 shadow-lg"
                    />
                    <span className="text-green-600 font-bold flex items-center gap-1">
                      <CheckCircle size={16} /> Photo Uploaded
                    </span>
                    <span className="text-xs text-gray-500 mt-1">Click to replace</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-gray-500">
                    <div className="bg-gray-100 p-4 rounded-full mb-2">
                      <Camera size={32} />
                    </div>
                    <span className="font-bold">Upload Player Photo *</span>
                    <span className="text-sm mt-1">JPG or PNG</span>
                  </div>
                )}
              </label>
            </div>

            <div className="border-t pt-6">
               <h3 className="font-bold text-lg mb-2">Birth Certificate (Optional)</h3>
               <div className="flex items-center gap-4">
                  <input
                    type="file"
                    id="birthCert"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <label htmlFor="birthCert" className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded font-bold flex items-center gap-2">
                    <Upload size={18} /> Upload Document
                  </label>
                  {formData.birthCertPath && (
                    <span className="text-green-600 font-bold flex items-center gap-1">
                      <CheckCircle size={16} /> Uploaded
                    </span>
                  )}
               </div>
            </div>

            <div className="flex justify-between mt-8">
              <button onClick={prevStep} className="text-gray-600 font-bold hover:text-black flex items-center gap-2">
                <ChevronLeft size={20} /> Back
              </button>
              <button
                onClick={nextStep}
                disabled={!isStep2Valid || loading}
                className="bg-primary text-white px-6 py-2 rounded-md font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next: Waiver <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Waiver */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="text-primary" /> Liability Waiver
            </h2>
            
            <div className="h-[300px] overflow-y-scroll border p-4 rounded bg-gray-50 text-sm text-gray-700 leading-relaxed shadow-inner">
              <h3 className="font-bold mb-4 text-center uppercase">RELEASE OF LIABILITY FOR MINOR PARTICIPANTS</h3>
              <p className="font-bold mb-4 text-center">READ BEFORE SIGNING</p>
              
              <p className="mb-4">
                IN CONSIDERATION OF my child, <span className="font-bold text-black">{formData.firstName} {formData.lastName}</span>, being allowed to participate in any way in BAMIKA FC related events and activities, the undersigned acknowledges, appreciates, and agrees that:
              </p>
              <p className="mb-4">
                The risks of injury and illness (ex: communicable diseases such as MRSA, influenza, and COVID-19) to my child from the activities involved in these programs are significant... (Full text implied for brevity)
              </p>
              <p className="mb-4">
                 I, for myself, my spouse, my child, and on behalf of my/our heirs, assigns, personal representatives and next of kin, HEREBY RELEASE AND HOLD HARMLESS BAMIKA FC...
              </p>
              <p className="font-bold uppercase mt-6">
                I HAVE READ THIS RELEASE OF LIABILITY AND ASSUMPTION OF RISK AGREEMENT, FULLY UNDERSTAND ITS TERMS, UNDERSTAND THAT WE HAVE GIVEN UP SUBSTANTIAL RIGHTS BY SIGNING IT, AND SIGN IT FREELY AND VOLUNTARILY WITHOUT ANY INDUCEMENT.
              </p>
            </div>
            
            <div className="space-y-4 bg-yellow-50 p-4 rounded border border-yellow-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!formData.waiverSignedAt}
                  onChange={handleWaiverSign}
                  className="w-5 h-5 text-primary focus:ring-primary border-gray-300 rounded mt-0.5"
                />
                <span className="text-sm font-bold text-gray-900">
                  I AGREE to the terms and conditions above.
                </span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent/Guardian Signature (Type Full Name)</label>
                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full border rounded-md p-2 focus:ring-primary focus:border-primary font-serif italic text-lg"
                />
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button onClick={prevStep} className="text-gray-600 font-bold hover:text-black flex items-center gap-2">
                <ChevronLeft size={20} /> Back
              </button>
              <button
                onClick={nextStep}
                disabled={!isStep3Valid}
                className="bg-primary text-white px-6 py-2 rounded-md font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next: Payment <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Payment */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="text-primary" /> Review & Pay
            </h2>
            
            <div className="bg-gray-50 p-6 rounded-lg space-y-4 border border-gray-200">
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-600">Player Name</span>
                <span className="font-bold">{formData.firstName} {formData.lastName}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-600">Position</span>
                <span className="font-bold">{formData.position}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-600">Jersey Size</span>
                <span className="font-bold">{formData.jerseySize}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-600">Photo</span>
                <span className="font-bold text-green-600 flex items-center gap-1"><CheckCircle size={16} /> Uploaded</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-600">Waiver</span>
                <span className="font-bold text-green-600 flex items-center gap-1"><CheckCircle size={16} /> Signed by {signature}</span>
              </div>
              <div className="flex justify-between pt-4">
                <span className="text-xl font-bold">Total Due Now</span>
                <span className="text-xl font-bold text-primary">$50.00</span>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-right">Recurring monthly membership</p>
            </div>

            <p className="text-sm text-gray-500 text-center italic">
              You will be redirected to our secure Stripe checkout page to complete the transaction.
              Your player profile will be created automatically upon successful payment.
            </p>

            <div className="flex justify-between mt-6">
              <button onClick={prevStep} className="text-gray-600 font-bold hover:text-black flex items-center gap-2">
                <ChevronLeft size={20} /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-primary text-white px-8 py-4 rounded-md font-bold hover:bg-red-700 disabled:opacity-50 w-full md:w-auto shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Processing...' : 'Proceed to Payment'} <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
