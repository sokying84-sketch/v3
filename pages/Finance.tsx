
import React, { useEffect, useState } from 'react';
import { getFinishedGoods, getInventory, getPurchaseOrders, createPurchaseOrder, receivePurchaseOrder, complaintPurchaseOrder, resolveComplaint, getSuppliers, addSupplier, deleteSupplier, addInventoryItem, getCustomers, addCustomer, createSale, updateSaleStatus, getSales, getDailyProductionCosts, updateDailyCost, getWeeklyRevenue, getLaborRate, setLaborRate, getRawMaterialRate, setRawMaterialRate } from '../services/sheetService';
import { InventoryItem, PurchaseOrder, Customer, FinishedGood, SalesRecord, DailyCostMetrics, Supplier } from '../types';
import { ShoppingCart, AlertTriangle, CheckCircle2, XCircle, Store, FileText, Send, Printer, User, CreditCard, Banknote, Calendar, BarChart3, Truck, Plus, Trash2, Building2, TrendingUp, PieChart, Users, Coins, Clock, Settings, Pencil, Sprout, Receipt, X } from 'lucide-react';

const FinancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'procurement' | 'sales'>('procurement');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([]);
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [dailyCosts, setDailyCosts] = useState<DailyCostMetrics[]>([]);
  const [weeklyRevenue, setWeeklyRevenue] = useState<{date: string, amount: number}[]>([]);
  
  const [laborRate, setLaborRateState] = useState<number>(12.50);
  const [rawRate, setRawRateState] = useState<number>(8.00);
  
  // Modals
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showQCModal, setShowQCModal] = useState<string | null>(null);
  const [showComplaintModal, setShowComplaintModal] = useState<string | null>(null);
  const [showResolutionModal, setShowResolutionModal] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState<SalesRecord | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showRawRateModal, setShowRawRateModal] = useState(false);
  const [showEditCostModal, setShowEditCostModal] = useState(false);

  // Forms
  const [poItem, setPoItem] = useState('');
  const [poQtyPackages, setPoQtyPackages] = useState('1');
  const [complaintReason, setComplaintReason] = useState('');
  
  // Cost Editing
  const [editingCost, setEditingCost] = useState<DailyCostMetrics | null>(null);

  // Supplier Form
  const [newSupplier, setNewSupplier] = useState({ name: '', address: '', contact: '', itemName: '', itemType: 'PACKAGING', packSize: 100, unitCost: 10 });

  // Customer Form
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', contact: '', address: '' });

  const [salesCustomer, setSalesCustomer] = useState('');
  const [salesGood, setSalesGood] = useState('');
  const [salesQty, setSalesQty] = useState('1');
  const [salesPayment, setSalesPayment] = useState<'CASH' | 'COD' | 'CREDIT_CARD'>('CASH');
  const [salesPrice, setSalesPrice] = useState('15.00');
  
  // UX States
  const [isSending, setIsSending] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [hoveredPieIndex, setHoveredPieIndex] = useState<number | null>(null);

  const refreshData = async () => {
    setLaborRateState(getLaborRate());
    setRawRateState(getRawMaterialRate());
    const [inv, po, sup, cust, goods, s, costs, rev] = await Promise.all([getInventory(), getPurchaseOrders(), getSuppliers(), getCustomers(), getFinishedGoods(), getSales(), getDailyProductionCosts(), getWeeklyRevenue()]);
    if (inv.success) setInventory(inv.data || []);
    if (po.success) setPurchaseOrders(po.data || []);
    if (sup.success) setSuppliers(sup.data || []);
    if (cust.success) setCustomers(cust.data || []);
    if (goods.success) setFinishedGoods(goods.data || []);
    if (s.success) setSales(s.data || []);
    if (costs.success) setDailyCosts(costs.data || []);
    setWeeklyRevenue(rev);
  };

  useEffect(() => { refreshData(); }, []);

  const handleUpdateRate = () => {
      setLaborRate(laborRate);
      setShowRateModal(false);
      refreshData();
  };

  const handleUpdateRawRate = () => {
      setRawMaterialRate(rawRate);
      setShowRawRateModal(false);
      refreshData();
  };

  const handleSaveCostEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCost && editingCost.id) {
      await updateDailyCost(editingCost.id, {
        rawMaterialCost: editingCost.rawMaterialCost,
        packagingCost: editingCost.packagingCost,
        laborCost: editingCost.laborCost,
        wastageCost: editingCost.wastageCost
      });
      setShowEditCostModal(false);
      setEditingCost(null);
      refreshData();
    }
  };

  const handleEditCostClick = (cost: DailyCostMetrics) => {
    setEditingCost({ ...cost });
    setShowEditCostModal(true);
  };

  // Aggregation for Sales Dropdown
  const availableGoods = finishedGoods.reduce((acc, curr) => {
     if (curr.quantity <= 0) return acc;
     const key = `${curr.recipeName}|${curr.packagingType}`;
     if (!acc[key]) acc[key] = { 
         key: key,
         id: curr.id, 
         label: `${curr.recipeName} (${curr.packagingType})`, 
         totalQty: 0, 
         price: curr.sellingPrice || 15 
     };
     acc[key].totalQty += curr.quantity;
     return acc;
  }, {} as Record<string, { key: string, id: string, label: string, totalQty: number, price: number }>);

  useEffect(() => {
     if (salesGood && availableGoods[salesGood]) {
         setSalesPrice(availableGoods[salesGood].price.toFixed(2));
     }
  }, [salesGood, finishedGoods]);

  // Procurement Logic
  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    const item = inventory.find(i => i.id === poItem);
    if (!item) return;
    await createPurchaseOrder(item.id, parseInt(poQtyPackages), item.supplier || 'Generic Supplier');
    setShowOrderModal(false); refreshData();
  };

  const handleQC = async (passed: boolean) => {
     if (showQCModal) {
         if (passed) {
             await receivePurchaseOrder(showQCModal, true);
             setShowQCModal(null);
         } else {
             setShowComplaintModal(showQCModal);
             setShowQCModal(null);
         }
         refreshData();
     }
  };

  const handleSubmitComplaint = async () => {
      if (showComplaintModal && complaintReason) {
          await complaintPurchaseOrder(showComplaintModal, complaintReason);
          setShowComplaintModal(null);
          setComplaintReason('');
          refreshData();
      }
  };

  const handleResolveComplaint = async (resolution: string) => {
      if (showResolutionModal) {
          await resolveComplaint(showResolutionModal, resolution);
          setShowResolutionModal(null);
          refreshData();
      }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
      e.preventDefault();
      const supRes = await addSupplier({ id: `sup-${Date.now()}`, name: newSupplier.name, address: newSupplier.address, contact: newSupplier.contact });
      if (supRes.success) {
          await addInventoryItem({
              id: `inv-${Date.now()}`,
              name: newSupplier.itemName,
              type: newSupplier.itemType as any,
              subtype: undefined, 
              quantity: 0,
              threshold: 50,
              unit: 'units',
              unitCost: newSupplier.unitCost,
              supplier: newSupplier.name, 
              packSize: newSupplier.packSize
          });
          setShowSupplierModal(false);
          setNewSupplier({ name: '', address: '', contact: '', itemName: '', itemType: 'PACKAGING', packSize: 100, unitCost: 10 });
          refreshData();
      }
  };

  const handleDeleteSupplier = async (id: string) => {
      if (window.confirm("Are you sure? This will remove the supplier from the list.")) {
          const res = await deleteSupplier(id);
          if (res.success) refreshData();
      }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
      e.preventDefault();
      const res = await addCustomer({ 
          id: `cust-${Date.now()}`, 
          name: newCustomer.name, 
          email: newCustomer.email, 
          contact: newCustomer.contact, 
          address: newCustomer.address 
      });
      if (res.success) {
          setShowCustomerModal(false);
          refreshData();
      }
  };

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salesGood || !salesCustomer) {
        alert("Please select customer and product.");
        return;
    }
    
    // Lookup the correct ID from the selected key group
    const productInfo = availableGoods[salesGood];
    if (!productInfo) {
        alert("Invalid product selection.");
        return;
    }

    const res = await createSale(salesCustomer, productInfo.id, parseInt(salesQty), parseFloat(salesPrice), salesPayment);
    if (res.success && res.data) {
      setShowInvoiceModal(res.data);
      setSalesGood(''); setSalesQty('1');
      refreshData();
    } else {
        alert(res.message);
    }
  };

  const handleMarkDelivered = async (sale: SalesRecord) => {
    const res = await updateSaleStatus(sale.id, 'DELIVERED');
    if (res.success && res.data) {
        refreshData();
        setShowInvoiceModal(res.data);
    }
  };

  const handleEmailClient = () => {
      setIsSending(true);
      setTimeout(() => { setIsSending(false); alert("Email Sent Successfully!"); }, 3000);
  };

  const handlePrint = () => {
      setIsPrinting(true);
      setTimeout(() => { setIsPrinting(false); alert("Printed Successfully!"); }, 3000);
  };

  const lowStockItems = inventory.filter(i => i.quantity < i.threshold);

  const totalRawCost = dailyCosts.reduce((acc, d) => acc + d.rawMaterialCost, 0);
  const totalPkgCost = dailyCosts.reduce((acc, d) => acc + d.packagingCost, 0);
  const totalWastageCost = dailyCosts.reduce((acc, d) => acc + d.wastageCost, 0);
  const totalLaborCost = dailyCosts.reduce((acc, d) => acc + d.laborCost, 0);
  const totalOverallCost = totalRawCost + totalPkgCost + totalWastageCost + totalLaborCost;
  
  const totalSalesRevenue = sales.filter(s => s.status === 'DELIVERED').reduce((acc, s) => acc + s.totalAmount, 0);
  const netProfit = totalSalesRevenue - totalOverallCost;

  const rawPct = totalOverallCost > 0 ? (totalRawCost / totalOverallCost) * 100 : 0;
  const pkgPct = totalOverallCost > 0 ? (totalPkgCost / totalOverallCost) * 100 : 0;
  const wastePct = totalOverallCost > 0 ? (totalWastageCost / totalOverallCost) * 100 : 0;
  const laborPct = totalOverallCost > 0 ? (totalLaborCost / totalOverallCost) * 100 : 0;
  
  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  const createPieSlices = () => {
      let cumulativePercent = 0;
      const data = [
          { label: 'Raw Material', pct: rawPct, color: '#16a34a', cost: totalRawCost },
          { label: 'Packaging', pct: pkgPct, color: '#a18072', cost: totalPkgCost },
          { label: 'Wastage', pct: wastePct, color: '#ef4444', cost: totalWastageCost },
          { label: 'Labor', pct: laborPct, color: '#3b82f6', cost: totalLaborCost },
      ].filter(d => d.pct > 0);

      return data.map((slice, i) => {
          const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
          cumulativePercent += slice.pct / 100;
          const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
          const largeArcFlag = slice.pct / 100 > 0.5 ? 1 : 0;
          const pathData = `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} L 0 0`;
          return { ...slice, pathData, index: i };
      });
  };
  const slices = createPieSlices();
  const maxRevenue = Math.max(...weeklyRevenue.map(r => r.amount), 1);
  const totalUnitsProduced = finishedGoods.reduce((acc, i) => acc + i.quantity, 0);
  const avgCostPerUnit = totalUnitsProduced > 0 ? totalOverallCost / totalUnitsProduced : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
         <h2 className="text-xl font-bold text-slate-800">Finance & Operations</h2>
         <div className="flex bg-slate-100 p-1 rounded-lg">
           {['procurement', 'sales', 'overview'].map(t => (
             <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 capitalize rounded-md text-sm font-bold ${activeTab === t ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>{t}</button>
           ))}
         </div>
      </div>

      {activeTab === 'procurement' && (
        <div className="space-y-8">
           {lowStockItems.length > 0 && (
             <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start animate-pulse">
                <AlertTriangle className="text-red-600 mr-3 mt-1" />
                <div>
                   <h4 className="font-bold text-red-800">Action Required: Low Inventory</h4>
                   <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                      {lowStockItems.map(i => <li key={i.id}><b>{i.name}</b> (Qty: {i.quantity}) - Restock from {i.supplier}</li>)}
                   </ul>
                </div>
             </div>
           )}

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                 <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">Active Orders</h3>
                    <div className="flex space-x-2">
                        <button onClick={() => setShowSupplierModal(true)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold flex items-center hover:bg-slate-200"><Building2 size={18} className="mr-2"/> Manage Suppliers</button>
                        <button onClick={() => setShowOrderModal(true)} className="px-4 py-2 bg-earth-800 text-white rounded-lg font-bold flex items-center shadow-lg hover:bg-earth-900"><ShoppingCart size={18} className="mr-2"/> New Order</button>
                    </div>
                 </div>
                 {purchaseOrders.filter(p => p.status === 'ORDERED').length === 0 && <p className="text-slate-400 text-sm italic">No active orders pending.</p>}
                 {purchaseOrders.filter(p => p.status === 'ORDERED').map(po => (
                     <div key={po.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                        <div>
                           <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase">{po.supplier}</span>
                              <span className="text-xs text-slate-400">{new Date(po.dateOrdered).toLocaleDateString()}</span>
                           </div>
                           <h4 className="font-bold text-slate-800">{po.itemName}</h4>
                           <p className="text-sm text-slate-600">{po.quantity} packs ({po.totalUnits} units) • RM {po.totalCost.toFixed(2)}</p>
                        </div>
                        <div className="flex space-x-2">
                           <button onClick={() => setShowQCModal(po.id)} className="px-3 py-2 bg-green-600 text-white rounded-lg font-bold text-xs hover:bg-green-700 shadow">Received</button>
                        </div>
                     </div>
                 ))}
                 
                 <h3 className="font-bold text-slate-700 mt-8">Active Complaints</h3>
                 {purchaseOrders.filter(p => p.status === 'COMPLAINT').map(po => (
                     <div key={po.id} className="bg-red-50 p-4 rounded-xl border border-red-100 flex justify-between items-center">
                        <div>
                           <h4 className="font-bold text-red-800">{po.supplier} - {po.itemName}</h4>
                           <p className="text-sm text-red-600 font-medium">Issue: {po.complaintReason}</p>
                        </div>
                        <button onClick={() => setShowResolutionModal(po.id)} className="px-3 py-1 bg-white text-red-600 text-xs font-bold rounded border border-red-200 hover:bg-red-100 hover:scale-105 transition-transform shadow-sm">
                            Pending Resolution (Click to Resolve)
                        </button>
                     </div>
                 ))}
              </div>

              <div className="space-y-6">
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                     <h3 className="font-bold text-slate-800 mb-3">Supplier Directory</h3>
                     <div className="space-y-3 text-sm">
                        {suppliers.map(s => (
                           <div key={s.id} className="flex justify-between items-center border-b border-slate-50 pb-2 last:border-0 group">
                              <div><p className="font-bold text-slate-700">{s.name}</p><p className="text-xs text-slate-500">{s.contact}</p></div>
                              <button onClick={() => handleDeleteSupplier(s.id)} className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                           </div>
                        ))}
                     </div>
                  </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'sales' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center"><Store className="mr-2"/> POS Terminal</h3>
              <form onSubmit={handleCreateSale} className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Customer</label>
                    <div className="flex space-x-2">
                        <select className="w-full p-3 border rounded-lg bg-slate-50" value={salesCustomer} onChange={e => setSalesCustomer(e.target.value)} required>
                            <option value="">Select Customer...</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button type="button" onClick={() => setShowCustomerModal(true)} className="p-3 bg-nature-600 text-white rounded-lg hover:bg-nature-700"><Plus size={18}/></button>
                    </div>
                 </div>
                 
                 <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Product</label>
                    <select className="w-full p-3 border rounded-lg bg-slate-50" value={salesGood} onChange={e => setSalesGood(e.target.value)} required>
                        <option value="">Select Product...</option>
                        {Object.values(availableGoods).map((g: { key: string, id: string, label: string, totalQty: number, price: number }) => (
                            <option key={g.key} value={g.key}>
                                {g.label} (Stock: {g.totalQty}) - RM {g.price.toFixed(2)}
                            </option>
                        ))}
                    </select>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Quantity</label>
                        <input type="number" min="1" className="w-full p-3 border rounded-lg" value={salesQty} onChange={e => setSalesQty(e.target.value)} required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Payment</label>
                        <select className="w-full p-3 border rounded-lg bg-slate-50" value={salesPayment} onChange={e => setSalesPayment(e.target.value as any)}>
                            <option value="CASH">Cash</option>
                            <option value="COD">COD</option>
                            <option value="CREDIT_CARD">Card</option>
                        </select>
                    </div>
                 </div>

                 <div className="bg-slate-50 p-4 rounded-lg flex justify-between items-center">
                    <span className="font-bold text-slate-600">Total:</span>
                    <span className="text-xl font-black text-slate-800">
                        RM {salesGood && availableGoods[salesGood] ? (availableGoods[salesGood].price * parseInt(salesQty || '0')).toFixed(2) : '0.00'}
                    </span>
                 </div>

                 <button type="submit" className="w-full py-3 bg-nature-600 text-white rounded-xl font-bold shadow-lg hover:bg-nature-700 transition-colors">Generate Invoice</button>
              </form>
           </div>
           
           <div className="lg:col-span-2 space-y-4">
              <h3 className="font-bold text-slate-700 mb-2">Sales Ledger</h3>
              {sales.length === 0 && <p className="text-slate-400 text-sm italic">No sales recorded.</p>}
              {sales.map(sale => (
                 <div key={sale.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-full ${sale.status === 'DELIVERED' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                           {sale.status === 'DELIVERED' ? <CheckCircle2 size={20}/> : <Truck size={20}/>}
                        </div>
                        <div>
                           <h4 className="font-bold text-slate-800">{sale.customerName}</h4>
                           <p className="text-xs text-slate-500">RM {sale.totalAmount.toFixed(2)} • {new Date(sale.dateCreated).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div className="flex space-x-2">
                        {sale.status === 'INVOICED' && <button onClick={() => handleMarkDelivered(sale)} className="px-4 py-2 bg-blue-50 text-blue-600 font-bold rounded-lg text-xs hover:bg-blue-100">Confirm Delivery</button>}
                        <button onClick={() => setShowInvoiceModal(sale)} className="p-2 text-slate-400 hover:text-slate-600 border rounded-lg hover:bg-slate-50"><FileText size={18}/></button>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'overview' && (
         <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               {/* Summary Cards */}
               <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase">Total Revenue</p>
                  <p className="text-2xl font-black text-green-700">RM {totalSalesRevenue.toFixed(2)}</p>
               </div>
               <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase">Total Cost</p>
                  <p className="text-2xl font-black text-red-700">RM {totalOverallCost.toFixed(2)}</p>
               </div>
               <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase">Net Profit</p>
                  <p className={`text-2xl font-black ${netProfit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>RM {netProfit.toFixed(2)}</p>
               </div>
               <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase">Avg Cost/Unit</p>
                  <p className="text-2xl font-black text-slate-700">RM {avgCostPerUnit.toFixed(2)}</p>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               {/* COST BREAKDOWN PIE */}
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><PieChart className="mr-2"/> Cost Breakdown</h3>
                  <div className="relative w-64 h-64">
                     <svg viewBox="-1.2 -1.2 2.4 2.4" className="w-full h-full transform -rotate-90">
                        {slices.map((slice, i) => (
                           <path
                              key={i}
                              d={slice.pathData}
                              fill={slice.color}
                              className="cursor-pointer transition-all duration-300 hover:opacity-80"
                              onMouseEnter={() => setHoveredPieIndex(i)}
                              onMouseLeave={() => setHoveredPieIndex(null)}
                              stroke="white"
                              strokeWidth="0.02"
                           />
                        ))}
                     </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        {hoveredPieIndex !== null ? (
                            <>
                                <span className="text-xs font-bold text-slate-400">{slices[hoveredPieIndex].label}</span>
                                <span className="text-2xl font-black text-slate-800">{slices[hoveredPieIndex].pct.toFixed(1)}%</span>
                                <span className="text-xs font-medium text-slate-500">RM {slices[hoveredPieIndex].cost.toFixed(2)}</span>
                            </>
                        ) : (
                            <span className="text-xs font-bold text-slate-400">Total Cost<br/>RM {totalOverallCost.toFixed(2)}</span>
                        )}
                     </div>
                  </div>
                  <div className="flex space-x-4 mt-6">
                     {slices.map((slice, i) => (
                        <div key={i} className="flex items-center text-xs font-bold text-slate-600">
                           <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: slice.color }}></div>
                           {slice.label}
                        </div>
                     ))}
                  </div>
               </div>

               {/* REVENUE TREND */}
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><TrendingUp className="mr-2"/> Revenue Trend (7 Days)</h3>
                  <div className="h-64 flex items-end justify-between space-x-2">
                     {weeklyRevenue.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center group">
                            <div className="w-full bg-green-100 rounded-t-lg relative transition-all duration-500 hover:bg-green-200" style={{ height: `${(d.amount / maxRevenue) * 100}%`, minHeight: '4px' }}>
                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                    RM{d.amount}
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 mt-2">{d.date.slice(5)}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            {/* DAILY COST TABLE */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Daily Production Cost Log (Batch-by-Batch)</h3>
                    <div className="flex space-x-2">
                        <button 
                            onClick={() => setShowRawRateModal(true)} 
                            className="text-xs flex items-center bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors font-bold"
                        >
                            <Sprout size={14} className="mr-1.5" /> Raw Rate: RM {rawRate.toFixed(2)}/kg
                        </button>
                        <button 
                            onClick={() => setShowRateModal(true)} 
                            className="text-xs flex items-center bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors font-bold"
                        >
                            <Clock size={14} className="mr-1.5" /> Labor Rate: RM {laborRate.toFixed(2)}/hr
                        </button>
                    </div>
                </div>
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                        <tr>
                            <th className="px-6 py-3">Date / Batch</th>
                            <th className="px-6 py-3">Processed (Kg)</th>
                            <th className="px-6 py-3">Raw Material</th>
                            <th className="px-6 py-3">Packaging</th>
                            <th className="px-6 py-3 text-blue-600">Labor ({laborRate}/hr)</th>
                            <th className="px-6 py-3 text-red-600">Wastage</th>
                            <th className="px-6 py-3 text-right">Total Cost</th>
                            <th className="px-6 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {dailyCosts.map((d, i) => (
                            <tr key={i} className="hover:bg-slate-50 group">
                                <td className="px-6 py-3 font-medium text-slate-700">
                                    {d.date}
                                    <span className="block text-xs text-slate-400 font-mono mt-0.5">{d.referenceId}</span>
                                </td>
                                <td className="px-6 py-3">
                                    {d.weightProcessed > 0 ? `${d.weightProcessed} kg` : '-'}
                                    {d.processingHours > 0 && <span className="text-xs text-slate-400 block">{d.processingHours} hrs</span>}
                                </td>
                                <td className="px-6 py-3 text-green-700">{d.rawMaterialCost > 0 ? `RM ${d.rawMaterialCost.toFixed(2)}` : '-'}</td>
                                <td className="px-6 py-3 text-earth-700">{d.packagingCost > 0 ? `RM ${d.packagingCost.toFixed(2)}` : '-'}</td>
                                <td className="px-6 py-3 text-blue-600 font-medium">{d.laborCost > 0 ? `RM ${d.laborCost.toFixed(2)}` : '-'}</td>
                                <td className="px-6 py-3 text-red-600 font-bold">{d.wastageCost > 0 ? `RM ${d.wastageCost.toFixed(2)}` : '-'}</td>
                                <td className="px-6 py-3 text-right font-bold text-slate-800">RM {d.totalCost.toFixed(2)}</td>
                                <td className="px-6 py-3 text-right">
                                    <button 
                                      onClick={() => handleEditCostClick(d)}
                                      className="p-1 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
         </div>
      )}

      {/* --- ALL MODALS --- */}

      {/* MODAL: NEW PURCHASE ORDER */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center"><ShoppingCart className="mr-2 text-earth-600"/> New Purchase Order</h3>
                <form onSubmit={handleCreatePO} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Select Item</label>
                        <select className="w-full p-2 border rounded" value={poItem} onChange={e => setPoItem(e.target.value)} required>
                            <option value="">Select Item...</option>
                            {inventory.map(i => {
                                const isLow = i.quantity < (i.threshold || 0);
                                return (
                                    <option 
                                        key={i.id} 
                                        value={i.id} 
                                        className={isLow ? "text-red-600 font-bold bg-red-50" : "text-slate-700"}
                                    >
                                        {i.name} {isLow ? '(Low Stock!)' : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Quantity (Packs)</label>
                        <input type="number" min="1" className="w-full p-2 border rounded" value={poQtyPackages} onChange={e => setPoQtyPackages(e.target.value)} required />
                        {poItem && (() => {
                            const i = inventory.find(x => x.id === poItem);
                            return i ? <p className="text-xs text-slate-400 mt-1">1 Pack = {i.packSize} units. Total: {parseInt(poQtyPackages||'0') * (i.packSize||1)} units.</p> : null;
                        })()}
                    </div>
                    <div className="flex space-x-3 pt-2">
                        <button type="button" onClick={() => setShowOrderModal(false)} className="flex-1 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" className="flex-1 py-2 bg-earth-800 text-white font-bold rounded-lg hover:bg-earth-900">Place Order</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* MODAL: MANAGE SUPPLIERS */}
      {showSupplierModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                  <h3 className="font-bold text-lg mb-4 flex items-center"><Building2 className="mr-2 text-blue-600"/> Manage Suppliers</h3>
                  
                  <form onSubmit={handleAddSupplier} className="space-y-4 border-b border-slate-100 pb-6 mb-4">
                      <h4 className="text-sm font-bold text-slate-700 uppercase">Add New Supplier & Item</h4>
                      <input placeholder="Supplier Name" className="w-full p-2 border rounded text-sm" required value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} />
                      <input placeholder="Contact (Email/Phone)" className="w-full p-2 border rounded text-sm" value={newSupplier.contact} onChange={e => setNewSupplier({...newSupplier, contact: e.target.value})} />
                      <input placeholder="Address" className="w-full p-2 border rounded text-sm" value={newSupplier.address} onChange={e => setNewSupplier({...newSupplier, address: e.target.value})} />
                      
                      <div className="bg-slate-50 p-3 rounded-lg space-y-3">
                          <p className="text-xs font-bold text-slate-500">Primary Item Supplied</p>
                          <input placeholder="Item Name (e.g. Red Pouch)" className="w-full p-2 border rounded text-sm bg-white" required value={newSupplier.itemName} onChange={e => setNewSupplier({...newSupplier, itemName: e.target.value})} />
                          <div className="grid grid-cols-2 gap-2">
                              <select className="p-2 border rounded text-sm bg-white" value={newSupplier.itemType} onChange={e => setNewSupplier({...newSupplier, itemType: e.target.value})}>
                                  <option value="PACKAGING">Packaging</option>
                                  <option value="LABEL">Label</option>
                              </select>
                              <input type="number" placeholder="Pack Size" className="p-2 border rounded text-sm bg-white" value={newSupplier.packSize} onChange={e => setNewSupplier({...newSupplier, packSize: parseInt(e.target.value)})} />
                          </div>
                          <input type="number" placeholder="Cost per Pack (RM)" className="w-full p-2 border rounded text-sm bg-white" required value={newSupplier.unitCost} onChange={e => setNewSupplier({...newSupplier, unitCost: parseFloat(e.target.value)})} />
                      </div>

                      <button type="submit" className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-sm">Register Supplier & Item</button>
                  </form>

                  <button onClick={() => setShowSupplierModal(false)} className="w-full text-sm text-slate-500">Close</button>
              </div>
          </div>
      )}

      {/* MODAL: QC RECEIVE */}
      {showQCModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full text-center">
                  <h3 className="font-bold text-lg mb-2">Confirm Receipt</h3>
                  <p className="text-slate-500 text-sm mb-6">Did the shipment pass quality control?</p>
                  <div className="flex space-x-3">
                      <button onClick={() => handleQC(false)} className="flex-1 py-3 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200">QC Failed</button>
                      <button onClick={() => handleQC(true)} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700">QC Passed</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: COMPLAINT */}
      {showComplaintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full">
                  <h3 className="font-bold text-lg mb-4 text-red-600 flex items-center"><AlertTriangle className="mr-2"/> Log Complaint</h3>
                  <textarea 
                    className="w-full p-3 border border-red-200 rounded-lg bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 h-32" 
                    placeholder="Describe the issue (e.g. Damaged boxes, wrong item)..."
                    value={complaintReason}
                    onChange={e => setComplaintReason(e.target.value)}
                  />
                  <div className="flex space-x-3 mt-4">
                      <button onClick={() => setShowComplaintModal(null)} className="flex-1 py-2 text-slate-500 font-bold">Cancel</button>
                      <button onClick={handleSubmitComplaint} className="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700">Submit</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: RESOLVE COMPLAINT */}
      {showResolutionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full">
                  <h3 className="font-bold text-lg mb-4">Resolve Complaint</h3>
                  <p className="text-sm text-slate-500 mb-4">How was this issue resolved?</p>
                  <div className="space-y-2">
                      <button onClick={() => handleResolveComplaint("Replacement Received")} className="w-full p-3 bg-green-50 text-green-700 font-bold rounded-lg hover:bg-green-100 text-left">Replacement Received</button>
                      <button onClick={() => handleResolveComplaint("Refund Processed")} className="w-full p-3 bg-blue-50 text-blue-700 font-bold rounded-lg hover:bg-blue-100 text-left">Refund Processed</button>
                      <button onClick={() => handleResolveComplaint("Closed (No Action)")} className="w-full p-3 bg-slate-50 text-slate-700 font-bold rounded-lg hover:bg-slate-100 text-left">Close Ticket</button>
                  </div>
                  <button onClick={() => setShowResolutionModal(null)} className="mt-4 w-full text-sm text-slate-400">Cancel</button>
              </div>
          </div>
      )}

      {/* MODAL: INVOICE */}
      {showInvoiceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="bg-slate-900 text-white p-6 flex justify-between items-start">
                      <div>
                          <h2 className="text-xl font-bold flex items-center"><Receipt className="mr-2"/> Invoice</h2>
                          <p className="text-slate-400 text-sm mt-1">#{showInvoiceModal.invoiceId}</p>
                      </div>
                      <button onClick={() => setShowInvoiceModal(null)}><X className="text-slate-400 hover:text-white"/></button>
                  </div>
                  <div className="p-6 overflow-y-auto">
                      <div className="flex justify-between mb-6">
                          <div>
                              <p className="text-xs font-bold text-slate-400 uppercase">Billed To</p>
                              <p className="font-bold text-slate-800">{showInvoiceModal.customerName}</p>
                              <p className="text-sm text-slate-500">{showInvoiceModal.customerEmail}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-xs font-bold text-slate-400 uppercase">Date</p>
                              <p className="font-medium text-slate-800">{new Date(showInvoiceModal.dateCreated).toLocaleDateString()}</p>
                              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold ${showInvoiceModal.status === 'DELIVERED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{showInvoiceModal.status}</span>
                          </div>
                      </div>
                      
                      <div className="border-t border-b border-slate-100 py-4 mb-4 space-y-3">
                          {showInvoiceModal.items.map((item, i) => (
                              <div key={i} className="flex justify-between items-center text-sm">
                                  <div>
                                      <p className="font-bold text-slate-700">{item.recipeName} ({item.packagingType})</p>
                                      <p className="text-slate-400">{item.quantity} x RM {item.unitPrice.toFixed(2)}</p>
                                  </div>
                                  <p className="font-bold text-slate-800">RM {(item.quantity * item.unitPrice).toFixed(2)}</p>
                              </div>
                          ))}
                      </div>
                      
                      <div className="flex justify-between items-center mb-8">
                          <span className="font-bold text-xl text-slate-800">Total</span>
                          <span className="font-black text-2xl text-slate-900">RM {showInvoiceModal.totalAmount.toFixed(2)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                          <button onClick={handleEmailClient} className="py-3 border border-slate-200 rounded-lg font-bold text-slate-600 flex items-center justify-center hover:bg-slate-50">
                              {isSending ? 'Sending...' : <><Send size={18} className="mr-2"/> Email</>}
                          </button>
                          <button onClick={handlePrint} className="py-3 bg-slate-900 text-white rounded-lg font-bold flex items-center justify-center hover:bg-slate-800">
                              {isPrinting ? 'Printing...' : <><Printer size={18} className="mr-2"/> Print</>}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: EDIT COST */}
      {showEditCostModal && editingCost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center"><Pencil className="mr-2 text-blue-600"/> Edit Transaction</h3>
                <p className="text-sm text-slate-500 mb-4 font-mono font-bold">{editingCost.referenceId}</p>
                <form onSubmit={handleSaveCostEdit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Raw Material (RM)</label>
                        <input type="number" step="0.01" className="w-full p-2 border rounded" value={editingCost.rawMaterialCost} onChange={e => setEditingCost({...editingCost, rawMaterialCost: parseFloat(e.target.value)})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Packaging (RM)</label>
                        <input type="number" step="0.01" className="w-full p-2 border rounded" value={editingCost.packagingCost} onChange={e => setEditingCost({...editingCost, packagingCost: parseFloat(e.target.value)})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Labor (RM)</label>
                        <input type="number" step="0.01" className="w-full p-2 border rounded" value={editingCost.laborCost} onChange={e => setEditingCost({...editingCost, laborCost: parseFloat(e.target.value)})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Wastage (RM)</label>
                        <input type="number" step="0.01" className="w-full p-2 border rounded" value={editingCost.wastageCost} onChange={e => setEditingCost({...editingCost, wastageCost: parseFloat(e.target.value)})} />
                    </div>
                    
                    <div className="flex space-x-3 pt-3">
                        <button type="button" onClick={() => setShowEditCostModal(false)} className="flex-1 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* MODAL: EDIT LABOR RATE */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center"><Clock className="mr-2 text-blue-600"/> Edit Labor Rate</h3>
                <p className="text-sm text-slate-500 mb-4">Set the hourly cost for processing workers.</p>
                <label className="block text-xs font-bold text-slate-500 mb-1">Hourly Rate (RM)</label>
                <div className="relative mb-6">
                    <span className="absolute left-3 top-3 text-slate-400 font-bold">RM</span>
                    <input 
                        type="number" 
                        step="0.50" 
                        className="w-full p-3 pl-10 border rounded-lg text-lg font-bold" 
                        value={laborRate} 
                        onChange={e => setLaborRateState(parseFloat(e.target.value))} 
                    />
                </div>
                <div className="flex space-x-3">
                    <button onClick={() => setShowRateModal(false)} className="flex-1 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                    <button onClick={handleUpdateRate} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Save Rate</button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL: EDIT RAW RATE */}
      {showRawRateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center"><Sprout className="mr-2 text-green-600"/> Edit Raw Material Rate</h3>
                <p className="text-sm text-slate-500 mb-4">Set the cost per KG for incoming mushrooms.</p>
                <label className="block text-xs font-bold text-slate-500 mb-1">Rate per KG (RM)</label>
                <div className="relative mb-6">
                    <span className="absolute left-3 top-3 text-slate-400 font-bold">RM</span>
                    <input 
                        type="number" 
                        step="0.50" 
                        className="w-full p-3 pl-10 border rounded-lg text-lg font-bold" 
                        value={rawRate} 
                        onChange={e => setRawRateState(parseFloat(e.target.value))} 
                    />
                </div>
                <div className="flex space-x-3">
                    <button onClick={() => setShowRawRateModal(false)} className="flex-1 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                    <button onClick={handleUpdateRawRate} className="flex-1 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700">Save Rate</button>
                </div>
            </div>
        </div>
      )}
      
      {/* MODAL: ADD CUSTOMER */}
      {showCustomerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full">
                  <h3 className="font-bold text-lg mb-4 flex items-center"><User className="mr-2 text-blue-600"/> Add Customer</h3>
                  <form onSubmit={handleAddCustomer} className="space-y-3">
                      <input placeholder="Customer Name" className="w-full p-2 border rounded" required value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                      <input placeholder="Email" className="w-full p-2 border rounded" required value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} />
                      <input placeholder="Phone" className="w-full p-2 border rounded" value={newCustomer.contact} onChange={e => setNewCustomer({...newCustomer, contact: e.target.value})} />
                      <input placeholder="Address" className="w-full p-2 border rounded" value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} />
                      <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 mt-2">Register Customer</button>
                  </form>
                  <button onClick={() => setShowCustomerModal(false)} className="mt-3 w-full text-sm text-slate-500">Cancel</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default FinancePage;
