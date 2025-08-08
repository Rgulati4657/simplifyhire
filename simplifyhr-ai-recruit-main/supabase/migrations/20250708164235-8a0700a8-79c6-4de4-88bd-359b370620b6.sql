-- Fix infinite recursion in RLS policies by creating proper security definer functions

-- First, check if get_current_user_role function exists and works properly
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(role::text, 'candidate') FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Drop existing problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can manage candidates based on role" ON candidates;
DROP POLICY IF EXISTS "Users can manage job applications based on role" ON job_applications;
DROP POLICY IF EXISTS "Users can manage interviews based on role" ON interviews;
DROP POLICY IF EXISTS "Users can manage offers based on role" ON offers;

-- Create new policies using the security definer function
CREATE POLICY "Users can manage candidates based on role" 
ON candidates 
FOR ALL 
USING (
  get_current_user_role() = 'super_admin' OR 
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM jobs j 
    JOIN job_applications ja ON j.id = ja.job_id 
    WHERE ja.candidate_id = candidates.id AND j.created_by = auth.uid()
  )
)
WITH CHECK (
  get_current_user_role() = 'super_admin' OR 
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM jobs j 
    JOIN job_applications ja ON j.id = ja.job_id 
    WHERE ja.candidate_id = candidates.id AND j.created_by = auth.uid()
  )
);

CREATE POLICY "Users can manage job applications based on role" 
ON job_applications 
FOR ALL 
USING (
  get_current_user_role() = 'super_admin' OR 
  EXISTS (
    SELECT 1 FROM candidates c 
    WHERE c.id = job_applications.candidate_id AND c.user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM jobs j 
    WHERE j.id = job_applications.job_id AND j.created_by = auth.uid()
  )
)
WITH CHECK (
  get_current_user_role() = 'super_admin' OR 
  EXISTS (
    SELECT 1 FROM candidates c 
    WHERE c.id = job_applications.candidate_id AND c.user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM jobs j 
    WHERE j.id = job_applications.job_id AND j.created_by = auth.uid()
  )
);

CREATE POLICY "Users can manage interviews based on role" 
ON interviews 
FOR ALL 
USING (
  get_current_user_role() = 'super_admin' OR 
  interviewer_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN jobs j ON j.id = ja.job_id 
    WHERE ja.id = interviews.application_id AND j.created_by = auth.uid()
  )
)
WITH CHECK (
  get_current_user_role() = 'super_admin' OR 
  interviewer_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN jobs j ON j.id = ja.job_id 
    WHERE ja.id = interviews.application_id AND j.created_by = auth.uid()
  )
);

CREATE POLICY "Users can manage offers based on role" 
ON offers 
FOR ALL 
USING (
  get_current_user_role() = 'super_admin' OR 
  EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN jobs j ON j.id = ja.job_id 
    WHERE ja.id = offers.application_id AND j.created_by = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN candidates c ON c.id = ja.candidate_id 
    WHERE ja.id = offers.application_id AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  get_current_user_role() = 'super_admin' OR 
  EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN jobs j ON j.id = ja.job_id 
    WHERE ja.id = offers.application_id AND j.created_by = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN candidates c ON c.id = ja.candidate_id 
    WHERE ja.id = offers.application_id AND c.user_id = auth.uid()
  )
);