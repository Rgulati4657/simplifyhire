-- Fix infinite recursion issue by simplifying candidates policies
-- The current policies are causing infinite loops when trying to create candidate profiles during signup

-- Drop all existing candidate policies
DROP POLICY IF EXISTS "Super admins can manage all candidates" ON public.candidates;
DROP POLICY IF EXISTS "Users can manage their own candidate profile" ON public.candidates;
DROP POLICY IF EXISTS "Job creators can view applicants" ON public.candidates;

-- Create simpler, non-recursive policies for candidates
CREATE POLICY "Users can view and manage their own candidate profile" 
ON public.candidates 
FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins can manage all candidates" 
ON public.candidates 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "Job creators can view candidates who applied to their jobs" 
ON public.candidates 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ) OR 
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.job_applications ja 
    JOIN public.jobs j ON j.id = ja.job_id 
    WHERE ja.candidate_id = candidates.id 
    AND j.created_by = auth.uid()
  )
);

-- Also update the handle_new_user function to ensure it creates candidate records properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile first
  INSERT INTO public.profiles (user_id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'candidate')
  );
  
  -- If role is candidate, also create candidate record
  IF COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'candidate') = 'candidate' THEN
    INSERT INTO public.candidates (
      user_id, 
      email, 
      first_name, 
      last_name,
      phone
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', '')
    );
  END IF;
  
  RETURN NEW;
END;
$$;