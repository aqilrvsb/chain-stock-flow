import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Users, ShoppingCart, DollarSign, Package, Plus, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import AddCustomerModal, { CustomerPurchaseData } from "./AddCustomerModal";

interface CustomersProps {
  userType: "master_agent" | "agent" | "branch";
}

const Customers = ({ userType }: CustomersProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [closingTypeFilter, setClosingTypeFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch profile for StoreHub credentials (Branch only)
  const { data: profile } = useQuery({
    queryKey: ["profile-storehub", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("storehub_username, storehub_password")
        .eq("id", user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: userType === "branch" && !!user?.id,
  });

  // Fetch products for the dropdown
  const { data: products } = useQuery({
    queryKey: ["products-for-customer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch customer purchases
  const { data: purchases, isLoading } = useQuery({
    queryKey: ["customer_purchases", user?.id, startDate, endDate, paymentFilter, closingTypeFilter],
    queryFn: async () => {
      let query = supabase
        .from("customer_purchases")
        .select(`
          *,
          customer:customers(name, phone, address, state),
          product:products(name, sku)
        `)
        .eq("seller_id", user?.id)
        .order("created_at", { ascending: false });

      if (startDate) {
        query = query.gte("created_at", startDate + 'T00:00:00.000Z');
      }
      if (endDate) {
        query = query.lte("created_at", endDate + 'T23:59:59.999Z');
      }
      if (paymentFilter !== "all") {
        query = query.eq("payment_method", paymentFilter);
      }
      if (closingTypeFilter !== "all") {
        query = query.eq("closing_type", closingTypeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Calculate statistics - exclude products named "COD" from stats
  const filteredPurchases = purchases?.filter(p => {
    const productName = p.product?.name || p.storehub_product || "";
    return !productName.toUpperCase().includes("COD");
  }) || [];
  const totalCustomers = new Set(filteredPurchases.map(p => p.customer_id)).size || 0;
  const totalUnitsPurchased = filteredPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0) || 0;

  // For Total Revenue: Use transaction_total (StoreHub invoice total) when available
  // Group by invoice and sum unique transaction totals to match StoreHub exactly
  const invoiceTotals = new Map<string, number>();
  (purchases || []).forEach((p: any) => {
    // Extract invoice number from StoreHub remarks or storehub_invoice field
    const invoiceMatch = p.remarks?.match(/^StoreHub: ([^-]+)/);
    const invoiceNumber = p.storehub_invoice || (invoiceMatch ? invoiceMatch[1] : null);

    if (invoiceNumber && p.transaction_total) {
      // StoreHub transaction - use transaction_total (only count once per invoice)
      if (!invoiceTotals.has(invoiceNumber)) {
        invoiceTotals.set(invoiceNumber, Number(p.transaction_total) || 0);
      }
    } else if (!invoiceNumber) {
      // Manual entry - use total_price and unique ID
      const productName = p.product?.name || p.storehub_product || "";
      if (!productName.toUpperCase().includes("COD")) {
        invoiceTotals.set(p.id, Number(p.total_price) || 0);
      }
    }
  });

  // For StoreHub entries without transaction_total (old data), fall back to summing item prices
  const storehubInvoicesWithTotal = new Set(
    (purchases || []).filter((p: any) => p.transaction_total).map((p: any) => {
      const match = p.remarks?.match(/^StoreHub: ([^-]+)/);
      return p.storehub_invoice || (match ? match[1] : null);
    }).filter(Boolean)
  );

  // Add item prices for StoreHub entries without transaction_total
  filteredPurchases.forEach((p: any) => {
    const invoiceMatch = p.remarks?.match(/^StoreHub: ([^-]+)/);
    const invoiceNumber = p.storehub_invoice || (invoiceMatch ? invoiceMatch[1] : null);
    if (invoiceNumber && !storehubInvoicesWithTotal.has(invoiceNumber)) {
      // Old StoreHub data without transaction_total - sum item prices
      const currentTotal = invoiceTotals.get(invoiceNumber) || 0;
      invoiceTotals.set(invoiceNumber, currentTotal + (Number(p.total_price) || 0));
    }
  });

  const totalPrice = Array.from(invoiceTotals.values()).reduce((sum, val) => sum + val, 0);

  // Group purchases by invoice for display (one row per transaction)
  const groupedPurchases = (() => {
    const grouped = new Map<string, any>();

    (purchases || []).forEach((p: any) => {
      // Extract invoice number from StoreHub remarks or storehub_invoice field
      const invoiceMatch = p.remarks?.match(/^StoreHub: ([^-]+)/);
      const invoiceNumber = p.storehub_invoice || (invoiceMatch ? invoiceMatch[1] : null);

      // Skip COD products
      const productName = p.product?.name || p.storehub_product || "";
      if (productName.toUpperCase().includes("COD")) return;

      const key = invoiceNumber || p.id; // Use invoice for StoreHub, or purchase ID for manual

      if (!grouped.has(key)) {
        // First item for this invoice - create new entry
        grouped.set(key, {
          id: p.id,
          invoiceNumber: invoiceNumber,
          created_at: p.created_at,
          customer: p.customer,
          payment_method: p.payment_method,
          closing_type: p.closing_type,
          tracking_number: p.tracking_number,
          platform: p.platform || "Manual",
          // For StoreHub: use transaction_total, for manual: use total_price
          total_price: p.transaction_total || p.total_price,
          // Combine product names
          products: [productName],
          // Sum quantities
          total_quantity: p.quantity || 0,
        });
      } else {
        // Additional item for same invoice - aggregate
        const existing = grouped.get(key);
        existing.products.push(productName);
        existing.total_quantity += p.quantity || 0;
        // Don't add to total_price if we have transaction_total (it's already the full amount)
        if (!p.transaction_total) {
          existing.total_price = (Number(existing.total_price) || 0) + (Number(p.total_price) || 0);
        }
      }
    });

    // Convert to array and sort by date descending
    return Array.from(grouped.values()).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  })();

  // Count unique transactions (by invoice number from remarks) to match StoreHub
  const totalTransactions = groupedPurchases.length;

  const stats = [
    {
      title: "Total Customers",
      value: totalCustomers,
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Total Transactions",
      value: totalTransactions,
      icon: ShoppingCart,
      color: "text-purple-600",
    },
    {
      title: "Total Units Sold",
      value: totalUnitsPurchased,
      icon: Package,
      color: "text-emerald-600",
    },
    {
      title: "Total Revenue",
      value: `RM ${totalPrice.toFixed(2)}`,
      icon: DollarSign,
      color: "text-green-600",
    },
  ];

  // Fetch NinjaVan config for Branch
  const { data: ninjavanConfig } = useQuery({
    queryKey: ["ninjavan-config", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ninjavan_config")
        .select("*")
        .eq("profile_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: userType === "branch" && !!user?.id,
  });

  // Sources that use manual tracking (Tiktok/Shopee) vs NinjaVan
  const MANUAL_TRACKING_SOURCES = ["Tiktok HQ", "Shopee HQ"];

  const createCustomerPurchase = useMutation({
    mutationFn: async (data: CustomerPurchaseData) => {
      // Check if seller has enough inventory
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('user_id', user?.id)
        .eq('product_id', data.productId)
        .single();

      if (inventoryError || !inventoryData) {
        throw new Error('Inventory not found for this product');
      }

      if (inventoryData.quantity < data.quantity) {
        throw new Error(`Insufficient inventory. Available: ${inventoryData.quantity}, Required: ${data.quantity}`);
      }

      // Get product info for NinjaVan
      const selectedProduct = products?.find(p => p.id === data.productId);
      const productName = selectedProduct?.name || "Product";

      // Check if customer exists
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', data.customerPhone)
        .eq('created_by', user?.id)
        .single();

      let customerId = existingCustomer?.id;

      // Create customer if doesn't exist
      if (!customerId) {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: data.customerName,
            phone: data.customerPhone,
            address: data.customerAddress,
            postcode: data.customerPostcode || null,
            city: data.customerCity || null,
            state: data.customerState,
            created_by: user?.id,
          })
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      } else {
        // Update existing customer with postcode/city if provided
        if (data.customerPostcode || data.customerCity) {
          await supabase
            .from('customers')
            .update({
              postcode: data.customerPostcode || null,
              city: data.customerCity || null,
            })
            .eq('id', customerId);
        }
      }

      // Determine if this order uses NinjaVan or manual tracking
      const usesManualTracking = data.orderFrom && MANUAL_TRACKING_SOURCES.includes(data.orderFrom);
      const usesNinjaVan = userType === 'branch' && data.orderFrom && !usesManualTracking;

      // For COD payments with NinjaVan sources, create NinjaVan order
      let trackingNumber = data.trackingNumber || null;
      let ninjavanOrderId = null;
      let attachmentUrl = null;

      // Upload PDF attachment for Tiktok/Shopee orders
      if (usesManualTracking && data.attachmentFile) {
        const fileExt = data.attachmentFile.name.split('.').pop();
        const fileName = `${user?.id}/${Date.now()}_${data.trackingNumber}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('public')
          .upload(fileName, data.attachmentFile);

        if (uploadError) {
          console.error("Failed to upload attachment:", uploadError);
          toast.error("Failed to upload PDF attachment");
        } else {
          const { data: publicUrl } = supabase.storage
            .from('public')
            .getPublicUrl(fileName);
          attachmentUrl = publicUrl.publicUrl;
        }
      }

      // Only use NinjaVan for non-Tiktok/Shopee sources with COD
      if (data.paymentMethod === 'COD' && ninjavanConfig && usesNinjaVan) {
        try {
          const { data: session } = await supabase.auth.getSession();
          const ninjavanResponse = await supabase.functions.invoke("ninjavan-order", {
            body: {
              profileId: user?.id,
              customerName: data.customerName,
              phone: data.customerPhone,
              address: data.customerAddress,
              postcode: data.customerPostcode || "",
              city: data.customerCity || "",
              state: data.customerState,
              price: data.price,
              paymentMethod: data.paymentMethod,
              productName: productName,
              quantity: data.quantity,
            },
            headers: {
              Authorization: `Bearer ${session?.session?.access_token}`,
            },
          });

          if (ninjavanResponse.error) {
            console.error("NinjaVan error:", ninjavanResponse.error);
            // Don't throw - allow purchase to proceed without NinjaVan
            toast.error("NinjaVan order failed: " + (ninjavanResponse.error.message || "Unknown error"));
          } else if (ninjavanResponse.data?.success) {
            trackingNumber = ninjavanResponse.data.trackingNumber;
            ninjavanOrderId = ninjavanResponse.data.trackingNumber;
            console.log("NinjaVan order created:", trackingNumber);
          }
        } catch (ninjavanError: any) {
          console.error("NinjaVan API error:", ninjavanError);
          // Don't throw - allow purchase to proceed without NinjaVan
          toast.error("NinjaVan order failed: " + (ninjavanError.message || "Unknown error"));
        }
      }

      // Create customer purchase record
      const { error: purchaseError } = await supabase
        .from('customer_purchases')
        .insert({
          customer_id: customerId,
          seller_id: user?.id,
          product_id: data.productId,
          quantity: data.quantity,
          unit_price: data.price / data.quantity,
          total_price: data.price,
          payment_method: data.paymentMethod,
          closing_type: data.closingType,
          tracking_number: trackingNumber,
          remarks: 'Customer purchase',
          platform: 'Manual',
          ninjavan_order_id: ninjavanOrderId,
          order_from: data.orderFrom || null,
          attachment_url: attachmentUrl,
        } as any);

      if (purchaseError) throw purchaseError;

      // Deduct inventory from seller
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ quantity: inventoryData.quantity - data.quantity })
        .eq('user_id', user?.id)
        .eq('product_id', data.productId);

      if (updateError) throw updateError;

      return { trackingNumber };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["customer_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setIsModalOpen(false);

      let successMessage = "Customer purchase recorded successfully. Inventory has been updated.";
      if (result?.trackingNumber) {
        successMessage += `\n\nTracking Number: ${result.trackingNumber}`;
      }

      Swal.fire({
        icon: "success",
        title: "Success!",
        text: successMessage,
        confirmButtonText: "OK"
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create customer purchase");
    },
  });

  // Sync from StoreHub (Branch only)
  const handleStorehubSync = async () => {
    if (!profile?.storehub_username || !profile?.storehub_password) {
      Swal.fire({
        icon: "warning",
        title: "StoreHub Not Configured",
        text: "Please configure your StoreHub credentials in Settings first.",
        confirmButtonText: "OK"
      });
      return;
    }

    // Show date picker popup first
    const malaysiaDateNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
    const defaultDate = format(malaysiaDateNow, "yyyy-MM-dd");

    const { value: selectedDate, isConfirmed } = await Swal.fire({
      title: "Select Date to Sync",
      html: `
        <input type="date" id="sync-date" class="swal2-input" value="${defaultDate}" max="${defaultDate}" style="width: 100%;">
        <p style="margin-top: 10px; font-size: 14px; color: #666;">Select the date to sync transactions from StoreHub</p>
      `,
      showCancelButton: true,
      confirmButtonText: "Sync",
      cancelButtonText: "Cancel",
      preConfirm: () => {
        const dateInput = document.getElementById('sync-date') as HTMLInputElement;
        if (!dateInput?.value) {
          Swal.showValidationMessage('Please select a date');
          return false;
        }
        return dateInput.value;
      }
    });

    if (!isConfirmed || !selectedDate) {
      return;
    }

    setIsSyncing(true);
    const syncDate = selectedDate;

    try {
      // Call Edge Function to fetch from StoreHub
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("storehub-sync", {
        body: {
          storehub_username: profile.storehub_username,
          storehub_password: profile.storehub_password,
          date: syncDate,
        },
        headers: {
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to sync from StoreHub");
      }

      const { transactions, customers: storehubCustomers, products: storehubProducts } = response.data;

      // Debug: Log ALL transactions with invoice numbers and times for comparison
      console.log("========== STOREHUB SYNC DEBUG ==========");
      console.log(`Date requested: ${syncDate}`);
      console.log(`Total transactions received: ${transactions?.length || 0}`);
      console.log("All transactions (sorted by time):");
      const sortedTransactions = [...(transactions || [])].sort((a: any, b: any) =>
        new Date(a.transactionTime).getTime() - new Date(b.transactionTime).getTime()
      );
      let expectedTotal = 0;
      sortedTransactions.forEach((t: any, idx: number) => {
        const utcDate = new Date(t.transactionTime);
        const malaysiaDate = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
        const timeStr = malaysiaDate.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
        expectedTotal += Number(t.total) || 0;

        // For multi-item transactions, show item details
        if ((t.items?.length || 0) > 1) {
          console.log(`${idx + 1}. ${timeStr} | Invoice: ${t.invoiceNumber} | Total: RM ${t.total} | Items: ${t.items?.length || 0}`);
          t.items?.forEach((item: any, itemIdx: number) => {
            if (item.itemType === "Item") {
              const itemName = item.itemName || item.name || "Unknown";
              const isCOD = itemName.toUpperCase() === "COD";
              console.log(`   Item ${itemIdx}: ${itemName} | Qty: ${item.quantity} | Total: RM ${item.total || item.subTotal}${isCOD ? ' [SKIPPED - COD]' : ''}`);
            }
          });
        } else {
          console.log(`${idx + 1}. ${timeStr} | Invoice: ${t.invoiceNumber} | Total: RM ${t.total} | Items: ${t.items?.length || 0}`);
        }
      });
      console.log(`========== EXPECTED TOTAL: RM ${expectedTotal} ==========`);

      if (!transactions || transactions.length === 0) {
        Swal.fire({
          icon: "info",
          title: "No Transactions",
          text: `No transactions found in StoreHub for ${syncDate}.`,
          confirmButtonText: "OK"
        });
        setIsSyncing(false);
        return;
      }

      let importedCount = 0;
      let skippedCount = 0;

      // Process each transaction
      for (const transaction of transactions) {
        // Skip cancelled or return transactions
        if (transaction.isCancelled || transaction.transactionType === "Return") {
          skippedCount++;
          continue;
        }

        // Get customer info from StoreHub
        let customerName = "Walk-In Customer";
        let customerPhone = "walk-in";
        let customerAddress = "";
        let customerState = "Walk-In";

        // Try both customerRefId and customerId
        const custId = transaction.customerRefId || transaction.customerId;

        if (custId) {
          // Try multiple matching fields (refId, id, _id)
          const storehubCustomer = storehubCustomers?.find(
            (c: any) => c.refId === custId || c.id === custId || c._id === custId
          );

          if (storehubCustomer) {
            customerName = `${storehubCustomer.firstName || ""} ${storehubCustomer.lastName || ""}`.trim() || "Walk-In Customer";
            customerPhone = storehubCustomer.phone || storehubCustomer.mobile || "walk-in";
            customerAddress = [storehubCustomer.address1, storehubCustomer.address2, storehubCustomer.city]
              .filter(Boolean)
              .join(", ");
            customerState = storehubCustomer.state || "Unknown";
          }
        }

        // Create or get customer - use single "Walk-In Customer" for walk-in sales
        let customerId: string | null = null;

        // Check if customer exists by phone
        const { data: existingCustomers } = await supabase
          .from("customers")
          .select("id")
          .eq("phone", customerPhone)
          .eq("created_by", user?.id);

        if (existingCustomers && existingCustomers.length > 0) {
          customerId = existingCustomers[0].id;
        } else {
          // Create new customer
          const { data: newCustomer, error: customerError } = await supabase
            .from("customers")
            .insert({
              name: customerName,
              phone: customerPhone,
              address: customerAddress,
              state: customerState,
              created_by: user?.id,
            })
            .select()
            .single();

          if (customerError) {
            console.error("Failed to create customer:", customerError);
            skippedCount++;
            continue;
          }
          customerId = newCustomer.id;
        }

        // Process each item in the transaction
        for (let itemIndex = 0; itemIndex < (transaction.items || []).length; itemIndex++) {
          const item = transaction.items[itemIndex];
          if (item.itemType !== "Item") continue;

          // Create unique remarks for each item: InvoiceNumber-ItemIndex
          const itemRemarks = `StoreHub: ${transaction.invoiceNumber}-${itemIndex}`;

          // Check if this specific item already exists
          const { data: existingItem } = await supabase
            .from("customer_purchases")
            .select("id")
            .eq("seller_id", user?.id)
            .eq("remarks", itemRemarks);

          if (existingItem && existingItem.length > 0) {
            skippedCount++;
            continue; // Skip this item, already imported
          }

          // Get StoreHub product info - match by id
          const storehubProduct = storehubProducts?.find((p: any) => p.id === item.productId);
          const storehubProductName = storehubProduct?.name || item.itemName || item.name || "Unknown Product";

          // Skip products named "COD" - don't import them at all
          if (storehubProductName.toUpperCase() === "COD") {
            skippedCount++;
            continue;
          }


          // Determine payment method (must be: 'Online Transfer', 'COD', or 'Cash')
          let paymentMethod = "Cash";
          if (transaction.payments && transaction.payments.length > 0) {
            const payment = transaction.payments[0];
            const method = payment.paymentMethod?.toLowerCase() || "";
            if (method.includes("card") || method.includes("credit") ||
                method.includes("debit") || method.includes("transfer") ||
                method.includes("online") || method.includes("ewallet") ||
                method.includes("grab") || method.includes("touch") ||
                method.includes("boost") || method.includes("shopee")) {
              paymentMethod = "Online Transfer";
            } else if (method.includes("cod") || method.includes("delivery")) {
              paymentMethod = "COD";
            } else {
              paymentMethod = "Cash"; // Default to Cash for all other methods
            }
          }

          // Create customer purchase record with storehub_product
          const { error: purchaseError } = await supabase
            .from("customer_purchases")
            .insert({
              customer_id: customerId,
              seller_id: user?.id,
              product_id: null, // No local product match needed
              storehub_product: storehubProductName, // Store StoreHub product name
              quantity: item.quantity || 1,
              unit_price: item.unitPrice || item.subTotal / (item.quantity || 1),
              total_price: item.total || item.subTotal,
              payment_method: paymentMethod,
              closing_type: "Walk In", // StoreHub transactions are Walk In
              remarks: itemRemarks, // Unique per item: InvoiceNumber-ItemIndex
              transaction_total: transaction.total, // Full invoice total from StoreHub
              storehub_invoice: transaction.invoiceNumber, // Invoice number for grouping
              platform: "StoreHub", // Track source platform
            } as any);

          if (purchaseError) {
            console.error("Failed to create purchase:", purchaseError);
            skippedCount++;
          } else {
            importedCount++;
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["customer_purchases"] });

      Swal.fire({
        icon: "success",
        title: "Sync Complete!",
        html: `
          <p>StoreHub sync completed for ${syncDate}</p>
          <p><strong>Imported:</strong> ${importedCount} items</p>
          <p><strong>Skipped:</strong> ${skippedCount} (duplicates/cancelled)</p>
        `,
        confirmButtonText: "OK"
      });

    } catch (error: any) {
      console.error("StoreHub sync error:", error);
      Swal.fire({
        icon: "error",
        title: "Sync Failed",
        text: error.message || "Failed to sync from StoreHub",
        confirmButtonText: "OK"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground mt-2">
            Manage your customer purchases and track sales
          </p>
        </div>
        <div className="flex gap-2">
          {userType === "branch" && (
            <Button
              variant="outline"
              onClick={handleStorehubSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {isSyncing ? "Syncing..." : "Sync StoreHub"}
            </Button>
          )}
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer Purchase
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-2">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Card with Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Purchases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Start Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">End Date</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Payment Method</label>
                    <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Payment Methods" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Payment Methods</SelectItem>
                        <SelectItem value="Online Transfer">Online Transfer</SelectItem>
                        <SelectItem value="COD">COD</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Jenis Closing</label>
                    <Select value={closingTypeFilter} onValueChange={setClosingTypeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Jenis Closing" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Jenis Closing</SelectItem>
                        <SelectItem value="Website">Website</SelectItem>
                        <SelectItem value="WhatsappBot">WhatsappBot</SelectItem>
                        <SelectItem value="Call">Call</SelectItem>
                        <SelectItem value="Manual">Manual</SelectItem>
                        <SelectItem value="Live">Live</SelectItem>
                        <SelectItem value="Shop">Shop</SelectItem>
                        <SelectItem value="Walk In">Walk In</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          {isLoading ? (
            <p>Loading customer purchases...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Name Customer</TableHead>
                  <TableHead>Phone Customer</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Jenis Closing</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Tracking No.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedPurchases.map((purchase: any, index) => (
                  <TableRow key={purchase.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      {format(new Date(purchase.created_at), "dd-MM-yyyy")}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        purchase.platform === "StoreHub"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {purchase.platform || "Manual"}
                      </span>
                    </TableCell>
                    <TableCell>{purchase.customer?.name || "-"}</TableCell>
                    <TableCell>{purchase.customer?.phone || "-"}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {purchase.customer?.address || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{purchase.customer?.state || "-"}</TableCell>
                    <TableCell>{purchase.payment_method}</TableCell>
                    <TableCell>{purchase.closing_type || "-"}</TableCell>
                    <TableCell>
                      <span className="text-sm" title={purchase.products.join(", ")}>
                        {purchase.products.length > 1
                          ? `${purchase.products[0]} (+${purchase.products.length - 1} more)`
                          : purchase.products[0] || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{purchase.total_quantity}</TableCell>
                    <TableCell>RM {Number(purchase.total_price || 0).toFixed(2)}</TableCell>
                    <TableCell>{purchase.tracking_number || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Customer Modal */}
      <AddCustomerModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSubmit={(data) => createCustomerPurchase.mutate(data)}
        isLoading={createCustomerPurchase.isPending}
        products={products || []}
        userType={userType}
      />
    </div>
  );
};

export default Customers;
