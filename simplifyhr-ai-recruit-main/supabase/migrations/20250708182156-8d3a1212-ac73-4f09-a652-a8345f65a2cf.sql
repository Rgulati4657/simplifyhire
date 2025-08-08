-- Fix RLS policies for companies table to allow clients to create companies
DROP POLICY IF EXISTS "Super admins can manage companies" ON public.companies;
DROP POLICY IF EXISTS "Company members can view their company" ON public.companies;
DROP POLICY IF EXISTS "Super admins can view all companies" ON public.companies;

-- Create new policies that allow clients to create and manage companies
CREATE POLICY "Super admins can manage all companies" 
ON public.companies 
FOR ALL 
USING (get_current_user_role() = 'super_admin');

CREATE POLICY "Clients can create companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (get_current_user_role() IN ('client', 'super_admin'));

CREATE POLICY "Users can view companies they interact with" 
ON public.companies 
FOR SELECT 
USING (
  get_current_user_role() = 'super_admin' OR 
  EXISTS (
    SELECT 1 FROM jobs j 
    WHERE j.company_id = companies.id AND j.created_by = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.company_name ILIKE companies.name
  )
);

CREATE POLICY "Job creators can update their companies" 
ON public.companies 
FOR UPDATE 
USING (
  get_current_user_role() = 'super_admin' OR 
  EXISTS (
    SELECT 1 FROM jobs j 
    WHERE j.company_id = companies.id AND j.created_by = auth.uid()
  )
);

-- Fix infinite recursion in candidates table by simplifying the policy
DROP POLICY IF EXISTS "Users can manage candidates based on role" ON public.candidates;

CREATE POLICY "Super admins can manage all candidates" 
ON public.candidates 
FOR ALL 
USING (get_current_user_role() = 'super_admin');

CREATE POLICY "Users can manage their own candidate profile" 
ON public.candidates 
FOR ALL 
USING (user_id = auth.uid());

CREATE POLICY "Job creators can view applicants" 
ON public.candidates 
FOR SELECT 
USING (
  get_current_user_role() = 'super_admin' OR 
  user_id = auth.uid() OR
  id IN (
    SELECT ja.candidate_id 
    FROM job_applications ja 
    JOIN jobs j ON j.id = ja.job_id 
    WHERE j.created_by = auth.uid()
  )
);