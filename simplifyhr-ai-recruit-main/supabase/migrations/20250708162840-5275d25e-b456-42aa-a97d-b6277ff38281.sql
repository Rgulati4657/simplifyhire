-- Make company_id nullable in vendors table since it should be optional
ALTER TABLE public.vendors ALTER COLUMN company_id DROP NOT NULL;