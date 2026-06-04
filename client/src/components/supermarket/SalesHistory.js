import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import supabase from '../../supabaseClient';
import { FaSearch, FaEye, FaPrint, FaCalendarAlt } from 'react-icons/fa';
import ReceiptModal from './ReceiptModal';

const SalesHistory = () => {
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSale, setSelectedSale] = useState(null);
    const [showReceipt, setShowReceipt] = useState(false);
    const [dateFilter, setDateFilter] = useState('');

    useEffect(() => {
        fetchSales();
    }, [dateFilter]);

    const fetchSales = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('supermarket_sales')
                .select(`
                    *,
                    items:supermarket_sale_items(*)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (dateFilter) {
                const date = new Date(dateFilter);
                const startOfDay = new Date(date.setHours(0, 0, 0, 0)).toISOString();
                const endOfDay = new Date(date.setHours(23, 59, 59, 999)).toISOString();
                query = query.gte('created_at', startOfDay).lte('created_at', endOfDay);
            }

            const { data, error } = await query;

            if (error) throw error;
            setSales(data || []);
        } catch (error) {
            console.error('Error fetching sales:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewReceipt = (sale) => {
        setSelectedSale(sale);
        setShowReceipt(true);
    };

    const filteredSales = sales.filter(sale =>
        sale.receipt_number.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className={`h-full flex flex-col ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            {/* Header / Filter Bar */}
            <div className={`p-4 rounded-xl shadow-sm mb-4 flex flex-wrap gap-4 items-center justify-between ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h2 className="text-xl font-bold">Sales History</h2>

                <div className="flex gap-4">
                    <div className="relative">
                        <FaSearch className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            placeholder="Search Receipt #"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode
                                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                                }`}
                        />
                    </div>

                    <div className="relative">
                        <FaCalendarAlt className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className={`pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-gray-50 border-gray-300 text-gray-900'
                                }`}
                        />
                    </div>
                </div>
            </div>

            {/* Sales Table */}
            <div className={`flex-1 overflow-hidden rounded-xl shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="overflow-y-auto h-full">
                    <table className="w-full text-left border-collapse">
                        <thead className={`sticky top-0 z-10 ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-50 text-gray-600'}`}>
                            <tr>
                                <th className="p-4 font-semibold">Date & Time</th>
                                <th className="p-4 font-semibold">Receipt #</th>
                                <th className="p-4 font-semibold">Items</th>
                                <th className="p-4 font-semibold">Payment</th>
                                <th className="p-4 font-semibold text-right">Total</th>
                                <th className="p-4 font-semibold text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">Loading sales...</td>
                                </tr>
                            ) : filteredSales.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">No sales found</td>
                                </tr>
                            ) : (
                                filteredSales.map((sale) => (
                                    <tr key={sale.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors`}>
                                        <td className="p-4">
                                            <div className="font-medium">{new Date(sale.created_at).toLocaleDateString()}</div>
                                            <div className="text-xs text-gray-500">{new Date(sale.created_at).toLocaleTimeString()}</div>
                                        </td>
                                        <td className="p-4 font-mono text-sm">{sale.receipt_number}</td>
                                        <td className="p-4">
                                            <span className="text-sm text-gray-600 dark:text-gray-300">
                                                {sale.items?.length || 0} items
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${sale.payment_method === 'cash' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                                    sale.payment_method === 'card' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                                }`}>
                                                {sale.payment_method}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-bold">
                                            ₵{parseFloat(sale.total_amount).toFixed(2)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => handleViewReceipt(sale)}
                                                className={`p-2 rounded-lg transition-colors ${isDarkMode
                                                    ? 'bg-gray-700 hover:bg-gray-600 text-blue-400'
                                                    : 'bg-gray-100 hover:bg-gray-200 text-blue-600'}`}
                                                title="View Receipt"
                                            >
                                                <FaEye />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ReceiptModal
                isOpen={showReceipt}
                onClose={() => setShowReceipt(false)}
                saleData={selectedSale}
            />
        </div>
    );
};

export default SalesHistory;
