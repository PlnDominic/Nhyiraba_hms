import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useTheme } from '../../context/ThemeContext';
import { FaExchangeAlt, FaTimes } from 'react-icons/fa';
import toast from 'react-hot-toast';

const TransferStockModal = ({ isOpen, onClose, preselectedItem = null }) => {
    const { inventoryItems, transferStock } = useInventory();
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

    const [formData, setFormData] = useState({
        item_id: '',
        from_location: 'Main Store',
        to_location: '',
        quantity: 1,
        notes: ''
    });

    const [loading, setLoading] = useState(false);

    // Locations list - could be dynamic in future
    const locations = [
        'Main Store',
        'Supermarket',
        'Housekeeping',
        'VIP pub',
        'Entrance Pub / Reception',
        'Poolside Pub',
        'Pizza Palace'
    ];

    useEffect(() => {
        if (isOpen) {
            if (preselectedItem) {
                setFormData(prev => ({ ...prev, item_id: preselectedItem.id }));
            }
            // Reset other fields if needed, or keep defaults
        }
    }, [isOpen, preselectedItem]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'quantity' ? parseFloat(value) : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.item_id) {
            toast.error('Please select an item');
            return;
        }
        if (!formData.to_location) {
            toast.error('Please select a destination');
            return;
        }
        if (formData.from_location === formData.to_location) {
            toast.error('Source and destination cannot be the same');
            return;
        }
        if (formData.quantity <= 0) {
            toast.error('Quantity must be greater than 0');
            return;
        }

        // Check stock availability (simple check for Main Store)
        if (formData.from_location === 'Main Store') {
            const item = inventoryItems.find(i => i.id === formData.item_id);
            if (item && item.current_stock < formData.quantity) {
                toast.error(`Insufficient stock in Main Store. Available: ${item.current_stock}`);
                return;
            }
        }

        setLoading(true);
        try {
            const result = await transferStock(formData);
            if (result.success) {
                onClose();
                setFormData({
                    item_id: '',
                    from_location: 'Main Store',
                    to_location: '',
                    quantity: 1,
                    notes: ''
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className={`relative w-full max-w-md ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} rounded-lg shadow-lg p-6`}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center">
                        <FaExchangeAlt className="mr-2" /> Transfer Stock
                    </h2>
                    <button
                        onClick={onClose}
                        className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                    >
                        <FaTimes />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Item Selection */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Item
                        </label>
                        <select
                            name="item_id"
                            value={formData.item_id}
                            onChange={handleChange}
                            disabled={!!preselectedItem}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                }`}
                        >
                            <option value="">Select Item</option>
                            {inventoryItems.map(item => (
                                <option key={item.id} value={item.id}>
                                    {item.name} (Main Store: {item.current_stock})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* From Location */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            From Location
                        </label>
                        <select
                            name="from_location"
                            value={formData.from_location}
                            onChange={handleChange}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                }`}
                        >
                            {locations.map(loc => (
                                <option key={`from-${loc}`} value={loc}>{loc}</option>
                            ))}
                        </select>
                    </div>

                    {/* To Location */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            To Location
                        </label>
                        <select
                            name="to_location"
                            value={formData.to_location}
                            onChange={handleChange}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                }`}
                        >
                            <option value="">Select Destination</option>
                            {locations.filter(l => l !== formData.from_location).map(loc => (
                                <option key={`to-${loc}`} value={loc}>{loc}</option>
                            ))}
                        </select>
                    </div>

                    {/* Quantity */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Quantity
                        </label>
                        <input
                            type="number"
                            name="quantity"
                            value={formData.quantity}
                            onChange={handleChange}
                            min="1"
                            step="1"
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                }`}
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Notes (Optional)
                        </label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            rows="2"
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                }`}
                            placeholder="Reason for transfer..."
                        />
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className={`px-4 py-2 rounded-md font-medium ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                                }`}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-md font-medium bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={loading}
                        >
                            {loading ? 'Transferring...' : 'Confirm Transfer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TransferStockModal;
