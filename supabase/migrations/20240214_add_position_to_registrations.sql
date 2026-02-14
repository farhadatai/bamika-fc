-- Add position column to registrations table to support temporary storage before moving to players
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS position TEXT DEFAULT 'TBD';
