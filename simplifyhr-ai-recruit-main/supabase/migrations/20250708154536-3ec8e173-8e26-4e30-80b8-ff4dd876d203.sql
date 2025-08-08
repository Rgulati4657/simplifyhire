-- Enable company management for super admins
CREATE POLICY "Super admins can manage companies"
ON public.companies
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

-- Enable vendor management for super admins and clients
CREATE POLICY "Super admins and clients can manage vendors"
ON public.vendors
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role IN ('super_admin', 'client')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role IN ('super_admin', 'client')
));

-- Enable interview management
CREATE POLICY "Users can manage interviews based on role"
ON public.interviews
FOR ALL
TO authenticated
USING ((EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
)) OR (interviewer_id = auth.uid()) OR (EXISTS (
  SELECT 1 FROM job_applications ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE ja.id = interviews.application_id
  AND j.created_by = auth.uid()
)))
WITH CHECK ((EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
)) OR (interviewer_id = auth.uid()) OR (EXISTS (
  SELECT 1 FROM job_applications ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE ja.id = interviews.application_id
  AND j.created_by = auth.uid()
)));

-- Enable job application management
CREATE POLICY "Users can manage job applications based on role"
ON public.job_applications
FOR ALL
TO authenticated
USING ((EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
)) OR (EXISTS (
  SELECT 1 FROM candidates c
  WHERE c.id = job_applications.candidate_id
  AND c.user_id = auth.uid()
)) OR (EXISTS (
  SELECT 1 FROM jobs j
  WHERE j.id = job_applications.job_id
  AND j.created_by = auth.uid()
)))
WITH CHECK ((EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
)) OR (EXISTS (
  SELECT 1 FROM candidates c
  WHERE c.id = job_applications.candidate_id
  AND c.user_id = auth.uid()
)) OR (EXISTS (
  SELECT 1 FROM jobs j
  WHERE j.id = job_applications.job_id
  AND j.created_by = auth.uid()
)));

-- Enable offer management
CREATE POLICY "Users can manage offers based on role"
ON public.offers
FOR ALL
TO authenticated
USING ((EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
)) OR (EXISTS (
  SELECT 1 FROM job_applications ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE ja.id = offers.application_id
  AND j.created_by = auth.uid()
)) OR (EXISTS (
  SELECT 1 FROM job_applications ja
  JOIN candidates c ON c.id = ja.candidate_id
  WHERE ja.id = offers.application_id
  AND c.user_id = auth.uid()
)))
WITH CHECK ((EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
)) OR (EXISTS (
  SELECT 1 FROM job_applications ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE ja.id = offers.application_id
  AND j.created_by = auth.uid()
)) OR (EXISTS (
  SELECT 1 FROM job_applications ja
  JOIN candidates c ON c.id = ja.candidate_id
  WHERE ja.id = offers.application_id
  AND c.user_id = auth.uid()
)));

-- Enable job management for clients and super admins
CREATE POLICY "Clients and super admins can manage jobs"
ON public.jobs
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role IN ('super_admin', 'client')
));

CREATE POLICY "Users can update their own jobs"
ON public.jobs
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
))
WITH CHECK (created_by = auth.uid() OR EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Users can delete their own jobs"
ON public.jobs
FOR DELETE
TO authenticated
USING (created_by = auth.uid() OR EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));