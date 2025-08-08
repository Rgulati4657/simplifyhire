-- Fix RLS policies for interviews table to allow proper access
DROP POLICY IF EXISTS "Users can manage interviews based on role" ON public.interviews;

-- Create more granular policies for interviews
CREATE POLICY "Super admins can manage all interviews"
ON public.interviews
FOR ALL
USING (get_current_user_role() = 'super_admin')
WITH CHECK (get_current_user_role() = 'super_admin');

CREATE POLICY "Interviewers can manage assigned interviews"
ON public.interviews
FOR ALL
USING (interviewer_id = auth.uid())
WITH CHECK (interviewer_id = auth.uid());

CREATE POLICY "Job creators can manage interviews for their jobs"
ON public.interviews
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM job_applications ja
    JOIN jobs j ON j.id = ja.job_id
    WHERE ja.id = interviews.application_id
    AND j.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM job_applications ja
    JOIN jobs j ON j.id = ja.job_id
    WHERE ja.id = interviews.application_id
    AND j.created_by = auth.uid()
  )
);

CREATE POLICY "Candidates can view their own interviews"
ON public.interviews
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM job_applications ja
    JOIN candidates c ON c.id = ja.candidate_id
    WHERE ja.id = interviews.application_id
    AND c.user_id = auth.uid()
  )
);

-- Fix function search path issue
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Add AI interview session tracking table
CREATE TABLE IF NOT EXISTS public.ai_interview_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  session_data JSONB NOT NULL DEFAULT '{}',
  ai_prompt TEXT,
  conversation_history JSONB NOT NULL DEFAULT '[]',
  current_question TEXT,
  evaluation_notes TEXT,
  ai_assessment JSONB,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for AI interview sessions
ALTER TABLE public.ai_interview_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for AI interview sessions
CREATE POLICY "Users can manage AI interview sessions for their interviews"
ON public.ai_interview_sessions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM interviews i
    JOIN job_applications ja ON ja.id = i.application_id
    JOIN jobs j ON j.id = ja.job_id
    WHERE i.id = ai_interview_sessions.interview_id
    AND (j.created_by = auth.uid() OR i.interviewer_id = auth.uid() OR get_current_user_role() = 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM interviews i
    JOIN job_applications ja ON ja.id = i.application_id
    JOIN jobs j ON j.id = ja.job_id
    WHERE i.id = ai_interview_sessions.interview_id
    AND (j.created_by = auth.uid() OR i.interviewer_id = auth.uid() OR get_current_user_role() = 'super_admin')
  )
);

-- Add trigger for ai_interview_sessions updated_at
CREATE TRIGGER update_ai_interview_sessions_updated_at
  BEFORE UPDATE ON public.ai_interview_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add columns to interviews table for AI interview support
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS ai_interview_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_evaluation_score NUMERIC,
ADD COLUMN IF NOT EXISTS ai_evaluation_summary TEXT;