-- Add commission_rate column to companies table
ALTER TABLE public.companies 
ADD COLUMN commission_rate numeric;