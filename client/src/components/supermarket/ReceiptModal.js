import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPrint, FaTimes } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';
import { useReactToPrint } from 'react-to-print';

const ReceiptModal = ({ isOpen, onClose, saleData }) => {
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';
    const componentRef = useRef();

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        content: () => componentRef.current,
    });

    if (!isOpen || !saleData) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`relative w-full max-w-md rounded-xl shadow-2xl overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}
                >
                    {/* Header */}
                    <div className={`flex justify-between items-center p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Receipt</h3>
                        <button
                            onClick={onClose}
                            className={`p-2 rounded-full hover:bg-opacity-10 ${isDarkMode ? 'hover:bg-white text-gray-400' : 'hover:bg-black text-gray-500'}`}
                        >
                            <FaTimes />
                        </button>
                    </div>

                    {/* Receipt Content (Printable Area) */}
                    <div className="p-6 bg-white text-black" ref={componentRef}>
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold uppercase tracking-wider">Nhyiraba Hotel</h2>
                            <p className="text-sm text-gray-600">Supermarket Department</p>
                            <p className="text-sm text-gray-600">Tel: +233 00 000 0000</p>
                        </div>

                        <div className="border-b-2 border-dashed border-gray-300 my-4"></div>

                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-600">Receipt No:</span>
                            <span className="font-mono font-bold">{saleData.receipt_number}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-4">
                            <span className="text-gray-600">Date:</span>
                            <span>{new Date(saleData.created_at).toLocaleString()}</span>
                        </div>

                        <table className="w-full text-sm mb-4">
                            <thead>
                                <tr className="border-b border-gray-300">
                                    <th className="text-left py-2">Item</th>
                                    <th className="text-center py-2">Qty</th>
                                    <th className="text-right py-2">Price</th>
                                    <th className="text-right py-2">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {saleData.items.map((item, index) => (
                                    <tr key={index} className="border-b border-gray-100">
                                        <td className="py-2">{item.item_name}</td>
                                        <td className="text-center py-2">{item.quantity}</td>
                                        <td className="text-right py-2">{parseFloat(item.unit_price).toFixed(2)}</td>
                                        <td className="text-right py-2 font-medium">{parseFloat(item.total_price).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="border-t-2 border-gray-800 pt-2 mt-4">
                            <div className="flex justify-between items-center text-lg font-bold">
                                <span>TOTAL</span>
                                <span>₵{parseFloat(saleData.total_amount).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-gray-600 mt-1">
                                <span>Payment Method</span>
                                <span className="uppercase">{saleData.payment_method}</span>
                            </div>
                        </div>

                        <div className="mt-8 text-center text-xs text-gray-500">
                            <p>Thank you for shopping with us!</p>
                            <p>Please come again.</p>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className={`p-4 border-t flex gap-3 ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                        <button
                            onClick={handlePrint}
                            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
                        >
                            <FaPrint /> Print Receipt
                        </button>
                        <button
                            onClick={onClose}
                            className={`flex-1 py-2 rounded-lg font-medium border transition-colors ${isDarkMode
                                ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ReceiptModal;
