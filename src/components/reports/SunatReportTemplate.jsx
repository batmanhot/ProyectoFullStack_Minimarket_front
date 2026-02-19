import React from 'react';

const SunatReportTemplate = ({ sales, filters }) => {
    const IGV_RATE = 0.18;

    const calculateValues = (total) => {
        const base = total / (1 + IGV_RATE);
        const igv = total - base;
        return { base, igv };
    };

    const getDocType = (type) => {
        switch (type) {
            case 'factura': return '01';
            case 'boleta': return '03';
            default: return '00'; // Ticket/Other
        }
    };

    const totals = sales.reduce((acc, sale) => {
        const { base, igv } = calculateValues(sale.total);
        return {
            base: acc.base + base,
            igv: acc.igv + igv,
            total: acc.total + sale.total
        };
    }, { base: 0, igv: 0, total: 0 });

    return (
        <div id="sunat-report" className="bg-white p-8 overflow-x-auto min-w-[1000px] text-[10px] font-sans">
            <style>
                {`
                @media print {
                    @page { size: A4 landscape; margin: 1cm; }
                    body * { visibility: hidden; }
                    #sunat-report, #sunat-report * { visibility: visible; }
                    #sunat-report {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white !important;
                        padding: 0 !important;
                    }
                    .no-print { display: none !important; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #000 !important; padding: 4px !important; }
                    th { bg-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
                }
                `}
            </style>

            <div className="mb-6 border-b-2 border-gray-800 pb-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-xl font-bold uppercase tracking-tighter">Registro de Ventas e Ingresos</h1>
                        <p className="font-semibold">FORMATO 14.1 - SUNAT</p>
                    </div>
                    <div className="text-right">
                        <p><span className="font-bold text-gray-700">PERIODO:</span> {filters.startDate} al {filters.endDate}</p>
                        <p><span className="font-bold text-gray-700">RUC:</span> 20123456789</p>
                        <p><span className="font-bold text-gray-700">RAZÓN SOCIAL:</span> MINIMARKET DEMO S.A.C.</p>
                    </div>
                </div>
            </div>

            <table className="w-full border-collapse border border-gray-800 text-center">
                <thead>
                    <tr className="bg-gray-100">
                        <th rowSpan="2" className="border border-gray-800 p-1">Fecha</th>
                        <th colSpan="3" className="border border-gray-800 p-1">Comprobante de Pago</th>
                        <th colSpan="3" className="border border-gray-800 p-1">Información del Cliente</th>
                        <th rowSpan="2" className="border border-gray-800 p-1">Base Imponible</th>
                        <th rowSpan="2" className="border border-gray-800 p-1">IGV (18%)</th>
                        <th rowSpan="2" className="border border-gray-800 p-1">Importe Total</th>
                    </tr>
                    <tr className="bg-gray-100">
                        <th className="border border-gray-800 p-1 text-[8px]">Tipo (01/03)</th>
                        <th className="border border-gray-800 p-1">Serie</th>
                        <th className="border border-gray-800 p-1">Número</th>
                        <th className="border border-gray-800 p-1 text-[8px]">Tipo Doc.</th>
                        <th className="border border-gray-800 p-1">Número</th>
                        <th className="border border-gray-800 p-1">Nombre / Razón Social</th>
                    </tr>
                </thead>
                <tbody>
                    {sales.map((sale, index) => {
                        const { base, igv } = calculateValues(sale.total);
                        const [series, number] = sale.invoiceNumber.split('-');
                        return (
                            <tr key={index} className="hover:bg-gray-50">
                                <td className="border border-gray-800 p-1">{new Date(sale.date).toLocaleDateString()}</td>
                                <td className="border border-gray-800 p-1">{getDocType(sale.receiptType)}</td>
                                <td className="border border-gray-800 p-1 text-xs font-bold">{series}</td>
                                <td className="border border-gray-800 p-1 text-xs">{number}</td>
                                <td className="border border-gray-800 p-1">{sale.client ? '6' : '0'}</td>
                                <td className="border border-gray-800 p-1">{sale.client?.document || '-'}</td>
                                <td className="border border-gray-800 p-1 text-left line-clamp-1">{sale.client?.name || 'CONSUMIDOR FINAL'}</td>
                                <td className="border border-gray-800 p-1 text-right">{base.toFixed(2)}</td>
                                <td className="border border-gray-800 p-1 text-right">{igv.toFixed(2)}</td>
                                <td className="border border-gray-800 p-1 text-right font-bold">{sale.total.toFixed(2)}</td>
                            </tr>
                        );
                    })}
                    {sales.length === 0 && (
                        <tr>
                            <td colSpan="11" className="p-8 text-center text-gray-400 italic">No hay registros para este periodo</td>
                        </tr>
                    )}
                </tbody>
                <tfoot className="bg-gray-100 font-bold">
                    <tr>
                        <td colSpan="7" className="border border-gray-800 p-2 text-right">TOTALES GENERALES S/</td>
                        <td className="border border-gray-800 p-2 text-right">{totals.base.toFixed(2)}</td>
                        <td className="border border-gray-800 p-2 text-right">{totals.igv.toFixed(2)}</td>
                        <td className="border border-gray-800 p-2 text-right text-base text-primary-700">{totals.total.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>

            <div className="mt-8 text-[8px] text-gray-400 flex justify-between uppercase">
                <p>Reporte generado por Sistema POS Minimarket</p>
                <p>Página 1 de 1</p>
                <p>Fecha impresión: {new Date().toLocaleString()}</p>
            </div>
        </div>
    );
};

export default SunatReportTemplate;
