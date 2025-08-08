-- Add minimum assessment criteria to jobs table
ALTER TABLE public.jobs 
ADD COLUMN min_assessment_score integer DEFAULT 70;

-- Add comment for clarity
COMMENT ON COLUMN public.jobs.min_assessment_score IS 'Minimum AI assessment score (0-100) required to shortlist for interview';