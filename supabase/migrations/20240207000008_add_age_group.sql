-- Add age_group column to registrations table
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS age_group text;
