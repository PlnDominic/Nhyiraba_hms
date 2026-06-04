-- Add block/building column to rooms table
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS block VARCHAR(100) DEFAULT 'Main Block';

-- Create index on block column for better query performance
CREATE INDEX IF NOT EXISTS idx_rooms_block ON public.rooms(block);

-- Add comment to document the column
COMMENT ON COLUMN public.rooms.block IS 'Building/Block where the room is located (e.g., Main Block, Aquarian Block)';
