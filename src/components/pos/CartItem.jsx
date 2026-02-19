import React from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';

const CartItem = ({ item, onUpdateQuantity, onRemove }) => {
    return (
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 truncate">{item.name}</h4>
                <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-secondary-500 font-mono">{item.barcode}</span>
                    <span className="text-sm font-bold text-primary-600">S/ {item.priceSell.toFixed(2)}</span>
                </div>
            </div>

            <div className="flex items-center space-x-3 ml-4">
                <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200">
                    <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="p-1.5 text-gray-500 hover:text-primary-600 disabled:opacity-30"
                    >
                        <Minus size={16} />
                    </button>
                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="p-1.5 text-gray-500 hover:text-primary-600"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                <div className="text-right w-20">
                    <p className="text-sm font-bold text-gray-900">S/ {(item.priceSell * item.quantity).toFixed(2)}</p>
                </div>

                <button
                    onClick={() => onRemove(item.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
    );
};

export default CartItem;
