import React from 'react';
import { Printer, X, Check } from 'lucide-react';

const ReceiptTemplate = ({ sale }) => {
    if (!sale) return null;

    const { invoiceNumber, date, items, total, paymentMethod, receiptType, client } = sale;

    const getTitle = () => {
        switch (receiptType) {
            case 'boleta': return 'BOLETA DE VENTA ELECTRÓNICA';
            case 'factura': return 'FACTURA ELECTRÓNICA';
            default: return 'TICKET DE VENTA';
        }
    };

    return (
        <div id="printable-receipt" className="bg-white p-8 max-w-md mx-auto print:p-0 print:m-0 text-gray-800 font-mono text-sm leading-tight">
            <style>
                {`
                @media print {
                    body * { visibility: hidden; }
                    #printable-receipt, #printable-receipt * { visibility: visible; }
                    #printable-receipt {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                }
                `}
            </style>

            <div className="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4">
                <h1 className="text-2xl font-black text-gray-900 mb-1">MINIMARKET DEMO</h1>
                <p className="text-xs uppercase">RUC: 20123456789</p>
                <p className="text-xs">Av. Comercio 456 - Lima</p>
                <p className="text-xs">Tel: (01) 987-654321</p>
            </div>

            <div className="mb-4 text-center">
                <h2 className="font-bold border-y-2 border-gray-200 py-1 mb-2 tracking-widest">{getTitle()}</h2>
                <p className="text-lg font-black">{invoiceNumber}</p>
            </div>

            <div className="space-y-1 mb-4 text-xs">
                <div className="flex justify-between">
                    <span>FECHA:</span>
                    <span>{new Date(date).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span>PAGO:</span>
                    <span className="uppercase">{paymentMethod === 'cash' ? 'EFECTIVO' : 'TARJETA'}</span>
                </div>
                {client ? (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="flex justify-between font-bold">
                            <span>CLIENTE:</span>
                            <span className="text-right">{client.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>{client.type}:</span>
                            <span>{client.document}</span>
                        </div>
                        {client.address && (
                            <div className="flex justify-between italic">
                                <span>DIR:</span>
                                <span className="text-right line-clamp-1">{client.address}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex justify-between">
                        <span>CLIENTE:</span>
                        <span>CONSUMIDOR FINAL</span>
                    </div>
                )}
            </div>

            <table className="w-full text-xs mb-4">
                <thead className="border-b-2 border-gray-200">
                    <tr>
                        <th className="text-left py-2 font-bold w-12">CANT.</th>
                        <th className="text-left py-2 font-bold">PRODUCTO</th>
                        <th className="text-right py-2 font-bold">TOTAL</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {items.map((item, idx) => (
                        <tr key={idx}>
                            <td className="py-2 align-top">{item.quantity}</td>
                            <td className="py-2">
                                <span className="block">{item.name}</span>
                                <span className="text-[10px] text-gray-500 italic">P. Unit: S/ {item.price.toFixed(2)}</span>
                            </td>
                            <td className="py-2 text-right align-top font-bold">S/ {item.subtotal.toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="border-t-2 border-gray-200 pt-3 space-y-1">
                <div className="flex justify-between font-bold text-lg">
                    <span>TOTAL A PAGAR</span>
                    <span>S/ {total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 pt-2 italic">
                    <span>OP. GRAVADA</span>
                    <span>S/ {(total / 1.18).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 italic">
                    <span>IGV (18%)</span>
                    <span>S/ {(total - (total / 1.18)).toFixed(2)}</span>
                </div>
            </div>

            <div className="mt-8 pt-4 border-t-2 border-dashed border-gray-300 text-center">
                <p className="text-[10px] mb-2 font-medium">¡GRACIAS POR SU COMPRA!</p>
                <p className="text-[9px] text-gray-500 italic">REVISE SUS PRODUCTOS ANTES DE SALIR. NO SE ACEPTAN DEVOLUCIONES DE PERECIBLES.</p>
                <div className="mt-4 flex justify-center opacity-30">
                    <div className="w-16 h-16 bg-gray-900"></div>
                </div>
                <p className="text-[8px] mt-2 text-gray-400">Representación impresa de {receiptType === 'ticket' ? 'Ticket' : 'Comprobante Electrónico'}</p>
            </div>
        </div>
    );
};

export default ReceiptTemplate;
