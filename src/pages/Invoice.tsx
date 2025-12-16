import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2, FileText } from "lucide-react";

const Invoice = () => {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get("order");
  const invoiceType = searchParams.get("type"); // "customer" for customer_purchases, default is pending_orders
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (invoiceType === "customer") {
          // Fetch customer purchase by storehub_invoice or purchase ID
          let query = supabase
            .from("customer_purchases")
            .select(`
              *,
              customer:customers(name, phone, address, state, postcode, city),
              product:products(name, sku)
            `);

          // Try to find by storehub_invoice first, then by ID
          if (orderNumber?.startsWith("SH-")) {
            // StoreHub invoice format
            const invoiceNum = orderNumber.replace("SH-", "");
            query = query.eq("storehub_invoice", invoiceNum);
          } else {
            // Direct purchase ID or generated order number
            query = query.eq("id", orderNumber);
          }

          const { data: purchases, error } = await query;

          if (error) throw error;
          if (!purchases || purchases.length === 0) {
            setOrderData(null);
            return;
          }

          // Group all items for this invoice
          const firstPurchase = purchases[0];
          const allProducts = purchases.map((p: any) => ({
            name: p.product?.name || p.storehub_product || "Unknown Product",
            quantity: p.quantity,
            unit_price: p.unit_price,
            total_price: p.total_price,
          }));

          setOrderData({
            type: "customer",
            order_number: orderNumber,
            storehub_invoice: firstPurchase.storehub_invoice,
            created_at: firstPurchase.date_order || firstPurchase.created_at,
            status: "completed",
            customer: firstPurchase.customer,
            payment_method: firstPurchase.payment_method,
            platform: firstPurchase.platform,
            closing_type: firstPurchase.closing_type,
            tracking_number: firstPurchase.tracking_number,
            total_price: firstPurchase.transaction_total || purchases.reduce((sum: number, p: any) => sum + (Number(p.total_price) || 0), 0),
            products: allProducts,
            total_quantity: purchases.reduce((sum: number, p: any) => sum + (p.quantity || 0), 0),
          });
        } else {
          // Original pending_orders fetch
          const { data: order, error: orderError } = await supabase
            .from("pending_orders")
            .select("*")
            .eq("order_number", orderNumber)
            .single();

          if (orderError) throw orderError;
          if (!order) {
            setOrderData(null);
            return;
          }

          // Fetch related data separately
          const [
            { data: buyer },
            { data: product },
            { data: bundle }
          ] = await Promise.all([
            supabase
              .from("profiles")
              .select("full_name, email, phone_number, whatsapp_number, delivery_address, idstaff")
              .eq("id", order.buyer_id)
              .single(),
            supabase
              .from("products")
              .select("name, sku, description")
              .eq("id", order.product_id)
              .single(),
            order.bundle_id
              ? supabase
                  .from("bundles")
                  .select("name, units")
                  .eq("id", order.bundle_id)
                  .single()
              : Promise.resolve({ data: null })
          ]);

          setOrderData({
            type: "pending_order",
            ...order,
            buyer,
            product,
            bundle
          });
        }
      } catch (error) {
        console.error("Error fetching invoice data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (orderNumber) {
      fetchData();
    }
  }, [orderNumber, invoiceType]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800">Invoice Not Found</h2>
          <p className="text-gray-600 mt-2">Order number: {orderNumber}</p>
        </div>
      </div>
    );
  }

  // Render Customer Purchase Invoice
  if (orderData.type === "customer") {
    return (
      <div className="min-h-screen bg-white p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8 pb-8 border-b-2 border-gray-200">
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">OLIVE JARDIN SDN BHD (1579025-U)</h2>
                <p className="text-sm text-gray-700 mt-1">No. 897, Jalan Dato Pati, 15000 Kota Bharu, Kelantan</p>
                <p className="text-sm text-gray-700">Tel: 010-262 8508 / 012-343 8508</p>
                <p className="text-sm text-gray-700">Email: olivejardin8008@gmail.com</p>
                <p className="text-sm text-gray-700">Website: olivejardin.com</p>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">INVOICE</h1>
              <p className="text-gray-600 mt-1">
                Order #{orderData.storehub_invoice || orderData.order_number}
              </p>
            </div>
            <div className="sm:text-right">
              <div className="inline-block px-4 py-2 rounded-lg bg-green-50 mb-4">
                <span className="font-bold text-lg uppercase text-green-600">
                  COMPLETED
                </span>
              </div>
              <p className="text-sm text-gray-600">Invoice Date</p>
              <p className="text-lg font-semibold text-gray-900">
                {format(new Date(orderData.created_at), "dd MMMM yyyy")}
              </p>
              <p className="text-sm text-gray-600 mt-2">Platform</p>
              <p className="text-sm font-medium text-gray-700">
                {orderData.platform || "Manual"}
              </p>
            </div>
          </div>

          {/* Billing Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 mb-8">
            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">Bill To</h2>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-bold text-lg text-gray-900">
                  {orderData.customer?.name?.toUpperCase() || "WALK-IN CUSTOMER"}
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  Phone: {orderData.customer?.phone || "-"}
                </p>
                {orderData.customer?.address && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Delivery Address</p>
                    <p className="text-sm text-gray-700">{orderData.customer.address}</p>
                    {orderData.customer.postcode && (
                      <p className="text-sm text-gray-700">
                        {orderData.customer.postcode} {orderData.customer.city}
                      </p>
                    )}
                    <p className="text-sm text-gray-700">{orderData.customer.state}</p>
                  </div>
                )}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">Payment Information</h2>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Payment Method</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {orderData.payment_method || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Platform</span>
                    <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                      orderData.platform === "Facebook"
                        ? "bg-blue-100 text-blue-800"
                        : orderData.platform === "Tiktok HQ"
                        ? "bg-pink-100 text-pink-800"
                        : orderData.platform === "Shopee HQ"
                        ? "bg-orange-100 text-orange-800"
                        : orderData.platform === "Database"
                        ? "bg-purple-100 text-purple-800"
                        : orderData.platform === "Google"
                        ? "bg-green-100 text-green-800"
                        : orderData.platform === "StoreHub"
                        ? "bg-cyan-100 text-cyan-800"
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {orderData.platform || "Manual"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Closing Type</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {orderData.closing_type || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className="text-sm font-bold uppercase text-green-600">COMPLETED</span>
                  </div>
                  {orderData.tracking_number && (
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Tracking No.</span>
                      <span className="text-xs font-mono text-gray-700">
                        {orderData.tracking_number}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">Order Details</h2>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full min-w-[500px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Product</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Quantity</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Unit Price</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {orderData.products.map((product: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-4 px-4">
                        <p className="font-semibold text-gray-900">{product.name}</p>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-semibold">
                          {product.quantity}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-gray-900">
                        RM {parseFloat(product.unit_price || 0).toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-gray-900">
                        RM {parseFloat(product.total_price || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Total Summary */}
          <div className="flex justify-end mb-8">
            <div className="w-full sm:w-80">
              <div className="bg-gray-50 rounded-lg p-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">
                    RM {parseFloat(orderData.total_price || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax (0%)</span>
                  <span className="font-semibold text-gray-900">RM 0.00</span>
                </div>
                <div className="border-t border-gray-300 pt-3 flex justify-between">
                  <span className="text-lg font-bold text-gray-900">Total Amount</span>
                  <span className="text-2xl font-bold text-blue-600">
                    RM {parseFloat(orderData.total_price || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t-2 border-gray-200 pt-6 mt-8">
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">Thank you for your business!</p>
              <p className="text-xs text-gray-500">
                This is a computer-generated invoice and does not require a signature.
              </p>
              <p className="text-xs text-gray-400 mt-4">
                Generated on {format(new Date(), "dd MMMM yyyy 'at' HH:mm")}
              </p>
            </div>
          </div>

          {/* Print Button - Hidden when printing */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center print:hidden">
            <button
              onClick={() => window.print()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg shadow-lg transition-colors"
            >
              Print Invoice
            </button>
            <button
              onClick={() => window.close()}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-8 py-3 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Print-specific styles */}
        <style>{`
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print\\:hidden {
              display: none !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // Original Pending Order Invoice render
  const statusColor = orderData.status === 'completed' ? 'text-green-600' :
                      orderData.status === 'failed' ? 'text-red-600' :
                      'text-yellow-600';

  const statusBg = orderData.status === 'completed' ? 'bg-green-50' :
                   orderData.status === 'failed' ? 'bg-red-50' :
                   'bg-yellow-50';

  return (
    <div className="min-h-screen bg-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8 pb-8 border-b-2 border-gray-200">
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">OLIVE JARDIN SDN BHD (1579025-U)</h2>
              <p className="text-sm text-gray-700 mt-1">No. 897, Jalan Dato Pati, 15000 Kota Bharu, Kelantan</p>
              <p className="text-sm text-gray-700">Tel: 010-262 8508 / 012-343 8508</p>
              <p className="text-sm text-gray-700">Email: olivejardin8008@gmail.com</p>
              <p className="text-sm text-gray-700">Website: olivejardin.com</p>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">INVOICE</h1>
            <p className="text-gray-600 mt-1">Order #{orderData.order_number}</p>
          </div>
          <div className="sm:text-right">
            <div className={`inline-block px-4 py-2 rounded-lg ${statusBg} mb-4`}>
              <span className={`font-bold text-lg uppercase ${statusColor}`}>
                {orderData.status}
              </span>
            </div>
            <p className="text-sm text-gray-600">Invoice Date</p>
            <p className="text-lg font-semibold text-gray-900">
              {format(new Date(orderData.created_at), "dd MMMM yyyy")}
            </p>
            <p className="text-sm text-gray-600 mt-2">Transaction ID</p>
            <p className="text-xs font-mono text-gray-700">
              {orderData.transaction_id || orderData.billplz_bill_id || "-"}
            </p>
          </div>
        </div>

        {/* Billing Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 mb-8">
          <div>
            <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">Bill To</h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-bold text-lg text-gray-900">{orderData.buyer?.full_name || "N/A"}</p>
              <p className="text-sm text-gray-600 mt-1">ID: {orderData.buyer?.idstaff || "N/A"}</p>
              <p className="text-sm text-gray-700 mt-2">{orderData.buyer?.email || "N/A"}</p>
              {orderData.buyer?.phone_number && (
                <p className="text-sm text-gray-700">Phone: {orderData.buyer.phone_number}</p>
              )}
              {orderData.buyer?.whatsapp_number && (
                <p className="text-sm text-gray-700">WhatsApp: {orderData.buyer.whatsapp_number}</p>
              )}
              {orderData.buyer?.delivery_address && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Delivery Address</p>
                  <p className="text-sm text-gray-700">{orderData.buyer.delivery_address}</p>
                </div>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">Payment Information</h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Payment Method</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {orderData.payment_method === 'manual'
                      ? orderData.payment_type || 'Manual Payment'
                      : 'Billplz FPX'}
                  </span>
                </div>
                {orderData.billplz_bill_id && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Bill ID</span>
                    <span className="text-xs font-mono text-gray-700">{orderData.billplz_bill_id}</span>
                  </div>
                )}
                {orderData.payment_method === 'manual' && orderData.bank_name && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Bank Name</span>
                    <span className="text-sm text-gray-700">{orderData.bank_name}</span>
                  </div>
                )}
                {orderData.payment_method === 'manual' && orderData.payment_date && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Payment Date</span>
                    <span className="text-sm text-gray-700">
                      {format(new Date(orderData.payment_date), "dd/MM/yyyy")}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <span className={`text-sm font-bold uppercase ${statusColor}`}>{orderData.status}</span>
                </div>
                {orderData.updated_at && (
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="text-sm text-gray-600">Last Updated</span>
                    <span className="text-xs text-gray-700">
                      {format(new Date(orderData.updated_at), "dd/MM/yyyy HH:mm")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">Order Details</h2>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Product</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Bundle</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Quantity</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Unit Price</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                <tr className="border-b border-gray-100">
                  <td className="py-4 px-4">
                    <p className="font-semibold text-gray-900">{orderData.product?.name || "N/A"}</p>
                    {orderData.product?.sku && (
                      <p className="text-xs text-gray-500">SKU: {orderData.product.sku}</p>
                    )}
                    {orderData.product?.description && (
                      <p className="text-xs text-gray-600 mt-1">{orderData.product.description}</p>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <p className="font-medium text-gray-900">{orderData.bundle?.name || "-"}</p>
                    {orderData.bundle?.units && (
                      <p className="text-xs text-gray-500">{orderData.bundle.units} units per bundle</p>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-semibold">
                      {orderData.quantity}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-medium text-gray-900">
                    RM {parseFloat(orderData.unit_price).toFixed(2)}
                  </td>
                  <td className="py-4 px-4 text-right font-bold text-gray-900">
                    RM {parseFloat(orderData.total_price).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Total Summary */}
        <div className="flex justify-end mb-8">
          <div className="w-full sm:w-80">
            <div className="bg-gray-50 rounded-lg p-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold text-gray-900">
                  RM {parseFloat(orderData.total_price).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax (0%)</span>
                <span className="font-semibold text-gray-900">RM 0.00</span>
              </div>
              <div className="border-t border-gray-300 pt-3 flex justify-between">
                <span className="text-lg font-bold text-gray-900">Total Amount</span>
                <span className="text-2xl font-bold text-blue-600">
                  RM {parseFloat(orderData.total_price).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-gray-200 pt-6 mt-8">
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">Thank you for your business!</p>
            <p className="text-xs text-gray-500">
              This is a computer-generated invoice and does not require a signature.
            </p>
            <p className="text-xs text-gray-400 mt-4">
              Generated on {format(new Date(), "dd MMMM yyyy 'at' HH:mm")}
            </p>
          </div>
        </div>

        {/* Print Button - Hidden when printing */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center print:hidden">
          <button
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg shadow-lg transition-colors"
          >
            Print Invoice
          </button>
          <button
            onClick={() => window.close()}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Invoice;
