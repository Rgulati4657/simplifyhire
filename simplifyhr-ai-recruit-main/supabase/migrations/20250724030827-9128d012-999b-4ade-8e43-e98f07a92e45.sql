-- Fix the RLS policy for companies to allow clients and super_admins to create companies
-- Also handle cases where profile might not exist yet
DROP POLICY IF EXISTS "Clients can create companies" ON public.companies;

CREATE POLICY "Clients can create companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('client', 'super_admin')
  )
  OR 
  -- Fallback: allow creation if user is authenticated and no profile exists yet
  (auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = auth.uid()
  ))
);

-- Also ensure users can see companies they try to create
DROP POLICY IF EXISTS "Users can view companies they interact with" ON public.companies;

CREATE POLICY "Users can view companies they interact with" 
ON public.companies 
FOR SELECT 
USING (
  (get_current_user_role() = 'super_admin'::text) OR 
  (EXISTS ( SELECT 1
     FROM jobs j
    WHERE ((j.company_id = companies.id) AND (j.created_by = auth.uid())))) OR 
  (EXISTS ( SELECT 1
     FROM profiles p
    WHERE ((p.user_id = auth.uid()) AND (p.company_name ~~* companies.name)))) OR
  -- Allow viewing if user is authenticated (for creation process)
  (auth.uid() IS NOT NULL)
);