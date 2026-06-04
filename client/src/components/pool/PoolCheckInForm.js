import React, { useState, useEffect } from 'react';
import { FaSwimmingPool, FaUser, FaCheckCircle, FaMoneyBillWave } from 'react-icons/fa';
import supabase from '../../supabaseClient';
import { toast, Toaster } from 'react-hot-toast';

const PoolCheckInForm = () => {
    const [formData, setFormData] = useState({
        guest_name: '',
        pass_type: 'Pool Entry', // Default pass type
        amount: '50', // Default pool entry fee
        payment_method: 'Cash', // Default to Cash (pay at counter)
        notes: 'Self Check-in'
    });
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase
                .from('pool_visits')
                .insert([
                    {
                        guest_name: formData.guest_name,
                        pass_type: formData.pass_type,
                        amount: parseFloat(formData.amount),
                        payment_method: formData.payment_method,
                        notes: formData.notes,
                        created_at: new Date().toISOString()
                    }
                ]);

            if (error) throw error;

            setSubmitted(true);
            toast.success('Check-in successful!');
        } catch (error) {
            console.error('Error submitting check-in:', error);
            toast.error('Failed to check in. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center animate-scaleIn">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FaCheckCircle className="text-green-500 text-4xl" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">You're All Set!</h2>
                    <p className="text-gray-600 mb-8">
                        Thank you, <strong>{formData.guest_name}</strong>. Please proceed to the counter to complete your payment of <strong>GH₵{formData.amount}</strong>.
                    </p>
                    <button
                        onClick={() => {
                            setSubmitted(false);
                            setFormData({
                                guest_name: '',
                                pass_type: 'Pool Entry',
                                amount: '50',
                                payment_method: 'Cash',
                                notes: 'Self Check-in'
                            });
                        }}
                        className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors w-full"
                    >
                        Check in Another Guest
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <Toaster position="top-center" />

            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-b-[50px] z-0"></div>

            <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-white p-6 border-b border-gray-100 text-center pt-8">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <FaSwimmingPool className="text-blue-500 text-3xl" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">Pool Self Check-in</h1>
                    <p className="text-gray-500 text-sm mt-1">Welcome to Nhyiraba Hotel Pool</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FaUser className="text-gray-400" />
                            </div>
                            <input
                                type="text"
                                name="guest_name"
                                value={formData.guest_name}
                                onChange={handleChange}
                                required
                                className="pl-10 w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="Enter your name"
                            />
                        </div>
                    </div>

                    <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between border border-blue-100">
                        <div className="flex items-center space-x-3">
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <FaMoneyBillWave className="text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Amount to Pay</p>
                                <p className="text-xs text-blue-400">Pay at counter</p>
                            </div>
                        </div>
                        <span className="text-2xl font-bold text-blue-700">GH₵{formData.amount}</span>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl shadow-lg hover:shadow-blue-500/30 transition-all transform hover:-translate-y-1 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'Processing...' : 'Check In Now'}
                    </button>
                </form>
            </div>

            <p className="mt-6 text-gray-400 text-xs text-center">
                &copy; {new Date().getFullYear()} Nhyiraba Hotel Management System
            </p>

            <style jsx>{`
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
      `}</style>
        </div>
    );
};

export default PoolCheckInForm;
