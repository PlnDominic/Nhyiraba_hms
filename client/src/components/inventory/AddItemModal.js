import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useTheme } from '../../context/ThemeContext';
import { FaTimes, FaPlus, FaPencilAlt } from 'react-icons/fa';

const AddItemModal = ({ isOpen, onClose, itemToEdit = null }) => {
  const { categories, addInventoryItem, updateInventoryItem } = useInventory();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  const initialFormState = {
    name: '',
    description: '',
    sku: '',
    unit_of_measure: '',
    minimum_stock: 0,
    reorder_point: 0,
    current_stock: 0,
    unit_cost: 0,
    selling_price: 0,
    is_for_sale: false,
    location: ''
  };

  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Generate SKU based on name
  const generateSku = (name) => {
    // Clean the name and get first 3 chars
    const nameClean = name.replace(/[^a-zA-Z0-9]/g, '');
    const namePrefix = nameClean.substring(0, 3).toUpperCase();

    // Generate random 4-digit number
    const randomNum = Math.floor(Math.random() * 9000) + 1000;

    return `${namePrefix}-${randomNum}`;
  };

  // Reset form when modal opens or itemToEdit changes
  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
        setFormData({
          name: itemToEdit.name || '',
          description: itemToEdit.description || '',
          sku: itemToEdit.sku || '',
          unit_of_measure: itemToEdit.unit_of_measure || '',
          minimum_stock: itemToEdit.minimum_stock || 0,
          reorder_point: itemToEdit.reorder_point || 0,
          current_stock: itemToEdit.current_stock || 0,
          unit_cost: itemToEdit.unit_cost || 0,
          selling_price: itemToEdit.selling_price || 0,
          is_for_sale: itemToEdit.is_for_sale || false,
          location: itemToEdit.location || ''
        });
      } else {
        setFormData(initialFormState);
      }
      setErrors({});
    }
  }, [isOpen, itemToEdit]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Convert numeric fields to numbers
    const numericFields = ['minimum_stock', 'reorder_point', 'current_stock', 'unit_cost', 'selling_price'];
    const processedValue = numericFields.includes(name) ? parseFloat(value) || 0 :
      name === 'is_for_sale' ? e.target.checked : value;

    const newFormData = {
      ...formData,
      [name]: processedValue
    };

    // Auto-generate SKU when name changes
    if (name === 'name' && !itemToEdit) {
      if (newFormData.name) {
        newFormData.sku = generateSku(newFormData.name);
      }
    }

    setFormData(newFormData);

    // Clear error for this field if it exists
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Item name is required';
    }

    if (!formData.unit_of_measure.trim()) {
      newErrors.unit_of_measure = 'Unit of measure is required';
    }

    if (formData.minimum_stock < 0) {
      newErrors.minimum_stock = 'Minimum stock cannot be negative';
    }

    if (formData.reorder_point < 0) {
      newErrors.reorder_point = 'Reorder point cannot be negative';
    }

    if (formData.current_stock < 0) {
      newErrors.current_stock = 'Current stock cannot be negative';
    }

    if (formData.unit_cost < 0) {
      newErrors.unit_cost = 'Unit cost cannot be negative';
    }

    if (formData.is_for_sale && formData.selling_price < 0) {
      newErrors.selling_price = 'Selling price cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      if (itemToEdit) {
        await updateInventoryItem(itemToEdit.id, formData);
      } else {
        await addInventoryItem(formData);
      }

      onClose();
      setFormData(initialFormState);
    } catch (error) {
      console.error('Error with inventory item:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className={`relative w-full max-w-4xl ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">
            {itemToEdit ? (
              <span className="flex items-center">
                <FaPencilAlt className="mr-2" /> Edit Inventory Item
              </span>
            ) : (
              <span className="flex items-center">
                <FaPlus className="mr-2" /> Add New Inventory Item
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
          >
            <FaTimes className={`${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Item Name */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                Item Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-500' : isDarkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                  }`}
                placeholder="Enter item name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div className="col-span-2">
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="2"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                  }`}
                placeholder="Enter item description"
              />
            </div>

            {/* SKU */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                SKU {itemToEdit ? '' : '(Auto-generated)'}
              </label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                  } ${!itemToEdit ? 'opacity-75' : ''}`}
                placeholder="Auto-generated SKU"
                readOnly={!itemToEdit}
              />
            </div>

            {/* Unit of Measure */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                Unit of Measure *
              </label>
              <input
                type="text"
                name="unit_of_measure"
                value={formData.unit_of_measure}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.unit_of_measure ? 'border-red-500' : isDarkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                  }`}
                placeholder="e.g., piece, box, kg, liter"
              />
              {errors.unit_of_measure && (
                <p className="mt-1 text-sm text-red-600">{errors.unit_of_measure}</p>
              )}
            </div>

            {/* Current Stock */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                Current Stock
              </label>
              <input
                type="number"
                name="current_stock"
                value={formData.current_stock}
                onChange={handleChange}
                min="0"
                step="1"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.current_stock ? 'border-red-500' : isDarkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                  }`}
                placeholder="0"
              />
              {errors.current_stock && (
                <p className="mt-1 text-sm text-red-600">{errors.current_stock}</p>
              )}
            </div>

            {/* Minimum Stock */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                Minimum Stock
              </label>
              <input
                type="number"
                name="minimum_stock"
                value={formData.minimum_stock}
                onChange={handleChange}
                min="0"
                step="1"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.minimum_stock ? 'border-red-500' : isDarkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                  }`}
                placeholder="0"
              />
              {errors.minimum_stock && (
                <p className="mt-1 text-sm text-red-600">{errors.minimum_stock}</p>
              )}
            </div>

            {/* Reorder Point */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                Reorder Point
              </label>
              <input
                type="number"
                name="reorder_point"
                value={formData.reorder_point}
                onChange={handleChange}
                min="0"
                step="1"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.reorder_point ? 'border-red-500' : isDarkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                  }`}
                placeholder="0"
              />
              {errors.reorder_point && (
                <p className="mt-1 text-sm text-red-600">{errors.reorder_point}</p>
              )}
            </div>

            {/* Unit Cost */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                Unit Cost (₵)
              </label>
              <div className="flex">
                <div className={`px-3 py-2 border rounded-l-md ${isDarkMode ? 'border-gray-600 bg-gray-600 text-gray-300' : 'border-gray-300 bg-gray-100 text-gray-700'
                  }`}>
                  ₵
                </div>
                <input
                  type="number"
                  name="unit_cost"
                  value={formData.unit_cost}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className={`w-full px-3 py-2 border rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.unit_cost ? 'border-red-500' : isDarkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                    }`}
                  placeholder="0.00"
                />
              </div>
              {errors.unit_cost && (
                <p className="mt-1 text-sm text-red-600">{errors.unit_cost}</p>
              )}
            </div>

            {/* Storage Location */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                Storage Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                  }`}
                placeholder="e.g., Main Storage, Kitchen Storage"
              />
            </div>

            {/* Selling Price & For Sale Toggle */}
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
              <div className="flex items-center h-full">
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      name="is_for_sale"
                      checked={formData.is_for_sale}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className={`block w-14 h-8 rounded-full ${formData.is_for_sale ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${formData.is_for_sale ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                  <div className={`ml-3 font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Available for Sale (POS)
                  </div>
                </label>
              </div>

              {formData.is_for_sale && (
                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                    Selling Price (₵)
                  </label>
                  <div className="flex">
                    <div className={`px-3 py-2 border rounded-l-md ${isDarkMode ? 'border-gray-600 bg-gray-600 text-gray-300' : 'border-gray-300 bg-gray-100 text-gray-700'
                      }`}>
                      ₵
                    </div>
                    <input
                      type="number"
                      name="selling_price"
                      value={formData.selling_price}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className={`w-full px-3 py-2 border rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.selling_price ? 'border-red-500' : isDarkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                        }`}
                      placeholder="0.00"
                    />
                  </div>
                  {errors.selling_price && (
                    <p className="mt-1 text-sm text-red-600">{errors.selling_price}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-8">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-md font-medium ${isDarkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                }`}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 rounded-md font-medium bg-blue-600 hover:bg-blue-700 text-white`}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                <span>{itemToEdit ? 'Update Item' : 'Add Item'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddItemModal;
