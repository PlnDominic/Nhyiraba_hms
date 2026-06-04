import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faEdit, faTrash, faListCheck, faCheckCircle, faClock, faExclamationTriangle, faTasks, faPlus, faBoxOpen } from '@fortawesome/free-solid-svg-icons';
import DashboardLayout from './DashboardLayout';
import { useTheme } from '../context/ThemeContext';
import TaskModal from './TaskModal';
import supabase from '../supabaseClient';
import Card from './ui/Card';
import toast from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';
import InventoryRequestModal from './InventoryRequestModal';

import { useInventory } from '../context/InventoryContext';

const TasksPage = () => {
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

    const [tasks, setTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentTask, setCurrentTask] = useState(null);
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('tasks');

    // Function to fetch tasks from Supabase
    const fetchTasks = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Try fetching from Supabase first
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching tasks from Supabase:', error);
                setTasks([]);
            } else {
                setTasks(data || []);
            }
        } catch (err) {
            console.error('Unexpected error fetching tasks:', err);
            setError('Failed to load tasks. Please try again later.');
            setTasks([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch tasks on component mount
    useEffect(() => {
        if (activeTab === 'tasks') {
            fetchTasks();

            // Set up real-time subscription
            const tasksSubscription = supabase
                .channel('tasks_changes')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'tasks' },
                    (payload) => {
                        console.log('Real-time update received:', payload);
                        fetchTasks();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(tasksSubscription);
            };
        }
    }, [activeTab]);

    // Handle opening modal for new task
    const handleAddTask = () => {
        setCurrentTask(null);
        setIsModalOpen(true);
    };

    // Handle opening modal for editing task
    const handleEditTask = (task) => {
        setCurrentTask(task);
        setIsModalOpen(true);
    };

    // Handle deleting a task
    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete this task?')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId);

            if (error) {
                throw error;
            }

            // Update local state
            setTasks(tasks.filter(task => task.id !== taskId));

            // Add notification
            console.log('Task deleted successfully');

        } catch (err) {
            console.error('Error deleting task:', err);
            setError('Failed to delete task. Please try again.');
        }
    };

    // Handle saving a task (from modal)
    const handleSaveTask = (taskData) => {
        fetchTasks(); // Refetch all tasks to ensure we have the latest data
    };

    // Get color for priority badge
    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'High':
                return isDarkMode
                    ? 'bg-red-900/30 text-red-300 border-red-700/50'
                    : 'bg-red-100 text-red-800 border-red-200';
            case 'Medium':
                return isDarkMode
                    ? 'bg-amber-900/30 text-amber-300 border-amber-700/50'
                    : 'bg-amber-100 text-amber-800 border-amber-200';
            case 'Low':
                return isDarkMode
                    ? 'bg-green-900/30 text-green-300 border-green-700/50'
                    : 'bg-green-100 text-green-800 border-green-200';
            default:
                return isDarkMode
                    ? 'bg-gray-800 text-gray-300 border-gray-700/50'
                    : 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    // Get color for status badge
    const getStatusColor = (status) => {
        switch (status) {
            case 'Pending':
                return isDarkMode
                    ? 'bg-gray-800/60 text-gray-300 border-gray-700/50'
                    : 'bg-gray-100 text-gray-800 border-gray-200';
            case 'In Progress':
                return isDarkMode
                    ? 'bg-blue-900/30 text-blue-300 border-blue-700/50'
                    : 'bg-blue-100 text-blue-800 border-blue-200';
            case 'Completed':
                return isDarkMode
                    ? 'bg-green-900/30 text-green-300 border-green-700/50'
                    : 'bg-green-100 text-green-800 border-green-200';
            case 'Cancelled':
                return isDarkMode
                    ? 'bg-red-900/30 text-red-300 border-red-700/50'
                    : 'bg-red-100 text-red-800 border-red-200';
            default:
                return isDarkMode
                    ? 'bg-gray-800 text-gray-300 border-gray-700/50'
                    : 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    // Get filtered tasks
    const filteredTasks = selectedFilter === 'all'
        ? tasks
        : tasks.filter(task => task.status.toLowerCase() === selectedFilter);

    // Get tasks by status for statistics
    const pendingTasks = tasks.filter(task => task.status === 'Pending');
    const inProgressTasks = tasks.filter(task => task.status === 'In Progress');
    const completedTasks = tasks.filter(task => task.status === 'Completed');
    const highPriorityTasks = tasks.filter(task => task.priority === 'High');

    return (
        <DashboardLayout title="Housekeeping Management" activeLink="Tasks">
            <div className="space-y-6">
                {/* Tabs Navigation */}
                <div className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <nav className="flex -mb-px space-x-8">
                        <button
                            onClick={() => setActiveTab('tasks')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'tasks'
                                ? `border-blue-500 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`
                                : `border-transparent ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
                                }`}
                        >
                            <FontAwesomeIcon icon={faListCheck} className="mr-2" />
                            Tasks
                        </button>
                        <button
                            onClick={() => setActiveTab('inventory')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'inventory'
                                ? `border-blue-500 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`
                                : `border-transparent ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
                                }`}
                        >
                            <FontAwesomeIcon icon={faTasks} className="mr-2" />
                            Housekeeping Inventory
                        </button>
                    </nav>
                </div>

                {activeTab === 'tasks' ? (
                    <>
                        {/* Task Statistics */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card className="text-center overflow-hidden relative">
                                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600`}></div>
                                <div className="flex items-center justify-center">
                                    <div className={`flex items-center justify-center w-12 h-12 rounded-full ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'} mb-3`}>
                                        <FontAwesomeIcon icon={faTasks} className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'} text-xl`} />
                                    </div>
                                </div>
                                <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{tasks.length}</p>
                                <p className={`text-xs uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>Total Tasks</p>
                            </Card>

                            <Card className="text-center overflow-hidden relative">
                                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-yellow-600`}></div>
                                <div className="flex items-center justify-center">
                                    <div className={`flex items-center justify-center w-12 h-12 rounded-full ${isDarkMode ? 'bg-amber-900/30' : 'bg-amber-100'} mb-3`}>
                                        <FontAwesomeIcon icon={faClock} className={`${isDarkMode ? 'text-amber-400' : 'text-amber-600'} text-xl`} />
                                    </div>
                                </div>
                                <p className={`text-3xl font-bold ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                                    {pendingTasks.length}
                                </p>
                                <p className={`text-xs uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>Pending</p>
                            </Card>

                            <Card className="text-center overflow-hidden relative">
                                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-600`}></div>
                                <div className="flex items-center justify-center">
                                    <div className={`flex items-center justify-center w-12 h-12 rounded-full ${isDarkMode ? 'bg-green-900/30' : 'bg-green-100'} mb-3`}>
                                        <FontAwesomeIcon icon={faCheckCircle} className={`${isDarkMode ? 'text-green-400' : 'text-green-600'} text-xl`} />
                                    </div>
                                </div>
                                <p className={`text-3xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                    {completedTasks.length}
                                </p>
                                <p className={`text-xs uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>Completed</p>
                            </Card>

                            <Card className="text-center overflow-hidden relative">
                                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-pink-600`}></div>
                                <div className="flex items-center justify-center">
                                    <div className={`flex items-center justify-center w-12 h-12 rounded-full ${isDarkMode ? 'bg-red-900/30' : 'bg-red-100'} mb-3`}>
                                        <FontAwesomeIcon icon={faExclamationTriangle} className={`${isDarkMode ? 'text-red-400' : 'text-red-600'} text-xl`} />
                                    </div>
                                </div>
                                <p className={`text-3xl font-bold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                                    {highPriorityTasks.length}
                                </p>
                                <p className={`text-xs uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>High Priority</p>
                            </Card>
                        </div>

                        {/* Task List */}
                        <Card title="Task Overview" className="overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-600"></div>

                            <div className="flex justify-between items-center mb-6 px-6 pt-2">
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => setSelectedFilter('all')}
                                        className={`px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${selectedFilter === 'all'
                                            ? isDarkMode
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                                : 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                                            : isDarkMode
                                                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => setSelectedFilter('pending')}
                                        className={`px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${selectedFilter === 'pending'
                                            ? isDarkMode
                                                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                                                : 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                                            : isDarkMode
                                                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        Pending
                                    </button>
                                    <button
                                        onClick={() => setSelectedFilter('in progress')}
                                        className={`px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${selectedFilter === 'in progress'
                                            ? isDarkMode
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                                : 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                                            : isDarkMode
                                                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        In Progress
                                    </button>
                                    <button
                                        onClick={() => setSelectedFilter('completed')}
                                        className={`px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${selectedFilter === 'completed'
                                            ? isDarkMode
                                                ? 'bg-green-600 text-white shadow-md shadow-green-500/20'
                                                : 'bg-green-500 text-white shadow-md shadow-green-500/20'
                                            : isDarkMode
                                                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        Completed
                                    </button>
                                </div>
                                <button
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center"
                                    onClick={handleAddTask}
                                >
                                    <FontAwesomeIcon icon={faListCheck} className="mr-2" />
                                    Add New Task
                                </button>
                            </div>

                            {error && (
                                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mx-6 mb-4">
                                    <p>{error}</p>
                                </div>
                            )}

                            {isLoading ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                </div>
                            ) : filteredTasks.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {selectedFilter === 'all'
                                            ? 'No tasks available. Create a new task to get started.'
                                            : `No ${selectedFilter} tasks found.`}
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto px-2">
                                    <table className="min-w-full">
                                        <thead>
                                            <tr className={`border-b ${isDarkMode ? 'border-gray-700/50' : 'border-gray-200/70'}`}>
                                                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} uppercase tracking-wider`}>Room</th>
                                                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} uppercase tracking-wider`}>Description</th>
                                                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} uppercase tracking-wider`}>Priority</th>
                                                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} uppercase tracking-wider`}>Assignee</th>
                                                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} uppercase tracking-wider`}>Status</th>
                                                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} uppercase tracking-wider`}>Due Date</th>
                                                <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} uppercase tracking-wider`}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200/10">
                                            {filteredTasks.map(task => (
                                                <tr key={task.id} className={`${isDarkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'} transition-colors duration-150`}>
                                                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        <span className={`px-2 py-1 rounded-full text-xs border ${isDarkMode ? 'bg-blue-900/30 text-blue-300 border-blue-700/50' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                                                            {task.room}
                                                        </span>
                                                    </td>
                                                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                                                        {task.description}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-1 text-xs ${getPriorityColor(task.priority)} rounded-full border`}>
                                                            {task.priority}
                                                        </span>
                                                    </td>
                                                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        {task.assignee || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-1 text-xs ${getStatusColor(task.status)} rounded-full border`}>
                                                            {task.status}
                                                        </span>
                                                    </td>
                                                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        {task.due_date && new Date(task.due_date).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex space-x-2">
                                                            <button
                                                                className={`p-1.5 rounded-full ${isDarkMode ? 'bg-blue-900/30 text-blue-400 hover:text-blue-300 hover:bg-blue-800/50' : 'bg-blue-100/80 text-blue-600 hover:text-blue-700 hover:bg-blue-200/70'} transition-colors`}
                                                                onClick={() => handleEditTask(task)}
                                                                title="Edit Task"
                                                            >
                                                                <FontAwesomeIcon icon={faEdit} size={14} />
                                                            </button>
                                                            <button
                                                                className={`p-1.5 rounded-full ${isDarkMode ? 'bg-red-900/30 text-red-400 hover:text-red-300 hover:bg-red-800/50' : 'bg-red-100/80 text-red-600 hover:text-red-700 hover:bg-red-200/70'} transition-colors`}
                                                                onClick={() => handleDeleteTask(task.id)}
                                                                title="Delete Task"
                                                            >
                                                                <FontAwesomeIcon icon={faTrash} size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>
                    </>
                ) : (
                    <HousekeepingInventoryView />
                )}
            </div>

            {/* Task Modal */}
            <TaskModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                task={currentTask}
                onSave={handleSaveTask}
            />
        </DashboardLayout>
    );
};

const HousekeepingInventoryView = () => {
    const { fetchDepartmentStock } = useInventory();
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';
    const [stockItems, setStockItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [inventoryRequests, setInventoryRequests] = useState([]);
    const [activeSubTab, setActiveSubTab] = useState('stock');

    useEffect(() => {
        loadStock();
        loadRequests();
    }, []);

    const loadStock = async () => {
        setLoading(true);
        const data = await fetchDepartmentStock('Housekeeping');
        setStockItems(data);
        setLoading(false);
    };

    const loadRequests = async () => {
        try {
            const { data, error } = await supabase
                .from('inventory_requests')
                .select(`
                    *,
                    inventory_request_items (
                        *
                    )
                `)
                .eq('department', 'Housekeeping')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setInventoryRequests(data || []);
        } catch (error) {
            console.error('Error loading requests:', error);
        }
    };

    const handleRequestSubmitted = () => {
        loadRequests();
        toast.success('Request submitted successfully!');
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending':
                return isDarkMode
                    ? 'bg-amber-900/30 text-amber-300 border-amber-700/50'
                    : 'bg-amber-100 text-amber-800 border-amber-200';
            case 'approved':
                return isDarkMode
                    ? 'bg-green-900/30 text-green-300 border-green-700/50'
                    : 'bg-green-100 text-green-800 border-green-200';
            case 'fulfilled':
                return isDarkMode
                    ? 'bg-blue-900/30 text-blue-300 border-blue-700/50'
                    : 'bg-blue-100 text-blue-800 border-blue-200';
            case 'rejected':
                return isDarkMode
                    ? 'bg-red-900/30 text-red-300 border-red-700/50'
                    : 'bg-red-100 text-red-800 border-red-200';
            default:
                return isDarkMode
                    ? 'bg-gray-800 text-gray-300 border-gray-700/50'
                    : 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    if (loading) return <div className="p-8 text-center">Loading inventory...</div>;

    return (
        <>
            <Toaster position="top-right" />
            <Card title="Housekeeping Inventory" className="overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-teal-600"></div>
                
                {/* Sub-tabs */}
                <div className={`flex justify-between items-center px-6 pt-4 pb-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex space-x-4">
                        <button
                            onClick={() => setActiveSubTab('stock')}
                            className={`pb-2 px-1 border-b-2 font-medium text-sm ${activeSubTab === 'stock'
                                ? `border-blue-500 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`
                                : `border-transparent ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
                                }`}
                        >
                            <FontAwesomeIcon icon={faBoxOpen} className="mr-2" />
                            Current Stock
                        </button>
                        <button
                            onClick={() => setActiveSubTab('requests')}
                            className={`pb-2 px-1 border-b-2 font-medium text-sm ${activeSubTab === 'requests'
                                ? `border-blue-500 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`
                                : `border-transparent ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
                                }`}
                        >
                            <FontAwesomeIcon icon={faListCheck} className="mr-2" />
                            My Requests ({inventoryRequests.length})
                        </button>
                    </div>
                    <button
                        onClick={() => setIsRequestModalOpen(true)}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center"
                    >
                        <FontAwesomeIcon icon={faPlus} className="mr-2" />
                        Request Items
                    </button>
                </div>

                {activeSubTab === 'stock' ? (
                    stockItems.length > 0 ? (
                        <div className="overflow-x-auto p-4">
                            <table className={`w-full ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                <thead className={isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}>
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Item Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">SKU</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Current Stock</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Unit</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Last Updated</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                    {stockItems.map(stock => (
                                        <tr key={stock.id} className={isDarkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium">{stock.item?.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stock.item?.sku}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`font-bold ${stock.current_stock <= (stock.item?.reorder_point || 0)
                                                    ? 'text-red-500'
                                                    : isDarkMode ? 'text-green-400' : 'text-green-600'
                                                    }`}>
                                                    {stock.current_stock}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stock.item?.unit_of_measure}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(stock.last_updated).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            No inventory items found for Housekeeping.
                        </div>
                    )
                ) : (
                    <div className="p-4">
                        {inventoryRequests.length > 0 ? (
                            <div className="space-y-4">
                                {inventoryRequests.map(request => (
                                    <div
                                        key={request.id}
                                        className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="font-semibold">Request #{request.id.substring(0, 8)}</p>
                                                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {new Date(request.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                                                {request.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Items:</p>
                                            <ul className="space-y-1">
                                                {request.inventory_request_items?.map((item, idx) => (
                                                    <li key={idx} className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        • {item.item_name} - {item.quantity_requested} {item.unit_of_measure}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        {request.notes && (
                                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                    <span className="font-medium">Notes:</span> {request.notes}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                <FontAwesomeIcon icon={faListCheck} className="text-4xl mb-3 opacity-50" />
                                <p>No inventory requests yet.</p>
                                <p className="text-sm mt-2">Click "Request Items" to create your first request.</p>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            <InventoryRequestModal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                onRequestSubmitted={handleRequestSubmitted}
            />
        </>
    );
};

export default TasksPage;
