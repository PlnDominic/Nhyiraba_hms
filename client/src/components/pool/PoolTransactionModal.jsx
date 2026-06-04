import React, { useState, useEffect } from 'react';
import { FaTimes, FaSwimmingPool, FaMoneyBillWave, FaUser, FaCreditCard } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

const PoolTransactionModal = ({ isOpen, onClose, onSave }) => {
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

    const [formData, setFormData] = useState({
        guest_name: '',
        pass_type: 'Adult Day Pass',
        amount: '',
        payment_method: 'Cash',
        notes: ''
    });

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                guest_name: '',
                pass_type: 'Adult Day Pass',
                amount: '',
                payment_method: 'Cash',
                notes: ''
            });
        }
    }, [isOpen]);

    // Auto-set amount based on pass type
    useEffect(() => {
        let price = '';
        switch (formData.pass_type) {
            case 'Adult Day Pass':
                price = '50';
                break;
            case 'Child Day Pass':
                price = '30';
                break;
            case 'Family Pass (4)':
                price = '150';
                break;
            case 'Weekend Special':
                price = '60';
                break;
            default:
                price = '';
        }
        setFormData(prev => ({ ...prev, amount: price }));
    }, [formData.pass_type]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...formData,
            amount: parseFloat(formData.amount)
        });
    };

    if (!isOpen) return null;

    const inputClass = isDarkMode
        ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:border-blue-500 focus:bg-gray-600'
        : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

    const labelClass = isDarkMode ? 'text-gray-300' : 'text-gray-700';

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn" onClick={onClose}>
            <div className="relative w-full max-w-md animate-scaleIn" onClick={(e) => e.stopPropagation()}>
                {/* Animated background gradient effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 via-blue-500/30 to-purple-500/30 rounded-3xl blur-2xl animate-pulse"></div>

                <div className={`relative ${isDarkMode ? 'bg-gray-900/95' : 'bg-white'} backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden ${isDarkMode ? 'border border-gray-700/50' : 'border border-gray-200'}`}>
                    {/* Header */}
                    <div className={`relative overflow-hidden p-6 border-b ${isDarkMode ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-r from-cyan-50 to-blue-50 border-gray-200'}`}>
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10"></div>
                        <div className="relative flex justify-between items-center">
                            <div>
                                <h2 className={`text-2xl font-bold ${isDarkMode ? 'bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent' : 'text-gray-800'}`}>
                                    New Pool Entry
                                </h2>
                                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Record a new pool payment
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className={`${isDarkMode ? 'text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'} transition-all duration-300 p-2 rounded-full hover:scale-110 hover:rotate-90`}
                            >
                                <FaTimes size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Form */}
                    <div className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-5">

                            <div>
                                <label className={`block mb-2 font-medium ${labelClass}`}>Guest Name *</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FaUser className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                                    </div>
                                    <input
                                        type="text"
                                        name="guest_name"
                                        value={formData.guest_name}
                                        onChange={handleChange}
                                        required
                                        className={`pl-10 w-full p-3 border rounded-xl transition-all duration-200 ${inputClass} focus:outline-none`}
                                        placeholder="Enter guest name"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={`block mb-2 font-medium ${labelClass}`}>Pass Type *</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FaSwimmingPool className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                                    </div>
                                    <select
                                        name="pass_type"
                                        value={formData.pass_type}
                                        onChange={handleChange}
                                        className={`pl-10 w-full p-3 border rounded-xl transition-all duration-200 ${inputClass} focus:outline-none cursor-pointer appearance-none`}
                                    >
                                        <option value="Adult Day Pass">Adult Day Pass</option>
                                        <option value="Child Day Pass">Child Day Pass</option>
                                        <option value="Family Pass (4)">Family Pass (4)</option>
                                        <option value="Weekend Special">Weekend Special</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block mb-2 font-medium ${labelClass}`}>Amount (GH₵) *</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <FaMoneyBillWave className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                                        </div>
                                        <input
                                            type="number"
                                            name="amount"
                                            value={formData.amount}
                                            onChange={handleChange}
                                            required
                                            min="0"
                                            step="0.01"
                                            className={`pl-10 w-full p-3 border rounded-xl transition-all duration-200 ${inputClass} focus:outline-none`}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={`block mb-2 font-medium ${labelClass}`}>Payment Method</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <FaCreditCard className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                                        </div>
                                        <select
                                            name="payment_method"
                                            value={formData.payment_method}
                                            onChange={handleChange}
                                            className={`pl-10 w-full p-3 border rounded-xl transition-all duration-200 ${inputClass} focus:outline-none cursor-pointer appearance-none`}
                                        >
                                            <option value="Cash">Cash</option>
                                            <option value="Mobile Money">Mobile Money</option>
                                            <option value="Card">Card</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className={`block mb-2 font-medium ${labelClass}`}>Notes (Optional)</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    className={`w-full p-3 border rounded-xl transition-all duration-200 ${inputClass} focus:outline-none resize-none`}
                                    placeholder="Additional details..."
                                    rows="2"
                                ></textarea>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold rounded-xl transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-cyan-500/25 flex items-center justify-center space-x-2"
                                >
                                    <FaSwimmingPool />
                                    <span>Record Payment</span>
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            </div>

            <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
        </div>
    );
};

export default PoolTransactionModal;
