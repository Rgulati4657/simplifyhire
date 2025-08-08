-- First, let's enhance the jobs table to support all the requirements
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS interview_rounds INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS interview_types JSONB, -- Array of {round: number, type: 'ai'|'human', criteria: string}
ADD COLUMN IF NOT EXISTS scoring_criteria TEXT[],
ADD COLUMN IF NOT EXISTS publish_to_linkedin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS publish_to_website BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS publish_to_vendors BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS budget_range_min INTEGER,
ADD COLUMN IF NOT EXISTS budget_range_max INTEGER,
ADD COLUMN IF NOT EXISTS budget_auto_suggested BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS assigned_vendors UUID[],
ADD COLUMN IF NOT EXISTS offer_template_id UUID;

-- Create offer templates table
CREATE TABLE IF NOT EXISTS public.offer_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  template_name TEXT NOT NULL,
  template_content TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Indonesia',
  is_validated BOOLEAN DEFAULT false,
  validation_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on offer_templates
ALTER TABLE public.offer_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for offer_templates
CREATE POLICY "Users can manage their own offer templates" 
ON public.offer_templates 
FOR ALL 
USING (created_by = auth.uid()) 
WITH CHECK (created_by = auth.uid());

-- Create interview rounds table for structured interview management
CREATE TABLE IF NOT EXISTS public.interview_rounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  round_type TEXT NOT NULL CHECK (round_type IN ('ai', 'human')),
  scoring_criteria TEXT,
  duration_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, round_number)
);

-- Enable RLS on interview_rounds
ALTER TABLE public.interview_rounds ENABLE ROW LEVEL SECURITY;

-- Create policies for interview_rounds
CREATE POLICY "Users can manage interview rounds for their jobs" 
ON public.interview_rounds 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.jobs 
  WHERE jobs.id = interview_rounds.job_id 
  AND jobs.created_by = auth.uid()
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.jobs 
  WHERE jobs.id = interview_rounds.job_id 
  AND jobs.created_by = auth.uid()
));

-- Add triggers for updated_at
CREATE TRIGGER update_offer_templates_updated_at
BEFORE UPDATE ON public.offer_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_interview_rounds_updated_at
BEFORE UPDATE ON public.interview_rounds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();