-- Fix infinite recursion in candidates RLS policy
-- First, drop the problematic policy
DROP POLICY IF EXISTS "Users can manage candidates based on role" ON candidates;

-- Create a simpler, non-recursive policy for candidates
CREATE POLICY "Users can manage candidates based on role" ON candidates
FOR ALL
USING (
  (get_current_user_role() = 'super_admin'::text) OR 
  (user_id = auth.uid()) OR
  (auth.uid() IN (
    SELECT j.created_by 
    FROM jobs j 
    INNER JOIN job_applications ja ON j.id = ja.job_id 
    WHERE ja.candidate_id = candidates.id
  ))
)
WITH CHECK (
  (get_current_user_role() = 'super_admin'::text) OR 
  (user_id = auth.uid()) OR
  (auth.uid() IN (
    SELECT j.created_by 
    FROM jobs j 
    INNER JOIN job_applications ja ON j.id = ja.job_id 
    WHERE ja.candidate_id = candidates.id
  ))
);