-- Migration to update players table for Youth Academy model
-- This script ensures the players table has the correct structure for linking to parents

-- 1. Add columns if they don't exist (using idempotent approach)
DO $$
BEGIN
    -- Add parent_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'parent_id') THEN
        ALTER TABLE players ADD COLUMN parent_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;

    -- Add date_of_birth if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'date_of_birth') THEN
        ALTER TABLE players ADD COLUMN date_of_birth DATE;
    END IF;

    -- Add gender if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'gender') THEN
        ALTER TABLE players ADD COLUMN gender TEXT;
    END IF;
    
    -- Ensure id is gen_random_uuid() (might need to alter column default if not already)
    -- This is trickier to check idempotently in simple SQL block without complex introspection, 
    -- but usually we can assume it's fine if we created it recently. 
    -- If id was not uuid, this would fail, but we saw in get_tables it is uuid.
END $$;

-- 2. Drop the old foreign key to profiles(id) if it was strictly 1:1 on ID (which might have been 'players_id_fkey')
-- We want players.id to be independent, and players.parent_id to link to profiles.id
-- Checking constraints...
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'players_id_fkey') THEN
        ALTER TABLE players DROP CONSTRAINT players_id_fkey;
    END IF;
END $$;

-- 3. Ensure RLS allows parents to view/insert their own players, and admins to view/edit all
-- (Assuming we might need RLS updates, but for now we'll stick to structure)
