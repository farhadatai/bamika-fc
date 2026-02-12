-- Add payment_status column to registrations table
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';
