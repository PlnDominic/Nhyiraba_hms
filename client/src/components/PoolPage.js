import React, { useState, useEffect } from 'react';
import { FaSwimmingPool, FaMoneyBillWave, FaUsers, FaPlus, FaSearch, FaFilter, FaCalendarAlt, FaQrcode, FaPrint, FaTimes } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import PoolTransactionModal from './pool/PoolTransactionModal';
import { useTheme } from '../context/ThemeContext';
import supabase from '../supabaseClient';
import { toast } from 'react-hot-toast';
import QRCode from 'react-qr-code';

const PoolPage = () => {
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'week', 'month'
    const [stats, setStats] = useState({
        todayRevenue: 0,
        weekRevenue: 0,
        monthRevenue: 0,
        totalVisitors: 0,
        filteredRevenue: 0,
        filteredVisitors: 0
    });

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('pool_visits')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            setTransactions(data || []);
            calculateStats(data || []);
        } catch (error) {
            console.error('Error fetching pool transactions:', error);
            toast.error('Failed to load pool data');
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (data) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const todayData = data.filter(t => new Date(t.created_at) >= today);
        const weekData = data.filter(t => new Date(t.created_at) >= weekAgo);
        const monthData = data.filter(t => new Date(t.created_at) >= monthStart);

        const todayRev = todayData.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const weekRev = weekData.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const monthRev = monthData.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        setStats({
            todayRevenue: todayRev,
            weekRevenue: weekRev,
            monthRevenue: monthRev,
            totalVisitors: data.length,
            filteredRevenue: 0,
            filteredVisitors: 0
        });
    };

    // Filter transactions based on date filter
    useEffect(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let filtered = transactions;

        switch (dateFilter) {
            case 'today':
                filtered = transactions.filter(t => new Date(t.created_at) >= today);
                break;
            case 'week':
                filtered = transactions.filter(t => new Date(t.created_at) >= weekAgo);
                break;
            case 'month':
                filtered = transactions.filter(t => new Date(t.created_at) >= monthStart);
                break;
            default:
                filtered = transactions;
        }

        setFilteredTransactions(filtered);

        // Calculate filtered stats
        const filteredRev = filtered.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        setStats(prev => ({
            ...prev,
            filteredRevenue: filteredRev,
            filteredVisitors: filtered.length
        }));
    }, [transactions, dateFilter]);

    useEffect(() => {
        fetchTransactions();

        // Real-time subscription
        const subscription = supabase
            .channel('pool_visits_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_visits' }, () => {
                fetchTransactions();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleSaveTransaction = async (transactionData) => {
        try {
            const { error } = await supabase
                .from('pool_visits')
                .insert([transactionData]);

            if (error) throw error;

            toast.success('Payment recorded successfully');
            setIsModalOpen(false);
            fetchTransactions();
        } catch (error) {
            console.error('Error saving transaction:', error);
            toast.error('Failed to save transaction');
        }
    };

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent flex items-center gap-3">
                            <FaSwimmingPool className="text-cyan-500" />
                            Pool Management
                        </h1>
                        <p className={`mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Track pool usage and revenue
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsQRModalOpen(true)}
                            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-purple-500/25 transition-all duration-300 flex items-center gap-2 transform hover:scale-105"
                        >
                            <FaQrcode />
                            <span>Generate QR</span>
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-cyan-500/25 transition-all duration-300 flex items-center gap-2 transform hover:scale-105"
                        >
                            <FaPlus />
                            <span>New Entry</span>
                        </button>
                    </div>
                </div>

                {/* Date Filter Buttons */}
                <div className={`flex flex-wrap gap-3 p-4 rounded-2xl ${isDarkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-100'}`}>
                    <button
                        onClick={() => setDateFilter('all')}
                        className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                            dateFilter === 'all'
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                                : isDarkMode
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        All Time
                    </button>
                    <button
                        onClick={() => setDateFilter('today')}
                        className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                            dateFilter === 'today'
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25'
                                : isDarkMode
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setDateFilter('week')}
                        className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                            dateFilter === 'week'
                                ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                                : isDarkMode
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        This Week
                    </button>
                    <button
                        onClick={() => setDateFilter('month')}
                        className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                            dateFilter === 'month'
                                ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/25'
                                : isDarkMode
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        This Month
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Filtered Revenue Card */}
                    <div className={`p-6 rounded-2xl shadow-lg ${isDarkMode ? 'bg-gradient-to-br from-cyan-900/50 to-blue-900/50 border border-cyan-700' : 'bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200'}`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className={`text-sm font-medium ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>
                                    {dateFilter === 'all' ? 'Total Revenue' : dateFilter === 'today' ? "Today's Revenue" : dateFilter === 'week' ? 'Week Revenue' : 'Month Revenue'}
                                </p>
                                <h3 className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    GH₵{stats.filteredRevenue.toFixed(2)}
                                </h3>
                            </div>
                            <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-600'}`}>
                                <FaMoneyBillWave size={24} />
                            </div>
                        </div>
                    </div>

                    {/* Filtered Visitors Card */}
                    <div className={`p-6 rounded-2xl shadow-lg ${isDarkMode ? 'bg-gradient-to-br from-purple-900/50 to-pink-900/50 border border-purple-700' : 'bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200'}`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className={`text-sm font-medium ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                                    {dateFilter === 'all' ? 'Total Visitors' : dateFilter === 'today' ? "Today's Visitors" : dateFilter === 'week' ? 'Week Visitors' : 'Month Visitors'}
                                </p>
                                <h3 className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {stats.filteredVisitors}
                                </h3>
                            </div>
                            <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                                <FaUsers size={24} />
                            </div>
                        </div>
                    </div>

                    {/* Today's Revenue Card */}
                    <div className={`p-6 rounded-2xl shadow-lg ${isDarkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-100'}`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Today's Revenue</p>
                                <h3 className={`text-2xl font-bold mt-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    GH₵{stats.todayRevenue.toFixed(2)}
                                </h3>
                            </div>
                            <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'}`}>
                                <FaMoneyBillWave size={20} />
                            </div>
                        </div>
                    </div>

                    {/* Monthly Revenue Card */}
                    <div className={`p-6 rounded-2xl shadow-lg ${isDarkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-100'}`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Monthly Revenue</p>
                                <h3 className={`text-2xl font-bold mt-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    GH₵{stats.monthRevenue.toFixed(2)}
                                </h3>
                            </div>
                            <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                                <FaCalendarAlt size={20} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Transactions List */}
                <div className={`rounded-2xl shadow-lg overflow-hidden ${isDarkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-100'}`}>
                    <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                        <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Recent Transactions</h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className={isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}>
                                <tr>
                                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Date</th>
                                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Guest</th>
                                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Pass Type</th>
                                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Method</th>
                                    <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Amount</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto"></div>
                                        </td>
                                    </tr>
                                ) : filteredTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className={`px-6 py-8 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                            No transactions found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTransactions.map((t) => (
                                        <tr key={t.id} className={`transition-colors ${isDarkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}`}>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                {new Date(t.created_at).toLocaleDateString()} {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                                {t.guest_name}
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${isDarkMode ? 'bg-cyan-900/30 text-cyan-400' : 'bg-cyan-100 text-cyan-700'
                                                    }`}>
                                                    {t.pass_type}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                {t.payment_method}
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                                GH₵{parseFloat(t.amount).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <PoolTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveTransaction}
            />

            {/* QR Code Modal */}
            {isQRModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn" onClick={() => setIsQRModalOpen(false)}>
                    <div className="relative w-full max-w-sm animate-scaleIn" onClick={(e) => e.stopPropagation()}>
                        <div className={`relative ${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-3xl shadow-2xl overflow-hidden p-8 text-center`}>
                            <button
                                onClick={() => setIsQRModalOpen(false)}
                                className={`absolute top-4 right-4 p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                            >
                                <FaTimes />
                            </button>

                            <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Pool Self Check-in</h2>
                            <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Scan to enter details</p>

                            <div className="bg-white p-4 rounded-xl inline-block mb-6 shadow-inner">
                                <QRCode
                                    value={`${window.location.origin}/pool-checkin`}
                                    size={200}
                                    level="H"
                                />
                            </div>

                            <p className={`text-xs mb-6 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                {`${window.location.origin}/pool-checkin`}
                            </p>

                            <button
                                onClick={() => window.print()}
                                className="w-full py-3 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <FaPrint />
                                <span>Print QR Code</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default PoolPage;
