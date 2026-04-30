import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { X, Save, Plus, UserMinus, Phone, Mail, MapPin, Users } from 'lucide-react';

const logAdminAction = async (admin_id: string, parent_id: string, action: string, details: object) => {
  await supabase.from('admin_logs').insert([
    {
      admin_id: admin_id,
      target_user_id: parent_id,
      action_type: action,
      metadata: details,
      created_at: new Date()
    }
  ]);
};

interface ParentProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface ChildRecord {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  position?: string;
  status?: string;
  parent_id?: string | null;
}

interface PaymentRecord {
  id: string;
  created_at: string;
  amount?: number;
  payment_status?: string;
  waiver_signed_at?: string | null;
}

interface ParentProfileResponse extends ParentProfile {
  players?: ChildRecord[];
  registrations?: PaymentRecord[];
}

export default function ParentDetailView() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const [parent, setParent] = useState<ParentProfile | null>(null);
  const [children, setChildren] = useState<ChildRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditParentOpen, setIsEditParentOpen] = useState(false);
  const [isAddChildOpen, setIsAddChildOpen] = useState(false);
  const [newChild, setNewChild] = useState({ first_name: '', last_name: '', date_of_birth: '' });

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('profiles')
      .select(`*, players (*), registrations (*)`)
      .eq('id', id)
      .single();

    if (error) throw error;

    const profileData = data as ParentProfileResponse;
    setParent(profileData);
    setChildren(profileData.players || []);
    setPayments(profileData.registrations || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parent || !user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ 
        first_name: parent.first_name, 
        last_name: parent.last_name, 
        email: parent.email, 
        phone: parent.phone, 
        address: parent.address 
      })
      .eq('id', parent.id);

    if (!error) {
      logAdminAction(user.id, parent.id, 'UPDATE_CONTACT_INFO', { updated_fields: {
        first_name: parent.first_name,
        last_name: parent.last_name,
        email: parent.email,
        phone: parent.phone,
        address: parent.address
      } });
      setIsEditParentOpen(false);
      fetchData();
    }
  };

  const handleUpdateChild = async (childId: string, updates: object) => {
    if (!user || !parent) return;

    const { error } = await supabase
      .from('players')
      .update(updates)
      .eq('id', childId);

    if (!error) {
      logAdminAction(user.id, parent.id, 'UPDATE_CHILD_RECORD', { childId, updates });
      fetchData();
    }
  };

  const handleAddNewChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !parent) return;

    const { error } = await supabase
      .from('players')
      .insert([
        {
          first_name: newChild.first_name,
          last_name: newChild.last_name,
          date_of_birth: newChild.date_of_birth,
          parent_id: parent.id
        }
      ]);

    if (!error) {
      logAdminAction(user.id, parent.id, 'ADD_CHILD_RECORD', { newChild });
      setIsAddChildOpen(false);
      setNewChild({ first_name: '', last_name: '', date_of_birth: '' });
      fetchData();
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!parent) return <div>Parent not found.</div>;

  const registrationStatus = children.length > 0 ? 'Complete' : 'Incomplete';
  const financialStatus = payments.every(p => p.payment_status === 'paid') ? 'Good Standing' : 'Overdue';
  const documentStatus = payments.every(p => p.waiver_signed_at) ? 'Waivers Signed' : 'Missing';

  return (
    <div className="bg-black min-h-screen p-4 text-white sm:p-6 lg:p-8">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{parent.first_name} {parent.last_name}</h1>

      {/* Status HUD */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-neutral-900 border border-gray-800 p-4 rounded-lg text-center">
          <div className="text-sm font-bold text-gray-500">Registration</div>
          <div className={`text-lg font-bold ${registrationStatus === 'Complete' ? 'text-green-500' : 'text-red-500'}`}>{registrationStatus}</div>
          {/* Add Child Modal */}
      {isAddChildOpen && (
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleAddNewChild} className="bg-neutral-900 border border-gray-800 w-full max-w-lg rounded-3xl p-5 shadow-2xl sm:p-10">
            <div className="mb-8 flex items-start justify-between gap-4">
              <h3 className="text-2xl font-black uppercase italic text-white">Add New <span className="text-[#EF4444]">Athlete</span></h3>
              <X className="text-gray-500 cursor-pointer" onClick={() => setIsAddChildOpen(false)} />
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="relative">
                  <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">First Name</label>
                  <input
                    className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] transition-all pl-12"
                    value={newChild.first_name}
                    onChange={e => setNewChild({...newChild, first_name: e.target.value})}
                  />
                  <Users className="absolute left-4 top-[42px] text-gray-600" size={18} />
                </div>
                <div className="relative">
                  <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Last Name</label>
                  <input
                    className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] transition-all pl-12"
                    value={newChild.last_name}
                    onChange={e => setNewChild({...newChild, last_name: e.target.value})}
                  />
                  <Users className="absolute left-4 top-[42px] text-gray-600" size={18} />
                </div>
              </div>
              <div className="relative">
                <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Date of Birth</label>
                <input
                  type="date"
                  className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] transition-all pl-12"
                  value={newChild.date_of_birth}
                  onChange={e => setNewChild({...newChild, date_of_birth: e.target.value})}
                />
                <Users className="absolute left-4 top-[42px] text-gray-600" size={18} />
              </div>
            </div>
            <button type="submit" className="w-full mt-10 bg-[#EF4444] text-white py-5 rounded-2xl font-black uppercase italic tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-3">
              <Save size={20} /> Add Athlete
            </button>
          </form>
        </div>
      )}
    </div>
        <div className="bg-neutral-900 border border-gray-800 p-4 rounded-lg text-center">
          <div className="text-sm font-bold text-gray-500">Financials</div>
          <div className={`text-lg font-bold ${financialStatus === 'Good Standing' ? 'text-green-500' : 'text-red-500'}`}>{financialStatus}</div>
        </div>
        <div className="bg-neutral-900 border border-gray-800 p-4 rounded-lg text-center">
          <div className="text-sm font-bold text-gray-500">Documents</div>
          <div className={`text-lg font-bold ${documentStatus === 'Waivers Signed' ? 'text-green-500' : 'text-red-500'}`}>{documentStatus}</div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-neutral-900 border border-gray-800 p-6 rounded-lg mb-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold">Contact Information</h2>
          <button onClick={() => setIsEditParentOpen(true)} className="bg-blue-500 text-white px-4 py-2 rounded-md font-bold">Edit</button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><span className="font-bold">Email:</span> {parent.email}</div>
          <div><span className="font-bold">Phone:</span> {parent.phone}</div>
          <div><span className="font-bold">Address:</span> {parent.address}</div>
        </div>
      </div>

      {/* Payment Information */}
      <div className="bg-neutral-900 border border-gray-800 p-6 rounded-lg mb-6">
        <h2 className="text-xl font-bold mb-4">Payment Information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><span className="font-bold">Subscription Status:</span> {financialStatus}</div>
        </div>
        <div className="mt-6">
          <h3 className="font-bold text-lg mb-2">Recent Transactions</h3>
          {payments.length > 0 ? (
            <ul>
              {payments.map((payment) => (
                <li key={payment.id} className="flex justify-between items-center mb-2">
                  <span>{new Date(payment.created_at).toLocaleDateString()}</span>
                  <span>${payment.amount}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${payment.payment_status === 'paid' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                    {payment.payment_status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div>No recent transactions.</div>
          )}
        </div>
      </div>

      {/* Child Management */}
       <section className="mt-12 bg-neutral-900 rounded-3xl border border-gray-800 overflow-hidden">
         <div className="flex flex-col gap-4 border-b border-gray-800 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
           <h2 className="text-2xl font-black uppercase italic text-white">Athlete <span className="text-[#EF4444]">Roster</span></h2>
           <button onClick={() => setIsAddChildOpen(true)} className="flex items-center gap-2 text-[#EF4444] font-black uppercase italic text-xs border border-[#EF4444]/30 px-4 py-2 rounded-xl hover:bg-[#EF4444] hover:text-white transition-all">
             <Plus size={16} /> Add New Athlete
           </button>
         </div>

         <div className="grid gap-4 p-5 sm:p-8">
           {children.map((kid) => (
             <div key={kid.id} className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-black/40 p-5 transition-all hover:border-[#EF4444] sm:flex-row sm:items-center sm:justify-between sm:p-6">
               <div className="flex items-center gap-4 sm:gap-6">
                 <div className="h-12 w-12 rounded-full bg-neutral-800 flex items-center justify-center font-black text-[#EF4444]">
                   {kid.first_name.charAt(0)}
                 </div>
                 <div>
                   <h4 className="text-white font-bold text-lg">{kid.first_name} {kid.last_name}</h4>
                   <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:gap-4">
                     <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">DOB: {kid.date_of_birth}</span>
                     <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Pos: {kid.position || 'TBD'}</span>
                   </div>
                 </div>
               </div>

               <div className="flex items-center justify-between gap-4 sm:justify-end">
                 <select
                   className="bg-neutral-800 text-white text-[10px] p-2 rounded-lg font-black uppercase border-none outline-none"
                   value={kid.status}
                   onChange={(e) => handleUpdateChild(kid.id, { status: e.target.value })}
                 >
                   <option value="active">Active</option>
                   <option value="waitlist">Waitlist</option>
                   <option value="inactive">Inactive</option>
                 </select>
                 <button
                   onClick={() => { if(confirm('Remove athlete from this account?')) handleUpdateChild(kid.id, { parent_id: null }) }}
                   className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                 >
                   <UserMinus size={18} />
                 </button>
               </div>
             </div>
           ))}
         </div>
       </section>

      {/* Edit Contact Modal */}
      {isEditParentOpen && (
         <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
           <form onSubmit={handleUpdateContact} className="bg-neutral-900 border border-gray-800 w-full max-w-lg rounded-3xl p-5 shadow-2xl sm:p-10">
             <div className="mb-8 flex items-start justify-between gap-4">
               <h3 className="text-2xl font-black uppercase italic text-white">Edit <span className="text-[#EF4444]">Contact</span></h3>
               <X className="text-gray-500 cursor-pointer" onClick={() => setIsEditParentOpen(false)} />
             </div>

             <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="relative">
                        <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">First Name</label>
                        <input
                        className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] transition-all pl-12"
                        value={parent.first_name}
                        onChange={e => setParent({...parent, first_name: e.target.value})}
                        />
                        <Users className="absolute left-4 top-[42px] text-gray-600" size={18} />
                    </div>
                    <div className="relative">
                        <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Last Name</label>
                        <input
                        className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] transition-all pl-12"
                        value={parent.last_name}
                        onChange={e => setParent({...parent, last_name: e.target.value})}
                        />
                        <Users className="absolute left-4 top-[42px] text-gray-600" size={18} />
                    </div>
                </div>

               <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                 <div className="relative">
                   <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Email</label>
                   <input
                     className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] transition-all pl-12"
                     value={parent.email}
                     onChange={e => setParent({...parent, email: e.target.value})}
                   />
                   <Mail className="absolute left-4 top-[42px] text-gray-600" size={18} />
                 </div>
                 <div className="relative">
                   <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Phone</label>
                   <input
                     className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] transition-all pl-12"
                     value={parent.phone}
                     onChange={e => setParent({...parent, phone: e.target.value})}
                   />
                   <Phone className="absolute left-4 top-[42px] text-gray-600" size={18} />
                 </div>
               </div>

               <div className="relative">
                 <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Address</label>
                 <input
                   className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] transition-all pl-12"
                   value={parent.address}
                   onChange={e => setParent({...parent, address: e.target.value})}
                 />
                 <MapPin className="absolute left-4 top-[42px] text-gray-600" size={18} />
               </div>
             </div>

             <button type="submit" className="w-full mt-10 bg-[#EF4444] text-white py-5 rounded-2xl font-black uppercase italic tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-3">
               <Save size={20} /> Save Changes
             </button>
           </form>
         </div>
       )}
    </div>
  );
}
