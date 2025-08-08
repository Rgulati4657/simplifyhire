-- Add role field to offer_templates table for role-based categorization
ALTER TABLE public.offer_templates 
ADD COLUMN job_role TEXT;

-- Add index for better performance when filtering by role
CREATE INDEX idx_offer_templates_job_role ON public.offer_templates(job_role);

-- Update existing templates to have a default role (can be updated by users later)
UPDATE public.offer_templates 
SET job_role = 'General' 
WHERE job_role IS NULL;