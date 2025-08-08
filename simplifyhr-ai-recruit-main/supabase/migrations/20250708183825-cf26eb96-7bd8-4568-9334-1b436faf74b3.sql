-- Fix RLS policies for jobs table to allow candidates to properly see published jobs
-- The current policy requires candidates to have profiles which may not always be the case

DROP POLICY IF EXISTS "Users can view jobs based on role" ON public.jobs;

-- Create a simpler policy that allows anyone to view published jobs
CREATE POLICY "Anyone can view published jobs" 
ON public.jobs 
FOR SELECT 
USING (
  status = 'published' OR 
  created_by = auth.uid() OR
  get_current_user_role() = 'super_admin'
);

-- Allow authenticated users to view all jobs (for clients, vendors, super admins)
CREATE POLICY "Authenticated users can view jobs based on role" 
ON public.jobs 
FOR SELECT 
TO authenticated
USING (
  get_current_user_role() IN ('super_admin', 'client', 'vendor') OR
  (status = 'published' AND auth.uid() IS NOT NULL)
);