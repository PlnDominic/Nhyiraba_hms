-- Drop the existing check constraint
ALTER TABLE public.inventory_transactions
DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

-- Add the new check constraint with expanded values
ALTER TABLE public.inventory_transactions
ADD CONSTRAINT inventory_transactions_transaction_type_check 
CHECK (transaction_type IN (
    'purchase', 
    'consumption', 
    'adjustment', 
    'transfer_in', 
    'transfer_out', 
    'sale', 
    'return', 
    'waste'
));
