-- Fix all RLS policies causing infinite recursion

-- First, drop all problematic policies
DROP POLICY IF EXISTS "Users can manage candidates based on role" ON public.candidates;
DROP POLICY IF EXISTS "Users can manage job applications based on role" ON public.job_applications;
DROP POLICY IF EXISTS "Users can manage interviews based on role" ON public.interviews;
DROP POLICY IF EXISTS "Users can manage offers based on role" ON public.offers;

-- Create new safe policies using the security definer function
CREATE POLICY "Users can manage candidates based on role" 
ON public.candidates 
FOR ALL 
USING (
  public.get_current_user_role() = 'super_admin' OR 
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN jobs j ON j.id = ja.job_id 
    WHERE ja.candidate_id = candidates.id 
    AND j.created_by = auth.uid()
  )
);

CREATE POLICY "Users can manage job applications based on role" 
ON public.job_applications 
FOR ALL 
USING (
  public.get_current_user_role() = 'super_admin' OR 
  EXISTS (
    SELECT 1 FROM candidates c 
    WHERE c.id = job_applications.candidate_id 
    AND c.user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM jobs j 
    WHERE j.id = job_applications.job_id 
    AND j.created_by = auth.uid()
  )
)
WITH CHECK (
  public.get_current_user_role() = 'super_admin' OR 
  EXISTS (
    SELECT 1 FROM candidates c 
    WHERE c.id = job_applications.candidate_id 
    AND c.user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM jobs j 
    WHERE j.id = job_applications.job_id 
    AND j.created_by = auth.uid()
  )
);

CREATE POLICY "Users can manage interviews based on role" 
ON public.interviews 
FOR ALL 
USING (
  public.get_current_user_role() = 'super_admin' OR 
  interviewer_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN jobs j ON j.id = ja.job_id 
    WHERE ja.id = interviews.application_id 
    AND j.created_by = auth.uid()
  )
)
WITH CHECK (
  public.get_current_user_role() = 'super_admin' OR 
  interviewer_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN jobs j ON j.id = ja.job_id 
    WHERE ja.id = interviews.application_id 
    AND j.created_by = auth.uid()
  )
);

CREATE POLICY "Users can manage offers based on role" 
ON public.offers 
FOR ALL 
USING (
  public.get_current_user_role() = 'super_admin' OR 
  EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN jobs j ON j.id = ja.job_id 
    WHERE ja.id = offers.application_id 
    AND j.created_by = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN candidates c ON c.id = ja.candidate_id 
    WHERE ja.id = offers.application_id 
    AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  public.get_current_user_role() = 'super_admin' OR 
  EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN jobs j ON j.id = ja.job_id 
    WHERE ja.id = offers.application_id 
    AND j.created_by = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN candidates c ON c.id = ja.candidate_id 
    WHERE ja.id = offers.application_id 
    AND c.user_id = auth.uid()
  )
);