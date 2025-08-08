-- Create offer workflow table to track the 5-step process
CREATE TABLE public.offer_workflow (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Step 1: Background Check
  background_check_status TEXT DEFAULT 'pending',
  background_check_provider TEXT,
  background_check_reference_id TEXT,
  background_check_result JSONB,
  background_check_completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Step 2: Generate Offer
  offer_generated_at TIMESTAMP WITH TIME ZONE,
  offer_template_id UUID REFERENCES public.offer_templates(id),
  generated_offer_content TEXT,
  offer_details JSONB,
  
  -- Step 3: HR Approval
  hr_approval_status TEXT DEFAULT 'pending',
  hr_approved_by UUID,
  hr_approved_at TIMESTAMP WITH TIME ZONE,
  hr_comments TEXT,
  
  -- Step 4: Send to Candidate
  sent_to_candidate_at TIMESTAMP WITH TIME ZONE,
  candidate_notification_sent BOOLEAN DEFAULT false,
  offer_letter_url TEXT,
  
  -- Step 5: Track Acceptance
  candidate_response TEXT, -- 'accepted', 'rejected', 'negotiating'
  candidate_response_at TIMESTAMP WITH TIME ZONE,
  candidate_comments TEXT,
  final_offer_amount INTEGER,
  final_offer_currency TEXT DEFAULT 'IDR',
  
  -- Workflow tracking
  workflow_completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.offer_workflow ENABLE ROW LEVEL SECURITY;

-- Create policies for offer workflow
CREATE POLICY "Users can manage offer workflows based on role" 
ON public.offer_workflow 
FOR ALL 
USING (
  (get_current_user_role() = 'super_admin'::text) OR
  (EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN jobs j ON j.id = ja.job_id 
    WHERE ja.id = offer_workflow.application_id 
    AND j.created_by = auth.uid()
  )) OR
  (EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN candidates c ON c.id = ja.candidate_id 
    WHERE ja.id = offer_workflow.application_id 
    AND c.user_id = auth.uid()
  ))
)
WITH CHECK (
  (get_current_user_role() = 'super_admin'::text) OR
  (EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN jobs j ON j.id = ja.job_id 
    WHERE ja.id = offer_workflow.application_id 
    AND j.created_by = auth.uid()
  )) OR
  (EXISTS (
    SELECT 1 FROM job_applications ja 
    JOIN candidates c ON c.id = ja.candidate_id 
    WHERE ja.id = offer_workflow.application_id 
    AND c.user_id = auth.uid()
  ))
);

-- Create indexes for performance
CREATE INDEX idx_offer_workflow_application_id ON public.offer_workflow(application_id);
CREATE INDEX idx_offer_workflow_status ON public.offer_workflow(status);
CREATE INDEX idx_offer_workflow_current_step ON public.offer_workflow(current_step);

-- Create function to update workflow step
CREATE OR REPLACE FUNCTION public.advance_offer_workflow_step(
  workflow_id UUID,
  step_data JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_workflow RECORD;
  next_step INTEGER;
  result JSONB;
BEGIN
  -- Get current workflow
  SELECT * INTO current_workflow 
  FROM public.offer_workflow 
  WHERE id = workflow_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Workflow not found');
  END IF;
  
  next_step := current_workflow.current_step + 1;
  
  -- Update the workflow based on current step
  CASE current_workflow.current_step
    WHEN 1 THEN -- Background check completed
      UPDATE public.offer_workflow 
      SET 
        current_step = next_step,
        background_check_status = COALESCE(step_data->>'background_check_status', 'completed'),
        background_check_result = COALESCE(step_data->'background_check_result', '{}'),
        background_check_completed_at = now(),
        updated_at = now()
      WHERE id = workflow_id;
      
    WHEN 2 THEN -- Offer generated
      UPDATE public.offer_workflow 
      SET 
        current_step = next_step,
        offer_generated_at = now(),
        generated_offer_content = step_data->>'generated_offer_content',
        offer_details = COALESCE(step_data->'offer_details', '{}'),
        updated_at = now()
      WHERE id = workflow_id;
      
    WHEN 3 THEN -- HR approved
      UPDATE public.offer_workflow 
      SET 
        current_step = next_step,
        hr_approval_status = 'approved',
        hr_approved_by = auth.uid(),
        hr_approved_at = now(),
        hr_comments = step_data->>'hr_comments',
        updated_at = now()
      WHERE id = workflow_id;
      
    WHEN 4 THEN -- Sent to candidate
      UPDATE public.offer_workflow 
      SET 
        current_step = next_step,
        sent_to_candidate_at = now(),
        candidate_notification_sent = true,
        offer_letter_url = step_data->>'offer_letter_url',
        updated_at = now()
      WHERE id = workflow_id;
      
    WHEN 5 THEN -- Candidate responded
      UPDATE public.offer_workflow 
      SET 
        candidate_response = step_data->>'candidate_response',
        candidate_response_at = now(),
        candidate_comments = step_data->>'candidate_comments',
        final_offer_amount = COALESCE((step_data->>'final_offer_amount')::integer, current_workflow.final_offer_amount),
        status = CASE 
          WHEN step_data->>'candidate_response' = 'accepted' THEN 'completed'
          WHEN step_data->>'candidate_response' = 'rejected' THEN 'rejected'
          ELSE 'negotiating'
        END,
        workflow_completed_at = CASE 
          WHEN step_data->>'candidate_response' IN ('accepted', 'rejected') THEN now()
          ELSE NULL
        END,
        updated_at = now()
      WHERE id = workflow_id;
      
    ELSE
      RETURN jsonb_build_object('success', false, 'message', 'Invalid workflow step');
  END CASE;
  
  RETURN jsonb_build_object('success', true, 'current_step', next_step);
END;
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_offer_workflow_updated_at
  BEFORE UPDATE ON public.offer_workflow
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();