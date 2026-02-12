import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { uploadPhoto } from '../lib/upload';
import { useAuthStore } from '../store/auth';
import { Upload, CheckCircle, ChevronRight, ChevronLeft, AlertCircle, Camera } from 'lucide-react';

export default function PlayerRegistration() {
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
    
    setLoading(true);
    const publicUrl = await uploadPhoto(file, 'players');
    setLoading(false);

    if (publicUrl) {
      setFormData({ ...formData, photoUrl: publicUrl });
    } else {
      setError('Failed to upload photo. Please try again.');
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
      const payload = {
        parent_id: user.id,
        first_name: formData.firstName,
        last_name: formData.lastName,
        dob: formData.dob,
        gender: formData.gender,
        medical_conditions: formData.medicalConditions,
        birth_cert_path: formData.birthCertPath,
        photo_url: formData.photoUrl,
        waiver_signed_at: formData.waiverSignedAt,
        payment_status: 'paid' // Automatically mark as paid for online registration
      };

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
  const isStep2Valid = formData.birthCertPath;
  const isStep3Valid = formData.waiverSignedAt && signature.trim().length > 0;

  return (
    <div className="max-w-3xl mx-auto py-8">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <img src="/logo.png" alt="Bamika FC Logo" className="h-24 w-auto" />
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {['Player Info', 'Documents', 'Waiver', 'Payment'].map((label, idx) => (
            <div key={idx} className={`text-sm font-bold ${step > idx ? 'text-primary' : 'text-gray-400'}`}>
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

        {/* Step 1: Player Info */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Player Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full border rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full border rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleInputChange}
                  className="w-full border rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full border rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Medical Conditions (Optional)</label>
                <textarea
                  name="medicalConditions"
                  value={formData.medicalConditions}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full border rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Allergies, asthma, previous injuries, etc."
                />
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={nextStep}
                disabled={!isStep1Valid}
                className="bg-red-600 text-white px-6 py-2 rounded-md font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next Step <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Documents */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Document Upload</h2>
            
            {/* Photo Upload */}
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
                  <div className="flex flex-col items-center">
                    <img 
                      src={formData.photoUrl} 
                      alt="Player Preview" 
                      className="w-32 h-32 rounded-full object-cover mb-2 border-4 border-green-500"
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
                    <span className="font-bold">Upload Player Photo</span>
                    <span className="text-sm mt-1">Headshot for Roster Card</span>
                  </div>
                )}
              </label>
            </div>

            {/* Birth Cert Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:bg-gray-50 transition-colors">
              <input
                type="file"
                id="birthCert"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
              <label htmlFor="birthCert" className="cursor-pointer block">
                {formData.birthCertPath ? (
                  <div className="text-green-600 flex flex-col items-center">
                    <CheckCircle size={48} className="mb-2" />
                    <span className="font-bold">File Uploaded Successfully</span>
                    <span className="text-sm text-gray-500 mt-1">Click to replace</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-gray-500">
                    <Upload size={48} className="mb-2" />
                    <span className="font-bold text-lg">Upload Birth Certificate</span>
                    <span className="text-sm mt-1">PDF, JPG, or PNG (Max 5MB)</span>
                  </div>
                )}
              </label>
            </div>
            {loading && <p className="text-center text-sm text-gray-500">Uploading...</p>}
            
            <div className="flex justify-between mt-6">
              <button
                onClick={prevStep}
                className="text-gray-600 font-bold hover:text-black flex items-center gap-2"
              >
                <ChevronLeft size={20} /> Back
              </button>
              <button
                onClick={nextStep}
                disabled={!isStep2Valid || loading}
                className="bg-red-600 text-white px-6 py-2 rounded-md font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next Step <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Waiver */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Liability Waiver</h2>
            
            <div className="h-[300px] overflow-y-scroll border p-4 rounded bg-gray-50 text-sm text-gray-700 leading-relaxed">
              <h3 className="font-bold mb-4 text-center uppercase">RELEASE OF LIABILITY FOR MINOR PARTICIPANTS</h3>
              <p className="font-bold mb-4 text-center">READ BEFORE SIGNING</p>
              
              <p className="mb-4">
                IN CONSIDERATION OF my child, <span className="font-bold text-black">{formData.firstName} {formData.lastName}</span>, being allowed to participate in any way in BAMIKA FC related events and activities, the undersigned acknowledges, appreciates, and agrees that:
              </p>
              
              <p className="mb-4">
                The risks of injury and illness (ex: communicable diseases such as MRSA, influenza, and COVID-19) to my child from the activities involved in these programs are significant, including the potential for permanent disability and death, and while particular rules, equipment, and personal discipline may reduce these risks, the risks of serious injury and illness do exist; and,
              </p>

              <p className="mb-4">
                1. FOR MYSELF, SPOUSE, AND CHILD, I KNOWINGLY AND FREELY ASSUME ALL SUCH RISKS, both known and unknown, EVEN IF ARISING FROM THE NEGLIGENCE OF THE RELEASES or others, and assume full responsibility for my child’s participation; and,
              </p>

              <p className="mb-4">
                2. I willingly agree to comply with the program’s stated and customary terms and conditions for participation. If I observe any unusual significant concern in my child’s readiness for participation and/or in the program itself, I will remove my child from the participation and bring such attention of the nearest official immediately; and,
              </p>

              <p className="mb-4">
                3. I myself, my spouse, my child, and on behalf of my/our heirs, assigns, personal representatives and next of kin, HEREBY RELEASE AND HOLD HARMLESS BAMIKA FC; its directors, officers, officials, agents, coaches, volunteers, other participants, sponsoring agencies, sponsors, advertisers, and if applicable, owners and lessors of premises used to conduct the event (“Releasees”), WITH RESPECT TO ANY AND ALL INJURY, ILLNESS, DISABILITY, DEATH, or loss or damage to person or property incident to my child’s involvement or participation in these programs, WHETHER ARISING FROM THE NEGLIGENCE OF THE RELEASEES OR OTHERWISE, to the fullest extent permitted by law.
              </p>

              <p className="mb-4">
                4. I, for myself, my spouse, my child, and on behalf of my/our heirs, assigns, personal representatives and next of kin, HEREBY INDEMNIFY AND HOLD HARMLESS all the above Releasees from any and all liabilities incident to my involvement or participation in these programs, EVEN IF ARISING FROM THEIR NEGLIGENCE, to the fullest extent permitted by law.
              </p>

              <p className="mb-4">
                5. I, the parent/guardian, assert that I have explained to my child: the risks of the activity, his/her responsibilities for adhering to the rules and regulations, and that my child/ward understands this agreement.
              </p>

              <p className="font-bold uppercase mt-6">
                I, FOR MYSELF, MY SPOUSE, AND CHILD, HAVE READ THIS RELEASE OF LIABILITY AND ASSUMPTION OF RISK AGREEMENT, FULLY UNDERSTAND ITS TERMS, UNDERSTAND THAT WE HAVE GIVEN UP SUBSTANTIAL RIGHTS BY SIGNING IT, AND SIGN IT FREELY AND VOLUNTARILY WITHOUT ANY INDUCEMENT.
              </p>
            </div>
            
            <div className="space-y-4">
              <label className="flex items-start gap-3 p-4 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={!!formData.waiverSignedAt}
                  onChange={handleWaiverSign}
                  className="w-5 h-5 text-primary focus:ring-primary border-gray-300 rounded mt-0.5"
                />
                <span className="text-sm font-medium text-gray-900">
                  I, for myself, my spouse, and child, have read this release of liability and sign it freely and voluntarily
                </span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent/Guardian Signature</label>
                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Type your full name to sign"
                  className="w-full border rounded-md p-2 focus:ring-primary focus:border-primary font-serif italic text-lg"
                />
                <p className="text-xs text-gray-500 mt-1">By typing your name above, you are electronically signing this document.</p>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={prevStep}
                className="text-gray-600 font-bold hover:text-black flex items-center gap-2"
              >
                <ChevronLeft size={20} /> Back
              </button>
              <button
                onClick={nextStep}
                disabled={!isStep3Valid}
                className="bg-primary text-white px-6 py-2 rounded-md font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Continue to Payment <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Payment */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Review & Payment</h2>
            
            <div className="bg-gray-50 p-6 rounded-lg space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">Player Name</span>
                <span className="font-bold">{formData.firstName} {formData.lastName}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">Date of Birth</span>
                <span className="font-bold">{formData.dob}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">Player Photo</span>
                <span className={`font-bold flex items-center gap-1 ${formData.photoUrl ? 'text-green-600' : 'text-red-600'}`}>
                  {formData.photoUrl ? <><CheckCircle size={16} /> Uploaded</> : 'Missing'}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">Document</span>
                <span className="font-bold text-green-600 flex items-center gap-1"><CheckCircle size={16} /> Uploaded</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">Waiver</span>
                <span className="font-bold text-green-600 flex items-center gap-1"><CheckCircle size={16} /> Signed</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-lg font-bold">Monthly Membership</span>
                <span className="text-lg font-bold text-primary">$50.00/mo</span>
              </div>
            </div>

            <p className="text-sm text-gray-500 text-center">
              By clicking below, you will be redirected to Stripe to securely complete your payment setup.
            </p>

            <div className="flex justify-between mt-6">
              <button
                onClick={prevStep}
                className="text-gray-600 font-bold hover:text-black flex items-center gap-2"
              >
                <ChevronLeft size={20} /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-primary text-white px-8 py-3 rounded-md font-bold hover:bg-red-700 disabled:opacity-50 w-full md:w-auto shadow-lg transform hover:-translate-y-0.5 transition-all"
              >
                {loading ? 'Processing...' : 'Pay & Subscribe'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
