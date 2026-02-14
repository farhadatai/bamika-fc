import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cuopewflwcbzwpiezqkf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b3Bld2Zsd2NiendwaWV6cWtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODg1Nzc5NCwiZXhwIjoyMDg0NDMzNzk0fQ.vQbW7L-oatwDXfe26JIHgrD1GK0Q-XDbKwSFvK_iXBw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Searching for Seema Sadat...');
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('full_name', '%Seema Sadat%');

  if (error) {
    console.error('Error searching:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Found user:', data[0]);
    const user = data[0];
    
    // Update role
    console.log('Updating role to coach...');
    const { error: roleError } = await supabase
      .from('profiles')
      .update({ 
        role: 'coach', 
        photo_url: 'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/coach-photos/ChatGPT%20Image%20Feb%2014,%202026,%2011_58_58%20AM.png'
      })
      .eq('id', user.id);
      
    if (roleError) console.error('Role update error:', roleError);

    // Insert into coaches
    console.log('Inserting into coaches table...');
    const { error: coachError } = await supabase
      .from('coaches')
      .upsert({
        id: user.id,
        full_name: 'Seema Sadat',
        photo_url: 'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/coach-photos/ChatGPT%20Image%20Feb%2014,%202026,%2011_58_58%20AM.png'
      });
      
    if (coachError) console.error('Coach insert error:', coachError);
    else console.log('Successfully added Seema Sadat as coach!');
    
  } else {
    console.log('User Seema Sadat not found in profiles.');
  }
}

run();