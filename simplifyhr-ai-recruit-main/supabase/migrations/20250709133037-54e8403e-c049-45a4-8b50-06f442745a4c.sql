-- Replace the function without dropping it
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(role::text, 'candidate') 
  FROM public.profiles 
  WHERE user_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = 'public';