import supabase from '../supabaseClient';

// Saved SMS contacts (people who are not hotel guests). Managers can read; only admins can change.
// Phones are stored as digits with the country code, so a number is saved once.

export const listContacts = async () => {
  const { data, error } = await supabase
    .from('sms_contacts')
    .select('id, name, phone, group_name, opted_out, created_at')
    .order('created_at', { ascending: false })
    .limit(10000);
  if (error) return { success: false, error: error.message, data: [] };
  return { success: true, data: data || [] };
};

// Adds contacts that are not saved yet; numbers already saved are left untouched
// (names, groups and opt-outs are never overwritten by an import).
export const addContacts = async (contacts) => {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  if (!userId) return { success: false, error: 'Not signed in', added: 0 };

  let added = 0;
  for (let i = 0; i < contacts.length; i += 500) {
    const chunk = contacts.slice(i, i + 500).map((c) => ({
      name: c.name || null,
      phone: c.phone,
      group_name: c.group || null,
      created_by: userId
    }));
    const { data, error } = await supabase
      .from('sms_contacts')
      .upsert(chunk, { onConflict: 'phone', ignoreDuplicates: true })
      .select('id');
    if (error) {
      const setup = /sms_contacts|relation|schema cache/i.test(error.message);
      return {
        success: false,
        added,
        error: setup ? 'Saved contacts are not set up yet. Run the sms_contacts migration in Supabase.' : error.message
      };
    }
    added += data?.length || 0;
  }
  return { success: true, added };
};

export const setContactOptOut = async (id, optedOut) => {
  const { error } = await supabase.from('sms_contacts').update({ opted_out: optedOut }).eq('id', id);
  return error ? { success: false, error: error.message } : { success: true };
};

export const deleteContacts = async (ids) => {
  const { error } = await supabase.from('sms_contacts').delete().in('id', ids);
  return error ? { success: false, error: error.message } : { success: true };
};
