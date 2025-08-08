-- Check current function definition
SELECT prosrc FROM pg_proc WHERE proname = 'get_current_user_role';

-- Drop and recreate the function to fix the issue
DROP FUNCTION IF EXISTS public.get_current_user_role();

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(role::text, 'candidate') 
  FROM public.profiles 
  WHERE user_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = 'public';