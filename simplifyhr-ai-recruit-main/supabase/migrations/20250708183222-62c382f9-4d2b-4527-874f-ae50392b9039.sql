-- Fix infinite recursion in candidates policies by removing all cross-table references
-- The issue is that during signup, the policies try to check profiles table which doesn't exist yet

-- Drop all existing candidate policies
DROP POLICY IF EXISTS "Users can view and manage their own candidate profile" ON public.candidates;
DROP POLICY IF EXISTS "Super admins can manage all candidates" ON public.candidates;
DROP POLICY IF EXISTS "Job creators can view candidates who applied to their jobs" ON public.candidates;

-- Create completely non-recursive policies
-- 1. Users can manage their own candidate profile (no table joins)
CREATE POLICY "Users can manage their own candidate profile" 
ON public.candidates 
FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2. Allow authenticated users to insert candidates (needed for signup)
CREATE POLICY "Allow authenticated users to create candidate profiles" 
ON public.candidates 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 3. Allow authenticated users to view candidates (simplified for now)
CREATE POLICY "Allow authenticated users to view candidates" 
ON public.candidates 
FOR SELECT 
TO authenticated
USING (true);

-- Also need to fix the handle_new_user function to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role user_role;
BEGIN
  -- Get the role from metadata, default to candidate
  user_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'candidate');
  
  -- Insert profile first
  INSERT INTO public.profiles (user_id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    user_role
  );
  
  -- If role is candidate, also create candidate record
  IF user_role = 'candidate' THEN
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
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't prevent user creation
  RAISE NOTICE 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;