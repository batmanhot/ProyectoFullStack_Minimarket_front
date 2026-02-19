import React, { useRef, useEffect } from 'react';
import { Barcode, Search } from 'lucide-react';

const POSScanner = ({ onScan, onSearch }) => {
    const inputRef = useRef(null);

    useEffect(() => {
        // Mantener el foco en el input para escaneo rápido
        const focusTimer = setInterval(() => {
            if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
                inputRef.current?.focus();
            }
        }, 1000);

        return () => clearInterval(focusTimer);
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            const value = e.target.value.trim();
            if (value) {
                onScan(value);
                e.target.value = '';
            }
        }
    };

    return (
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Barcode className="h-5 w-5 text-primary-500" />
            </div>
            <input
                ref={inputRef}
                type="text"
                placeholder="Escanee código o ingrese búsqueda..."
                className="block w-full pl-10 pr-12 py-3 border-2 border-primary-100 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white shadow-sm text-lg"
                onKeyDown={handleKeyDown}
                onChange={(e) => onSearch(e.target.value)}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Search className="h-5 w-5 text-gray-400" />
            </div>
        </div>
    );
};

export default POSScanner;
