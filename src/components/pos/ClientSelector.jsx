import React, { useState, useEffect } from 'react';
import { Search, User, X, Check } from 'lucide-react';
import clientService from '../../services/clientService';
import Input from '../common/Input';

const ClientSelector = ({ onSelect, selectedClient }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [clients, setClients] = useState([]);
    const [filteredClients, setFilteredClients] = useState([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const loadClients = async () => {
            try {
                const res = await clientService.getAll();
                setClients(res.data);
            } catch (error) {
                console.error('Error loading clients for POS', error);
            }
        };
        loadClients();
    }, []);

    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredClients([]);
            return;
        }
        const term = searchTerm.toLowerCase();
        const filtered = clients.filter(c =>
            c.name.toLowerCase().includes(term) ||
            c.document.includes(term)
        ).slice(0, 5);
        setFilteredClients(filtered);
    }, [searchTerm, clients]);

    const handleSelect = (client) => {
        onSelect(client);
        setSearchTerm('');
        setIsOpen(false);
    };

    const clearSelection = () => {
        onSelect(null);
    };

    return (
        <div className="relative">
            {selectedClient ? (
                <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 flex justify-between items-center">
                    <div className="flex items-center space-x-3 text-primary-900">
                        <div className="bg-primary-500 text-white p-2 rounded-lg">
                            <User size={18} />
                        </div>
                        <div>
                            <p className="font-bold text-sm leading-tight">{selectedClient.name}</p>
                            <p className="text-xs text-primary-600 font-mono">
                                {selectedClient.type}: {selectedClient.document}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={clearSelection}
                        className="text-primary-400 hover:text-primary-600 p-1"
                    >
                        <X size={18} />
                    </button>
                </div>
            ) : (
                <div className="relative">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary-500 transition-colors">
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar cliente (Nombre o DNI/RUC)..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-sm"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setIsOpen(true);
                            }}
                            onFocus={() => setIsOpen(true)}
                        />
                    </div>

                    {isOpen && filteredClients.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden py-1">
                            {filteredClients.map(client => (
                                <button
                                    key={client.id}
                                    onClick={() => handleSelect(client)}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary-50 text-left transition-colors border-b border-gray-50 last:border-0"
                                >
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm">{client.name}</p>
                                        <p className="text-xs text-gray-500">{client.type}: {client.document}</p>
                                    </div>
                                    <Check size={16} className="text-primary-500 opacity-0 group-hover:opacity-100" />
                                </button>
                            ))}
                        </div>
                    )}

                    {isOpen && searchTerm.trim() && filteredClients.length === 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl p-4 text-center">
                            <p className="text-sm text-gray-500">No se encontraron clientes</p>
                            <p className="text-xs text-primary-600 mt-1 font-bold">Usar "Consumidor Final"</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ClientSelector;
