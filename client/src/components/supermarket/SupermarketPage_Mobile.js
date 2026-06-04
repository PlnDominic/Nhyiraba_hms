import React, { useState, useEffect, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useTheme } from '../../context/ThemeContext';
import DashboardLayout from '../DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import supabase from '../../supabaseClient';
import ReceiptModal from './ReceiptModal';
import {
    FaSearch,
    FaShoppingCart,
    FaTrash,
    FaPlus,
    FaMinus,
    FaMoneyBillWave,
    FaCreditCard,
    FaHotel,
    FaReceipt,
    FaTimes,
    FaBoxOpen,
    FaEdit,
    FaCheck,
    FaSave,
    FaBars
} from 'react-icons/fa';
import toast from 'react-hot-toast';

import SalesHistory from './SalesHistory';

const SupermarketPage = () => {
    const { fetchDepartmentStock, addTransaction, categories } = useInventory();
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

    const [activeTab, setActiveTab] = useState('pos'); // 'pos' or 'history'
    const [showCart, setShowCart] = useState(false); // Mobile cart toggle

    const [departmentItems, setDepartmentItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [cart, setCart] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash'); // cash, card, room

    // Receipt State
    const [showReceipt, setShowReceipt] = useState(false);
    const [lastSale, setLastSale] = useState(null);

    // Persistent Price Editing State
    const [editingItemId, setEditingItemId] = useState(null);
    const [editPriceValue, setEditPriceValue] = useState('');

    useEffect(() => {
        const loadStock = async () => {
            const stock = await fetchDepartmentStock('Supermarket');
            setDepartmentItems(stock);
        };
        loadStock();
    }, []);

    // Filter items that are for sale
    const sellableItems = useMemo(() => {
        return departmentItems.filter(stockItem => {
            const item = stockItem.item;
            return item &&
                item.is_for_sale &&
                stockItem.current_stock > 0 &&
                (categoryFilter === '' || item.category_id === categoryFilter) &&
                (searchTerm === '' ||
                    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
                );
        }).map(stockItem => ({
            ...stockItem.item,
            current_stock: stockItem.current_stock, // Override global stock with department stock
            department_stock_id: stockItem.id
        }));
    }, [departmentItems, categoryFilter, searchTerm]);

    const addToCart = (item) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(cartItem => cartItem.id === item.id);
            if (existingItem) {
                if (existingItem.quantity >= item.current_stock) {
                    toast.error(`Only ${item.current_stock} available in stock`);
                    return prevCart;
                }
                return prevCart.map(cartItem =>
                    cartItem.id === item.id
                        ? { ...cartItem, quantity: cartItem.quantity + 1 }
                        : cartItem
                );
            } else {
                return [...prevCart, { ...item, quantity: 1 }];
            }
        });
        // Auto-show cart on mobile when item added
        if (window.innerWidth < 1024) {
            setShowCart(true);
        }
    };

    const removeFromCart = (itemId) => {
        setCart(prevCart => prevCart.filter(item => item.id !== itemId));
    };

    const updateQuantity = (itemId, change) => {
        setCart(prevCart => {
            return prevCart.map(item => {
                if (item.id === itemId) {
                    const newQuantity = item.quantity + change;
                    if (newQuantity <= 0) return item; // Don't remove, just stay at 1 or use remove button

                    const stockItem = departmentItems.find(d => d.item.id === itemId);
                    const availableStock = stockItem ? stockItem.current_stock : 0;

                    if (newQuantity > availableStock) {
                        toast.error(`Only ${availableStock} available`);
                        return item;
                    }

                    return { ...item, quantity: newQuantity };
                }
                return item;
            });
        });
    };

    // Update price in cart (Temporary)
    const updateCartPrice = (itemId, newPrice) => {
        setCart(prevCart => {
            return prevCart.map(item => {
                if (item.id === itemId) {
                    return { ...item, selling_price: parseFloat(newPrice) || 0 };
                }
                return item;
            });
        });
    };

    // Persistent Price Editing Functions
    const startEditingPrice = (e, item) => {
        e.stopPropagation(); // Prevent adding to cart
        setEditingItemId(item.id);
        setEditPriceValue(item.selling_price || '');
    };

    const cancelEditPrice = (e) => {
        e.stopPropagation();
        setEditingItemId(null);
        setEditPriceValue('');
    };

    const savePrice = async (e, itemId) => {
        e.stopPropagation();
        try {
            const newPrice = parseFloat(editPriceValue);
            if (isNaN(newPrice) || newPrice < 0) {
                toast.error('Invalid price');
                return;
            }

            const { error } = await supabase
                .from('inventory_items')
                .update({ selling_price: newPrice })
                .eq('id', itemId);

            if (error) throw error;

            toast.success('Price updated');
            setEditingItemId(null);

            // Refresh stock to get new prices
            const stock = await fetchDepartmentStock('Supermarket');
            setDepartmentItems(stock);

            // Also update any items currently in cart
            setCart(prevCart => prevCart.map(item =>
                item.id === itemId ? { ...item, selling_price: newPrice } : item
            ));

        } catch (error) {
            console.error('Error updating price:', error);
            toast.error('Failed to update price');
        }
    };

    const cartTotal = useMemo(() => {
        return cart.reduce((total, item) => total + (item.selling_price * item.quantity), 0);
    }, [cart]);

    const handleCheckout = async () => {
        if (cart.length === 0) return;

        setIsProcessing(true);
        try {
            const totalAmount = cartTotal;
            const receiptNumber = `RCP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
            const user = (await supabase.auth.getUser()).data.user;

            // 1. Create Sale Record
            const { data: saleData, error: saleError } = await supabase
                .from('supermarket_sales')
                .insert([{
                    receipt_number: receiptNumber,
                    total_amount: totalAmount,
                    payment_method: paymentMethod,
                    created_by: user?.id
                }])
                .select()
                .single();

            if (saleError) throw saleError;

            // 2. Create Sale Items
            const saleItems = cart.map(item => ({
                sale_id: saleData.id,
                item_id: item.id,
                item_name: item.name,
                quantity: item.quantity,
                unit_price: item.selling_price,
                total_price: item.selling_price * item.quantity
            }));

            const { error: itemsError } = await supabase
                .from('supermarket_sale_items')
                .insert(saleItems);

            if (itemsError) throw itemsError;

            // 3. Update Inventory (Deduct Stock)
            const promises = cart.map(item =>
                addTransaction({
                    item_id: item.id,
                    transaction_type: 'sale',
                    quantity: item.quantity,
                    unit_price: item.selling_price,
                    total_price: item.selling_price * item.quantity,
                    transaction_date: new Date().toISOString(),
                    notes: `POS Sale - ${receiptNumber} - ${paymentMethod}`,
                    department_name: 'Supermarket',
                    reference_number: receiptNumber,
                    transfer_from: 'Supermarket'
                })
            );

            await Promise.all(promises);

            toast.success('Sale completed successfully!');

            // Prepare receipt data
            setLastSale({
                ...saleData,
                items: saleItems,
                created_at: new Date().toISOString()
            });
            setShowReceipt(true);

            setCart([]);
            setShowCart(false); // Close mobile cart
            // Refresh stock
            const stock = await fetchDepartmentStock('Supermarket');
            setDepartmentItems(stock);
        } catch (error) {
            console.error('Checkout error:', error);
            toast.error('Failed to process sale: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <DashboardLayout activeLink="Supermarket" title="Supermarket POS">
            {/* Tab Navigation - Mobile Optimized */}
            <div className="flex gap-2 sm:gap-4 px-3 sm:px-4 mb-2 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('pos')}
                    className={`py-2 px-3 sm:px-4 font-medium text-sm sm:text-base border-b-2 transition-colors ${activeTab === 'pos'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                >
                    <span className="hidden sm:inline">Point of Sale</span>
                    <span className="sm:hidden">POS</span>
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`py-2 px-3 sm:px-4 font-medium text-sm sm:text-base border-b-2 transition-colors ${activeTab === 'history'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                >
                    <span className="hidden sm:inline">Sales History</span>
                    <span className="sm:hidden">History</span>
                </button>
            </div>

            {activeTab === 'pos' ? (
                <div className="flex flex-col lg:flex-row min-h-[calc(100vh-200px)] lg:h-[calc(100vh-150px)] gap-3 sm:gap-4 p-3 sm:p-4 pt-2">
                    {/* Left Side: Product Grid */}
                    <div className="flex-1 flex flex-col gap-3 sm:gap-4">
                        {/* Search and Filter - Mobile Optimized */}
                        <div className={`p-3 sm:p-4 rounded-xl shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                <div className="flex-1 relative">
                                    <FaSearch className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                                    <input
                                        type="text"
                                        placeholder="Search products..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className={`w-full pl-10 pr-4 py-2 text-sm sm:text-base rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode
                                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                            : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                                            }`}
                                    />
                                </div>
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className={`px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode
                                        ? 'bg-gray-700 border-gray-600 text-white'
                                        : 'bg-gray-50 border-gray-300 text-gray-900'
                                        }`}
                                >
                                    <option value="">All Categories</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Products Grid - Mobile Optimized */}
                        <div className="flex-1 overflow-y-auto">
                            {sellableItems.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                                    {sellableItems.map(item => (
                                        <motion.div
                                            key={item.id}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => addToCart(item)}
                                            className={`cursor-pointer p-3 sm:p-4 rounded-xl shadow-sm border transition-colors ${isDarkMode
                                                ? 'bg-gray-800 border-gray-700 hover:border-blue-500'
                                                : 'bg-white border-gray-200 hover:border-blue-500'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                                                    <FaBoxOpen className="text-sm sm:text-base" />
                                                </div>
                                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${item.current_stock <= item.reorder_point
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                                    : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                    }`}>
                                                    {item.current_stock}
                                                </span>
                                            </div>
                                            <h3 className={`font-medium text-sm sm:text-base truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{item.name}</h3>
                                            <p className={`text-xs sm:text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{item.sku}</p>

                                            <div className="flex justify-between items-center mt-2">
                                                {editingItemId === item.id ? (
                                                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="number"
                                                            value={editPriceValue}
                                                            onChange={(e) => setEditPriceValue(e.target.value)}
                                                            className={`w-16 sm:w-20 px-1 py-1 text-xs sm:text-sm rounded border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                                            autoFocus
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                        <button
                                                            onClick={(e) => savePrice(e, item.id)}
                                                            className="p-1 text-green-500 hover:bg-green-100 rounded"
                                                            title="Save Price"
                                                        >
                                                            <FaCheck size={10} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => cancelEditPrice(e)}
                                                            className="p-1 text-red-500 hover:bg-red-100 rounded"
                                                            title="Cancel"
                                                        >
                                                            <FaTimes size={10} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 sm:gap-2">
                                                        <span className={`text-base sm:text-lg font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                                            ₵{item.selling_price?.toFixed(2)}
                                                        </span>
                                                        <button
                                                            onClick={(e) => startEditingPrice(e, item)}
                                                            className={`p-1 sm:p-1.5 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                                                            title="Edit Price"
                                                        >
                                                            <FaEdit size={10} />
                                                        </button>
                                                    </div>
                                                )}

                                                <button className={`p-1.5 sm:p-2 rounded-full ${isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                                                    }`}>
                                                    <FaPlus size={10} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className={`flex flex-col items-center justify-center h-full py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    <FaSearch size={48} className="mb-4 opacity-50" />
                                    <p className="text-base sm:text-lg">No products found</p>
                                    <p className="text-xs sm:text-sm text-center px-4">Try adjusting your search or add items with "Available for Sale" enabled.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mobile Cart Toggle Button */}
                    <button
                        onClick={() => setShowCart(!showCart)}
                        className={`lg:hidden fixed bottom-4 right-4 z-40 p-4 rounded-full shadow-lg ${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'} text-white`}
                    >
                        <div className="relative">
                            <FaShoppingCart size={24} />
                            {cart.length > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                    {cart.length}
                                </span>
                            )}
                        </div>
                    </button>

                    {/* Right Side: Cart - Mobile Optimized */}
                    <div className={`${showCart ? 'fixed inset-0 z-50 lg:relative lg:inset-auto' : 'hidden lg:flex'} lg:w-96 flex flex-col rounded-none lg:rounded-xl shadow-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                        }`}>
                        {/* Mobile Cart Header */}
                        <div className={`lg:hidden flex justify-between items-center p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                Cart
                            </h2>
                            <button
                                onClick={() => setShowCart(false)}
                                className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                            >
                                <FaTimes size={20} />
                            </button>
                        </div>

                        {/* Desktop Cart Header */}
                        <div className={`hidden lg:block p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <h2 className={`text-xl font-bold flex items-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                <FaShoppingCart className="mr-2" /> Current Order
                            </h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
                            {cart.length > 0 ? (
                                cart.map(item => (
                                    <div key={item.id} className={`flex justify-between items-center p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                                        }`}>
                                        <div className="flex-1 min-w-0">
                                            <h4 className={`font-medium text-sm sm:text-base truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{item.name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>₵</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.selling_price}
                                                    onChange={(e) => updateCartPrice(item.id, e.target.value)}
                                                    className={`w-16 sm:w-20 px-2 py-1 text-xs sm:text-sm rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDarkMode
                                                        ? 'bg-gray-600 border-gray-500 text-white'
                                                        : 'bg-white border-gray-300 text-gray-900'}`}
                                                />
                                                <span className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    x {item.quantity}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-3 ml-2">
                                            <div className="flex items-center gap-1 sm:gap-2">
                                                <button
                                                    onClick={() => updateQuantity(item.id, -1)}
                                                    className={`p-1.5 sm:p-2 rounded ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                                                    disabled={item.quantity <= 1}
                                                >
                                                    <FaMinus size={10} />
                                                </button>
                                                <span className={`w-6 text-center font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    onClick={() => updateQuantity(item.id, 1)}
                                                    className={`p-1.5 sm:p-2 rounded ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                                                >
                                                    <FaPlus size={10} />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.id)}
                                                className="text-red-500 hover:text-red-600 p-1.5 sm:p-2"
                                            >
                                                <FaTrash size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className={`flex flex-col items-center justify-center h-full py-12 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                    <FaShoppingCart size={48} className="mb-4 opacity-50" />
                                    <p>Cart is empty</p>
                                </div>
                            )}
                        </div>

                        <div className={`p-3 sm:p-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <div className="flex justify-between items-center mb-3 sm:mb-4">
                                <span className={`text-base sm:text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Total</span>
                                <span className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    ₵{cartTotal.toFixed(2)}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-3 sm:mb-4">
                                <button
                                    onClick={() => setPaymentMethod('cash')}
                                    className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-lg border transition-colors ${paymentMethod === 'cash'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : isDarkMode ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <FaMoneyBillWave className="mb-1 text-sm sm:text-base" />
                                    <span className="text-xs">Cash</span>
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('card')}
                                    className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-lg border transition-colors ${paymentMethod === 'card'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : isDarkMode ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <FaCreditCard className="mb-1 text-sm sm:text-base" />
                                    <span className="text-xs">Card</span>
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('room')}
                                    className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-lg border transition-colors ${paymentMethod === 'room'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : isDarkMode ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <FaHotel className="mb-1 text-sm sm:text-base" />
                                    <span className="text-xs">Room</span>
                                </button>
                            </div>

                            <button
                                onClick={handleCheckout}
                                disabled={cart.length === 0 || isProcessing}
                                className={`w-full py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center shadow-lg transition-transform active:scale-95 ${cart.length === 0 || isProcessing
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                    }`}
                            >
                                {isProcessing ? (
                                    <span className="animate-spin mr-2">⚪</span>
                                ) : (
                                    <FaReceipt className="mr-2" />
                                )}
                                {isProcessing ? 'Processing...' : 'Complete Sale'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-3 sm:p-4 min-h-[calc(100vh-200px)] lg:h-[calc(100vh-150px)]">
                    <SalesHistory />
                </div>
            )}

            <ReceiptModal
                isOpen={showReceipt}
                onClose={() => setShowReceipt(false)}
                saleData={lastSale}
            />
        </DashboardLayout>
    );
};

export default SupermarketPage;
