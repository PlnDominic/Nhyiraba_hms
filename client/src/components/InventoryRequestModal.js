import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useInventory } from '../context/InventoryContext';
import { useUser } from '../context/UserContext';
import { FaTimes, FaPlus, FaMinus } from 'react-icons/fa';
import supabase from '../supabaseClient';
import toast from 'react-hot-toast';

const InventoryRequestModal = ({ isOpen, onClose, onRequestSubmitted }) => {
  const { theme } = useTheme();
  const { inventoryItems } = useInventory();
  const { user } = useUser();
  const isDarkMode = theme === 'dark';

  const [selectedItems, setSelectedItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedItems([]);
      setSearchTerm('');
      setNotes('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredItems = inventoryItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addItemToRequest = (item) => {
    const existingItem = selectedItems.find(i => i.id === item.id);
    if (existingItem) {
      setSelectedItems(selectedItems.map(i =>
        i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setSelectedItems([...selectedItems, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (itemId, change) => {
    setSelectedItems(selectedItems.map(item => {
      if (item.id === itemId) {
        const newQuantity = item.quantity + change;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeItem = (itemId) => {
    setSelectedItems(selectedItems.filter(item => item.id !== itemId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedItems.length === 0) {
      toast.error('Please select at least one item');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the inventory request
      const { data: requestData, error: requestError } = await supabase
        .from('inventory_requests')
        .insert([{
          requested_by: user?.id,
          requester_name: user?.fullName || user?.username,
          department: user?.department || 'Housekeeping',
          status: 'pending',
          notes: notes,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (requestError) throw requestError;

      // Create request items
      const requestItems = selectedItems.map(item => ({
        request_id: requestData.id,
        item_id: item.id,
        item_name: item.name,
        quantity_requested: item.quantity,
        unit_of_measure: item.unit_of_measure
      }));

      const { error: itemsError } = await supabase
        .from('inventory_request_items')
        .insert(requestItems);

      if (itemsError) throw itemsError;

      toast.success('Inventory request submitted successfully!');
      onRequestSubmitted && onRequestSubmitted();
      onClose();
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit request: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-4xl rounded-xl shadow-lg overflow-hidden ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
        }`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Request Inventory Items</h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Available Items */}
              <div>
                <h3 className="font-semibold mb-3">Available Items</h3>
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg mb-3 ${isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-800'
                    } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <div className={`border rounded-lg p-3 max-h-96 overflow-y-auto ${isDarkMode ? 'border-gray-700' : 'border-gray-200'
                  }`}>
                  {filteredItems.length > 0 ? (
                    <div className="space-y-2">
                      {filteredItems.map(item => (
                        <div
                          key={item.id}
                          onClick={() => addItemToRequest(item)}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${isDarkMode
                            ? 'hover:bg-gray-700 bg-gray-800'
                            : 'hover:bg-gray-50 bg-white'
                            } border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                SKU: {item.sku}
                              </p>
                            </div>
                            <button
                              type="button"
                              className={`p-2 rounded-full ${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'} text-white`}
                            >
                              <FaPlus size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-center py-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      No items found
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column - Selected Items */}
              <div>
                <h3 className="font-semibold mb-3">Requested Items ({selectedItems.length})</h3>
                <div className={`border rounded-lg p-3 max-h-96 overflow-y-auto ${isDarkMode ? 'border-gray-700' : 'border-gray-200'
                  }`}>
                  {selectedItems.length > 0 ? (
                    <div className="space-y-2">
                      {selectedItems.map(item => (
                        <div
                          key={item.id}
                          className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <p className="font-medium">{item.name}</p>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <FaTimes />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, -1)}
                                className={`p-1 rounded ${isDarkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'
                                  }`}
                              >
                                <FaMinus size={10} />
                              </button>
                              <span className="font-medium w-12 text-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, 1)}
                                className={`p-1 rounded ${isDarkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'
                                  }`}
                              >
                                <FaPlus size={10} />
                              </button>
                            </div>
                            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {item.unit_of_measure}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-center py-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      No items selected
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div className="mt-4">
                  <label className="block mb-2 font-medium">Notes (Optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows="3"
                    placeholder="Add any additional notes..."
                    className={`w-full px-3 py-2 rounded-lg ${isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-800'
                      } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-lg ${isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                  }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || selectedItems.length === 0}
                className={`px-4 py-2 rounded-lg ${isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryRequestModal;
