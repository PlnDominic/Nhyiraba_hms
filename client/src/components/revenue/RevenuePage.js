import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../DashboardLayout';
import { useTheme } from '../../context/ThemeContext';
import supabase from '../../supabaseClient';
import * as echarts from 'echarts';
import { FaMoneyBillWave, FaChartLine, FaShoppingCart, FaUtensils, FaBed, FaCalendarAlt, FaSearch, FaFilter, FaDownload, FaSwimmingPool, FaGlassMartiniAlt } from 'react-icons/fa';
import toast from 'react-hot-toast';

const RevenuePage = () => {
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('month'); // 'today', 'week', 'month', 'year', 'all'
    const [customDateStart, setCustomDateStart] = useState('');
    const [customDateEnd, setCustomDateEnd] = useState('');
    const [transactions, setTransactions] = useState([]);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        roomRevenue: 0,
        restaurantRevenue: 0,
        supermarketRevenue: 0,
        poolRevenue: 0,
        barBreakdown: {}
    });

    const chartRef = useRef(null);
    const pieChartRef = useRef(null);
    const chartInstance = useRef(null);
    const pieChartInstance = useRef(null);

    useEffect(() => {
        fetchRevenueData();
    }, [dateRange, customDateStart, customDateEnd]);

    useEffect(() => {
        if (!loading && transactions.length > 0) {
            initCharts();
        }

        const handleResize = () => {
            chartInstance.current?.resize();
            pieChartInstance.current?.resize();
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            chartInstance.current?.dispose();
            pieChartInstance.current?.dispose();
        };
    }, [loading, transactions, theme]);

    const fetchRevenueData = async () => {
        setLoading(true);
        try {
            let startDate = new Date();
            let endDate = new Date();

            // Set date range
            if (dateRange === 'today') {
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(23, 59, 59, 999);
            } else if (dateRange === 'week') {
                const day = startDate.getDay();
                const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
                startDate.setDate(diff);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(23, 59, 59, 999);
            } else if (dateRange === 'month') {
                startDate.setDate(1);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(23, 59, 59, 999);
            } else if (dateRange === 'year') {
                startDate.setMonth(0, 1);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(23, 59, 59, 999);
            } else if (dateRange === 'custom') {
                if (customDateStart) startDate = new Date(customDateStart);
                if (customDateEnd) endDate = new Date(customDateEnd);
            } else {
                // All time
                startDate = new Date(0);
            }

            const startIso = startDate.toISOString();
            const endIso = endDate.toISOString();

            // 1. Fetch Room Revenue (Invoices)
            let invoicesQuery = supabase
                .from('invoices')
                .select('*')
                .eq('status', 'Paid');

            if (dateRange !== 'all') {
                invoicesQuery = invoicesQuery.gte('created_at', startIso).lte('created_at', endIso);
            }

            const { data: invoices, error: invoicesError } = await invoicesQuery;
            if (invoicesError) throw invoicesError;

            // 2. Fetch Restaurant Revenue
            let restaurantQuery = supabase
                .from('restaurant_orders')
                .select('*')
                .in('status', ['completed', 'delivered', 'paid']);

            if (dateRange !== 'all') {
                restaurantQuery = restaurantQuery.gte('created_at', startIso).lte('created_at', endIso);
            }

            const { data: restaurantOrders, error: restaurantError } = await restaurantQuery;
            if (restaurantError) throw restaurantError;

            // 3. Fetch Supermarket Revenue
            let supermarketQuery = supabase
                .from('supermarket_sales')
                .select('*');

            if (dateRange !== 'all') {
                supermarketQuery = supermarketQuery.gte('created_at', startIso).lte('created_at', endIso);
            }

            const { data: supermarketSales, error: supermarketError } = await supermarketQuery;
            if (supermarketError) throw supermarketError;

            // 4. Fetch Pool Revenue
            let poolQuery = supabase
                .from('pool_visits')
                .select('*');

            if (dateRange !== 'all') {
                poolQuery = poolQuery.gte('created_at', startIso).lte('created_at', endIso);
            }

            const { data: poolVisits, error: poolError } = await poolQuery;
            if (poolError) throw poolError;


            // Process Data
            const allTransactions = [];
            let totalRev = 0;
            let roomRev = 0;
            let restRev = 0;
            let superRev = 0;
            let poolRev = 0;
            const barBreakdown = {};

            // Process Invoices
            invoices?.forEach(inv => {
                const amount = parseFloat(inv.amount) || 0;
                roomRev += amount;
                totalRev += amount;
                allTransactions.push({
                    id: inv.id,
                    date: new Date(inv.created_at),
                    source: 'Accommodation',
                    reference: `INV-${inv.id}`,
                    amount: amount,
                    details: `Room ${inv.room_number || inv.room_name} - ${inv.guest_name}`,
                    status: inv.status
                });
            });

            // Process Restaurant Orders
            restaurantOrders?.forEach(order => {
                const amount = parseFloat(order.total_amount) || 0;
                restRev += amount;
                totalRev += amount;

                // Breakdown by bar location
                const location = order.bar_location || 'Main Restaurant';
                if (!barBreakdown[location]) barBreakdown[location] = 0;
                barBreakdown[location] += amount;

                allTransactions.push({
                    id: order.id,
                    date: new Date(order.created_at),
                    source: 'Restaurant/Bar',
                    subSource: location,
                    reference: `ORD-${order.id.substring(0, 8)}`,
                    amount: amount,
                    details: `${order.order_type} - ${order.table_number ? 'Table ' + order.table_number : order.room_number ? 'Room ' + order.room_number : 'Takeaway'} (${location})`,
                    status: order.status
                });
            });

            // Process Supermarket Sales
            supermarketSales?.forEach(sale => {
                const amount = parseFloat(sale.total_amount) || 0;
                superRev += amount;
                totalRev += amount;
                allTransactions.push({
                    id: sale.id,
                    date: new Date(sale.created_at),
                    source: 'Supermarket',
                    reference: sale.receipt_number,
                    amount: amount,
                    details: `POS Sale - ${sale.payment_method}`,
                    status: 'Completed'
                });
            });

            // Process Pool Visits
            poolVisits?.forEach(visit => {
                const amount = parseFloat(visit.amount) || 0;
                poolRev += amount;
                totalRev += amount;
                allTransactions.push({
                    id: visit.id,
                    date: new Date(visit.created_at),
                    source: 'Pool',
                    reference: `POOL-${visit.id.substring(0, 8)}`,
                    amount: amount,
                    details: `${visit.pass_type} - ${visit.guest_name}`,
                    status: 'Paid'
                });
            });

            // Sort by date descending
            allTransactions.sort((a, b) => b.date - a.date);

            setTransactions(allTransactions);
            setStats({
                totalRevenue: totalRev,
                roomRevenue: roomRev,
                restaurantRevenue: restRev,
                supermarketRevenue: superRev,
                poolRevenue: poolRev,
                barBreakdown
            });

        } catch (error) {
            console.error('Error fetching revenue data:', error);
            toast.error('Failed to load revenue data');
        } finally {
            setLoading(false);
        }
    };

    const initCharts = () => {
        if (!chartRef.current || !pieChartRef.current) return;

        // 1. Line Chart (Revenue over time)
        // Group data by date
        const dailyData = {};
        transactions.forEach(t => {
            const dateStr = t.date.toISOString().split('T')[0];
            if (!dailyData[dateStr]) dailyData[dateStr] = 0;
            dailyData[dateStr] += t.amount;
        });

        const dates = Object.keys(dailyData).sort();
        const values = dates.map(d => dailyData[d]);

        const lineOption = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                formatter: '{b}: GH₵{c}'
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: dates,
                axisLine: { lineStyle: { color: isDarkMode ? '#ccc' : '#333' } },
                axisLabel: { color: isDarkMode ? '#ccc' : '#333' }
            },
            yAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: isDarkMode ? '#ccc' : '#333' } },
                axisLabel: { color: isDarkMode ? '#ccc' : '#333' },
                splitLine: { lineStyle: { color: isDarkMode ? '#444' : '#eee' } }
            },
            series: [
                {
                    name: 'Revenue',
                    type: 'line',
                    data: values,
                    smooth: true,
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(59, 130, 246, 0.5)' },
                            { offset: 1, color: 'rgba(59, 130, 246, 0.0)' }
                        ])
                    },
                    itemStyle: { color: '#3b82f6' }
                }
            ]
        };

        if (chartInstance.current) chartInstance.current.dispose();
        chartInstance.current = echarts.init(chartRef.current);
        chartInstance.current.setOption(lineOption);

        // 2. Pie Chart (Revenue Distribution)
        const pieOption = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                formatter: '{b}: GH₵{c} ({d}%)'
            },
            legend: {
                bottom: '0%',
                textStyle: { color: isDarkMode ? '#ccc' : '#333' }
            },
            series: [
                {
                    name: 'Source',
                    type: 'pie',
                    radius: ['40%', '70%'],
                    avoidLabelOverlap: false,
                    itemStyle: {
                        borderRadius: 10,
                        borderColor: isDarkMode ? '#1f2937' : '#fff',
                        borderWidth: 2
                    },
                    label: {
                        show: false,
                        position: 'center'
                    },
                    emphasis: {
                        label: {
                            show: true,
                            fontSize: '18',
                            fontWeight: 'bold',
                            color: isDarkMode ? '#fff' : '#333'
                        }
                    },
                    labelLine: {
                        show: false
                    },
                    data: [
                        { value: stats.roomRevenue, name: 'Accommodation', itemStyle: { color: '#8b5cf6' } },
                        { value: stats.restaurantRevenue, name: 'Restaurant/Bar', itemStyle: { color: '#f59e0b' } },
                        { value: stats.supermarketRevenue, name: 'Supermarket', itemStyle: { color: '#10b981' } },
                        { value: stats.poolRevenue, name: 'Pool', itemStyle: { color: '#06b6d4' } }
                    ]
                }
            ]
        };

        if (pieChartInstance.current) pieChartInstance.current.dispose();
        pieChartInstance.current = echarts.init(pieChartRef.current);
        pieChartInstance.current.setOption(pieOption);
    };

    const formatCurrency = (amount) => {
        return `GH₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <DashboardLayout title="Revenue Management" activeLink="Revenue">
            <div className="space-y-6 flex-1">
                {/* Controls */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 p-1 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                        {['today', 'week', 'month', 'year', 'all'].map((range) => (
                            <button
                                key={range}
                                onClick={() => setDateRange(range)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${dateRange === range
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                            >
                                {range.charAt(0).toUpperCase() + range.slice(1)}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={fetchRevenueData}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <FaFilter className="mr-2" /> Refresh
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className={`p-6 rounded-xl shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Revenue</h3>
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                                <FaMoneyBillWave />
                            </div>
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                        <p className="text-xs text-green-500 mt-1 flex items-center">
                            <FaChartLine className="mr-1" /> +12.5% from last period
                        </p>
                    </div>

                    <div className={`p-6 rounded-xl shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Accommodation</h3>
                            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                                <FaBed />
                            </div>
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(stats.roomRevenue)}</p>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-3">
                            <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${(stats.roomRevenue / stats.totalRevenue) * 100}%` }}></div>
                        </div>
                    </div>

                    <div className={`p-6 rounded-xl shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Restaurant & Bar</h3>
                            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full">
                                <FaUtensils />
                            </div>
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(stats.restaurantRevenue)}</p>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-3">
                            <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${(stats.restaurantRevenue / stats.totalRevenue) * 100}%` }}></div>
                        </div>
                    </div>

                    <div className={`p-6 rounded-xl shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Supermarket</h3>
                            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
                                <FaShoppingCart />
                            </div>
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(stats.supermarketRevenue)}</p>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-3">
                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(stats.supermarketRevenue / stats.totalRevenue) * 100}%` }}></div>
                        </div>
                    </div>

                    <div className={`p-6 rounded-xl shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Pool</h3>
                            <div className="p-3 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-full">
                                <FaSwimmingPool />
                            </div>
                        </div>
                        <p className="text-2xl font-bold">{formatCurrency(stats.poolRevenue)}</p>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-3">
                            <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${(stats.poolRevenue / stats.totalRevenue) * 100}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* Bar Breakdown Section */}
                {Object.keys(stats.barBreakdown).length > 0 && (
                    <div className="mt-2">
                        <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Restaurant & Bar Breakdown</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {Object.entries(stats.barBreakdown).map(([location, amount]) => (
                                <div key={location} className={`p-4 rounded-lg shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium truncate" title={location}>{location}</span>
                                        <FaGlassMartiniAlt className="text-amber-500 text-sm" />
                                    </div>
                                    <p className="text-lg font-bold">{formatCurrency(amount)}</p>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-2">
                                        <div className="bg-amber-500 h-1 rounded-full" style={{ width: `${stats.restaurantRevenue > 0 ? (amount / stats.restaurantRevenue) * 100 : 0}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className={`lg:col-span-2 p-6 rounded-xl shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
                        <div ref={chartRef} style={{ width: '100%', height: '350px' }}></div>
                    </div>
                    <div className={`p-6 rounded-xl shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <h3 className="text-lg font-semibold mb-4">Revenue Distribution</h3>
                        <div ref={pieChartRef} style={{ width: '100%', height: '350px' }}></div>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className={`rounded-xl shadow-sm border overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Recent Transactions</h3>
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">View All</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className={`text-xs uppercase ${isDarkMode ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                                <tr>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Reference</th>
                                    <th className="px-6 py-3">Source</th>
                                    <th className="px-6 py-3">Details</th>
                                    <th className="px-6 py-3">Amount</th>
                                    <th className="px-6 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                {transactions.slice(0, 10).map((t, index) => (
                                    <tr key={`${t.source}-${t.id}-${index}`} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{t.date.toLocaleDateString()} {t.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{t.reference}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.source === 'Accommodation' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                                                t.source === 'Restaurant/Bar' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                                    t.source === 'Supermarket' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                        'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400'
                                                }`}>
                                                {t.source}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={t.details}>{t.details}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">{formatCurrency(t.amount)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                {t.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {transactions.length === 0 && (
                                    <tr>
                                        <td colspan="6" className="px-6 py-8 text-center text-gray-500">No transactions found for the selected period.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default RevenuePage;
