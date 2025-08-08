-- Add vendor contact details to vendors table
ALTER TABLE public.vendors 
ADD COLUMN vendor_name text,
ADD COLUMN spoc_name text,
ADD COLUMN spoc_email text,
ADD COLUMN spoc_phone text;