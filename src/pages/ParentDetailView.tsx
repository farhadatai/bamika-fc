import React, { useEffect, useState } from 'react';
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

export default function ParentDetailView() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const [parent, setParent] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditParentOpen, setIsEditParentOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<any>(null); 

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('profiles')
      .select(`*, players (*), registrations (*)`)
      .eq('id', id)
      .single();

    if (error) throw error;

    setParent(data);
    setChildren(data.players || []);
    setPayments(data.registrations || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parent || !user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ 
        full_name: parent.full_name, 
        email: parent.email, 
        phone: parent.phone, 
        address: parent.address 
      })
      .eq('id', parent.id);

    if (!error) {
      logAdminAction(user.id, parent.id, 'UPDATE_CONTACT_INFO', { updated_fields: parent });
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

  if (loading) return <div>Loading...</div>;
  if (!parent) return <div>Parent not found.</div>;

  const registrationStatus = children.length > 0 ? 'Complete' : 'Incomplete';
  const financialStatus = payments.every(p => p.payment_status === 'paid') ? 'Good Standing' : 'Overdue';
  const documentStatus = payments.every(p => p.waiver_signed_at) ? 'Waivers Signed' : 'Missing';

  return (
    <div className="bg-black min-h-screen p-8 text-white">
      <h1 className="text-3xl font-bold mb-6">{parent.full_name}</h1>

      {/* Status HUD */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-neutral-900 border border-gray-800 p-4 rounded-lg text-center">
          <div className="text-sm font-bold text-gray-500">Registration</div>
          <div className={`text-lg font-bold ${registrationStatus === 'Complete' ? 'text-green-500' : 'text-red-500'}`}>{registrationStatus}</div>
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Contact Information</h2>
          <button onClick={() => setIsEditParentOpen(true)} className="bg-blue-500 text-white px-4 py-2 rounded-md font-bold">Edit</button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><span className="font-bold">Email:</span> {parent.email}</div>
          <div><span className="font-bold">Phone:</span> {parent.phone}</div>
        </div>
      </div>

      {/* Child Management */}
       <section className="mt-12 bg-neutral-900 rounded-3xl border border-gray-800 overflow-hidden">
         <div className="p-8 border-b border-gray-800 flex justify-between items-center">
           <h2 className="text-2xl font-black uppercase italic text-white">Athlete <span className="text-[#EF4444]">Roster</span></h2>
           <button className="flex items-center gap-2 text-[#EF4444] font-black uppercase italic text-xs border border-[#EF4444]/30 px-4 py-2 rounded-xl hover:bg-[#EF4444] hover:text-white transition-all">
             <Plus size={16} /> Add New Athlete
           </button>
         </div>

         <div className="p-8 grid gap-4">
           {children.map((kid: any) => (
             <div key={kid.id} className="bg-black/40 border border-gray-800 p-6 rounded-2xl flex items-center justify-between group hover:border-[#EF4444] transition-all">
               <div className="flex items-center gap-6">
                 <div className="h-12 w-12 rounded-full bg-neutral-800 flex items-center justify-center font-black text-[#EF4444]">
                   {kid.full_name.charAt(0)}
                 </div>
                 <div>
                   <h4 className="text-white font-bold text-lg">{kid.full_name}</h4>
                   <div className="flex gap-4 mt-1">
                     <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">DOB: {kid.date_of_birth}</span>
                     <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Pos: {kid.position || 'TBD'}</span>
                   </div>
                 </div>
               </div>

               <div className="flex items-center gap-4">
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
           <form onSubmit={handleUpdateContact} className="bg-neutral-900 border border-gray-800 w-full max-w-lg rounded-3xl p-10 shadow-2xl">
             <div className="flex justify-between items-center mb-8">
               <h3 className="text-2xl font-black uppercase italic text-white">Edit <span className="text-[#EF4444]">Contact</span></h3>
               <X className="text-gray-500 cursor-pointer" onClick={() => setIsEditParentOpen(false)} />
             </div>

             <div className="space-y-6">
               <div className="relative">
                 <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Full Name</label>
                 <input
                   className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] transition-all pl-12"
                   value={parent.full_name}
                   onChange={e => setParent({...parent, full_name: e.target.value})}
                 />
                 <Users className="absolute left-4 top-[42px] text-gray-600" size={18} />
               </div>

               <div className="grid grid-cols-2 gap-4">
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
