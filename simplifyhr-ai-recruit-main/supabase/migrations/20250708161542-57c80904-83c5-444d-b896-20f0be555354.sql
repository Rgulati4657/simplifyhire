-- Create a security definer function to get user role safely
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Update RLS policies to use the security definer function
DROP POLICY IF EXISTS "Super admins and clients can manage vendors" ON public.vendors;

CREATE POLICY "Super admins and clients can manage vendors" 
ON public.vendors 
FOR ALL 
USING (public.get_current_user_role() IN ('super_admin', 'client'))
WITH CHECK (public.get_current_user_role() IN ('super_admin', 'client'));