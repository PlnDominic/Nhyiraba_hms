import supabase from '../supabaseClient';

const unwrap = async (query) => {
  const { data, error } = await query;
  return { data: data || [], error };
};

// --- identity -------------------------------------------------------------
export const findStaffRecord = async (user) => {
  if (!user) return null;
  if (user.id) {
    const { data } = await supabase.from('staff').select('*').eq('user_id', user.id).maybeSingle();
    if (data) return data;
  }
  if (user.email) {
    const escaped = user.email.replace(/[%_]/g, '\\$&');
    const { data } = await supabase.from('staff').select('*').ilike('email', escaped).maybeSingle();
    if (data) return data;
  }
  return null;
};

export const getAllStaff = () => unwrap(supabase.from('staff').select('*').order('first_name'));

// --- leave & availability -------------------------------------------------
export const getLeaves = ({ staffId } = {}) => {
  let query = supabase.from('staff_leaves').select('*').order('start_date', { ascending: false });
  if (staffId) query = query.eq('staff_id', staffId);
  return unwrap(query);
};

export const createLeave = (leave) => supabase.from('staff_leaves').insert(leave).select().single();

export const updateLeave = (id, updates) => supabase
  .from('staff_leaves')
  .update({ ...updates, updated_at: new Date().toISOString() })
  .eq('id', id)
  .select()
  .single();

export const getLeavePolicies = () => unwrap(supabase.from('leave_policies').select('*').order('leave_type'));

export const getMinCoverage = () => unwrap(supabase.from('department_min_coverage').select('*'));
export const saveMinCoverage = (department, min_staff) => supabase
  .from('department_min_coverage')
  .upsert({ department, min_staff: Number(min_staff) || 0 });

export const getAvailability = (staffId) => unwrap(supabase.from('staff_availability').select('*').eq('staff_id', staffId));
export const saveAvailability = (staffId, rows) => supabase
  .from('staff_availability')
  .upsert(rows.map((r) => ({ staff_id: staffId, ...r })), { onConflict: 'staff_id,weekday' });

// --- certifications -------------------------------------------------------
export const getCertifications = ({ staffId } = {}) => {
  let query = supabase.from('staff_certifications').select('*').order('expiry_date', { ascending: true, nullsFirst: false });
  if (staffId) query = query.eq('staff_id', staffId);
  return unwrap(query);
};
export const addCertification = async (cert) => supabase
  .from('staff_certifications')
  .insert({ ...cert, created_by: (await supabase.auth.getUser()).data?.user?.id || null })
  .select()
  .single();
export const deleteCertification = (id) => supabase.from('staff_certifications').delete().eq('id', id);

export const getRequirements = () => unwrap(supabase.from('training_requirements').select('*').order('name'));
export const addRequirement = (req) => supabase.from('training_requirements').insert(req).select().single();
export const deleteRequirement = (id) => supabase.from('training_requirements').delete().eq('id', id);

// --- goals & reviews ------------------------------------------------------
export const getPeriods = () => unwrap(supabase.from('review_periods').select('*').order('start_date', { ascending: false }));
export const addPeriod = (period) => supabase.from('review_periods').insert(period).select().single();
export const updatePeriod = (id, updates) => supabase.from('review_periods').update(updates).eq('id', id).select().single();

export const getGoals = ({ staffId } = {}) => {
  let query = supabase.from('staff_goals').select('*').order('created_at', { ascending: false });
  if (staffId) query = query.eq('staff_id', staffId);
  return unwrap(query);
};
export const addGoal = async (goal) => supabase
  .from('staff_goals')
  .insert({ ...goal, created_by: (await supabase.auth.getUser()).data?.user?.id || null })
  .select()
  .single();
export const updateGoal = (id, updates) => supabase
  .from('staff_goals')
  .update({ ...updates, updated_at: new Date().toISOString() })
  .eq('id', id)
  .select()
  .single();
export const deleteGoal = (id) => supabase.from('staff_goals').delete().eq('id', id);

export const getReviews = ({ staffId } = {}) => {
  let query = supabase.from('performance_metrics').select('*').order('review_period_end', { ascending: false });
  if (staffId) query = query.eq('staff_id', staffId);
  return unwrap(query);
};
export const saveReview = (review) => (review.id
  ? supabase.from('performance_metrics').update({ ...review, updated_at: new Date().toISOString() }).eq('id', review.id).select().single()
  : supabase.from('performance_metrics').insert(review).select().single());
export const acknowledgeReview = (id, staff_comments) => supabase
  .from('performance_metrics')
  .update({ status: 'acknowledged', staff_comments: staff_comments || null, acknowledged_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  .eq('id', id)
  .select()
  .single();
