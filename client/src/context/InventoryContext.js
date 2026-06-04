import React, { createContext, useState, useEffect, useContext } from 'react';
import supabase from '../supabaseClient';
import { useUser } from './UserContext';
import toast from 'react-hot-toast';

const InventoryContext = createContext();

export const useInventory = () => useContext(InventoryContext);

export const InventoryProvider = ({ children }) => {
  const { user } = useUser();
  const [inventoryItems, setInventoryItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lowStockItems, setLowStockItems] = useState([]);

  // Fetch all inventory items
  const fetchInventoryItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*, inventory_categories(id, name)')
        .order('name');

      if (error) throw error;
      setInventoryItems(data || []);
      return data;
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      setError(error.message);
      toast.error('Failed to fetch inventory data from server');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Fetch all categories
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
      return data;
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Fetch all transactions
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select('*, item:item_id(name, sku)')
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
      return data;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Add a new inventory item
  const addInventoryItem = async (itemData) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('inventory_items')
        .insert([itemData])
        .select('*, inventory_categories(id, name)')
        .single();

      if (error) throw error;

      setInventoryItems(prev => [...prev, data]);
      toast.success('Item added successfully');
      return { data, error: null };
    } catch (error) {
      console.error('Error adding inventory item:', error);
      setError(error.message);
      toast.error(`Failed to add item: ${error.message}`);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  // Update an existing inventory item
  const updateInventoryItem = async (id, itemData) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('inventory_items')
        .update(itemData)
        .eq('id', id)
        .select('*, inventory_categories(id, name)')
        .single();

      if (error) throw error;

      setInventoryItems(prev => prev.map(item => item.id === id ? data : item));
      toast.success('Item updated successfully');
      return { data, error: null };
    } catch (error) {
      console.error('Error updating inventory item:', error);
      setError(error.message);
      toast.error(`Failed to update item: ${error.message}`);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  // Delete an inventory item
  const deleteInventoryItem = async (id) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setInventoryItems(prev => prev.filter(item => item.id !== id));
      toast.success('Item deleted successfully');
      return { error: null };
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      setError(error.message);
      toast.error(`Failed to delete item: ${error.message}`);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  // Add a new category
  const addCategory = async (categoryData) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('inventory_categories')
        .insert([categoryData])
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => [...prev, data]);
      toast.success('Category added successfully');
      return { data, error: null };
    } catch (error) {
      console.error('Error adding category:', error);
      setError(error.message);
      toast.error(`Failed to add category: ${error.message}`);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  // Update an existing category
  const updateCategory = async (id, categoryData) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('inventory_categories')
        .update(categoryData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => prev.map(cat => cat.id === id ? data : cat));
      toast.success('Category updated successfully');
      return { data, error: null };
    } catch (error) {
      console.error('Error updating category:', error);
      setError(error.message);
      toast.error(`Failed to update category: ${error.message}`);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  // Delete a category
  const deleteCategory = async (id) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('inventory_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCategories(prev => prev.filter(cat => cat.id !== id));
      toast.success('Category deleted successfully');
      return { error: null };
    } catch (error) {
      console.error('Error deleting category:', error);
      setError(error.message);
      toast.error(`Failed to delete category: ${error.message}`);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  // Add a new transaction
  const addTransaction = async (transactionData) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('inventory_transactions')
        .insert([transactionData])
        .select('*, item:item_id(name, sku)')
        .single();

      if (error) throw error;

      setTransactions(prev => [data, ...prev]);

      // Update inventory item stock level if it's a consumption, purchase, or sale
      if (transactionData.transaction_type === 'consumption' ||
        transactionData.transaction_type === 'purchase' ||
        transactionData.transaction_type === 'sale') {
        const item = inventoryItems.find(i => i.id === transactionData.item_id);
        if (item) {
          const stockChange = transactionData.transaction_type === 'purchase'
            ? transactionData.quantity
            : -transactionData.quantity; // consumption and sale deduct stock

          await updateInventoryItem(item.id, {
            current_stock: item.current_stock + stockChange
          });
        }
      }

      toast.success('Transaction added successfully');
      return { data, error: null };
    } catch (error) {
      console.error('Error adding transaction:', error);
      setError(error.message);
      toast.error(`Failed to add transaction: ${error.message}`);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  // Update an existing transaction
  const updateTransaction = async (id, transactionData) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('inventory_transactions')
        .update(transactionData)
        .eq('id', id)
        .select('*, item:item_id(name, sku)')
        .single();

      if (error) throw error;

      setTransactions(prev => prev.map(trans => trans.id === id ? data : trans));
      toast.success('Transaction updated successfully');
      return { data, error: null };
    } catch (error) {
      console.error('Error updating transaction:', error);
      setError(error.message);
      toast.error(`Failed to update transaction: ${error.message}`);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  // Delete a transaction
  const deleteTransaction = async (id) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('inventory_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTransactions(prev => prev.filter(trans => trans.id !== id));
      toast.success('Transaction deleted successfully');
      return { error: null };
    } catch (error) {
      console.error('Error deleting transaction:', error);
      setError(error.message);
      toast.error(`Failed to delete transaction: ${error.message}`);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  // Check for low stock items
  const checkLowStockItems = () => {
    const lowStock = inventoryItems.filter(item =>
      item.current_stock <= item.reorder_point
    );
    setLowStockItems(lowStock);
  };

  // Initialize data on mount
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        fetchInventoryItems(),
        fetchCategories(),
        fetchTransactions()
      ]);
    };

    initializeData();
  }, [user]);

  // Check for low stock whenever inventory items change
  useEffect(() => {
    checkLowStockItems();
  }, [inventoryItems]);

  const value = {
    // State
    inventoryItems,
    categories,
    suppliers,
    transactions,
    purchaseOrders,
    loading,
    error,
    lowStockItems,

    // Functions
    fetchInventoryItems,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    fetchCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    fetchTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    checkLowStockItems,

    // Department Stock Functions
    fetchDepartmentStock: async (departmentName) => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('department_stock')
          .select('*, item:item_id(*)')
          .eq('department_name', departmentName);

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching department stock:', error);
        toast.error('Failed to fetch department stock');
        return [];
      } finally {
        setLoading(false);
      }
    },

    transferStock: async (transferData) => {
      // transferData: { item_id, quantity, from_location, to_location, notes }
      try {
        setLoading(true);

        // 1. Create transaction record
        const { data: transaction, error: transError } = await supabase
          .from('inventory_transactions')
          .insert([{
            item_id: transferData.item_id,
            transaction_type: 'transfer_out', // Primary type
            quantity: transferData.quantity,
            transaction_date: new Date().toISOString(),
            notes: transferData.notes || `Transfer from ${transferData.from_location} to ${transferData.to_location}`,
            department_name: transferData.from_location,
            transfer_from: transferData.from_location,
            transfer_to: transferData.to_location
          }])
          .select()
          .single();

        if (transError) throw transError;

        // 2. Decrement Source Stock
        if (transferData.from_location === 'Main Store') {
          // Decrement from main inventory_items
          const item = inventoryItems.find(i => i.id === transferData.item_id);
          if (!item) throw new Error('Item not found');

          await updateInventoryItem(item.id, {
            current_stock: item.current_stock - transferData.quantity
          });
        } else {
          // Decrement from department_stock
          const { data: sourceStock, error: sourceError } = await supabase
            .from('department_stock')
            .select('*')
            .eq('item_id', transferData.item_id)
            .eq('department_name', transferData.from_location)
            .single();

          if (sourceError) throw new Error(`Source stock not found for ${transferData.from_location}`);

          if (sourceStock.current_stock < transferData.quantity) {
            throw new Error('Insufficient stock in source location');
          }

          await supabase
            .from('department_stock')
            .update({ current_stock: sourceStock.current_stock - transferData.quantity })
            .eq('id', sourceStock.id);
        }

        // 3. Increment Destination Stock
        if (transferData.to_location === 'Main Store') {
          // Increment main inventory_items
          const item = inventoryItems.find(i => i.id === transferData.item_id);
          await updateInventoryItem(item.id, {
            current_stock: item.current_stock + transferData.quantity
          });
        } else {
          // Increment department_stock (upsert)
          const { data: destStock, error: destError } = await supabase
            .from('department_stock')
            .select('*')
            .eq('item_id', transferData.item_id)
            .eq('department_name', transferData.to_location)
            .maybeSingle();

          if (destError) throw destError;

          if (destStock) {
            await supabase
              .from('department_stock')
              .update({ current_stock: destStock.current_stock + transferData.quantity })
              .eq('id', destStock.id);
          } else {
            await supabase
              .from('department_stock')
              .insert([{
                item_id: transferData.item_id,
                department_name: transferData.to_location,
                current_stock: transferData.quantity
              }]);
          }
        }

        toast.success('Stock transferred successfully');
        return { success: true };
      } catch (error) {
        console.error('Error transferring stock:', error);
        toast.error(`Transfer failed: ${error.message}`);
        return { success: false, error };
      } finally {
        setLoading(false);
      }
    },

    processStockUsage: async (usageData) => {
      // usageData: [{ inventory_item_id, quantity, department_name, reference }]
      try {
        setLoading(true);
        const errors = [];

        for (const usage of usageData) {
          try {
            // 1. Deduct from department stock
            const { data: deptStock, error: fetchError } = await supabase
              .from('department_stock')
              .select('*')
              .eq('item_id', usage.inventory_item_id)
              .eq('department_name', usage.department_name)
              .maybeSingle();

            if (fetchError) throw fetchError;

            if (!deptStock) {
              // If no stock record exists, we can't deduct. Log error or ignore?
              // For now, let's assume we allow negative stock or just create a record with negative stock?
              // Better to error if strict, but for smooth ops maybe just warn.
              // Let's create a record with negative stock if it doesn't exist (assuming we want to track usage anyway)
              await supabase
                .from('department_stock')
                .insert([{
                  item_id: usage.inventory_item_id,
                  department_name: usage.department_name,
                  current_stock: -usage.quantity
                }]);
            } else {
              await supabase
                .from('department_stock')
                .update({ current_stock: deptStock.current_stock - usage.quantity })
                .eq('id', deptStock.id);
            }

            // 2. Log transaction
            await supabase
              .from('inventory_transactions')
              .insert([{
                item_id: usage.inventory_item_id,
                transaction_type: 'sale',
                quantity: usage.quantity,
                transaction_date: new Date().toISOString(),
                notes: `Usage for ${usage.reference}`,
                department_name: usage.department_name
              }]);

          } catch (err) {
            console.error(`Error processing stock usage for item ${usage.inventory_item_id}:`, err);
            errors.push(err);
          }
        }

        if (errors.length > 0) {
          console.warn('Some stock updates failed', errors);
          // Don't throw, just warn, so the order still completes
        }

        return { success: true };
      } catch (error) {
        console.error('Error processing stock usage:', error);
        return { success: false, error };
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
};

export default InventoryContext;
