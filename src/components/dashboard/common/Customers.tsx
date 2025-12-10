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

  // Calculate statistics
  const totalCustomers = new Set(purchases?.map(p => p.customer_id)).size || 0;
  const totalUnitsPurchased = purchases?.reduce((sum, p) => sum + (p.quantity || 0), 0) || 0;
  const totalPrice = purchases?.reduce((sum, p) => sum + (Number(p.total_price) || 0), 0) || 0;
  const totalTransactions = purchases?.length || 0;

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
            state: data.customerState,
            created_by: user?.id,
          })
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
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
          tracking_number: data.trackingNumber || null,
          remarks: 'Customer purchase',
        });

      if (purchaseError) throw purchaseError;

      // Deduct inventory from seller
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ quantity: inventoryData.quantity - data.quantity })
        .eq('user_id', user?.id)
        .eq('product_id', data.productId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setIsModalOpen(false);
      Swal.fire({
        icon: "success",
        title: "Success!",
        text: "Customer purchase recorded successfully. Inventory has been updated.",
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

    setIsSyncing(true);
    const today = format(new Date(), "yyyy-MM-dd");

    try {
      // Call Edge Function to fetch from StoreHub
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("storehub-sync", {
        body: {
          storehub_username: profile.storehub_username,
          storehub_password: profile.storehub_password,
          date: today,
        },
        headers: {
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to sync from StoreHub");
      }

      const { transactions, customers: storehubCustomers, products: storehubProducts } = response.data;

      // Debug: Log StoreHub data structure
      console.log("StoreHub Transactions:", transactions);
      console.log("StoreHub Customers:", storehubCustomers);
      console.log("StoreHub Products:", storehubProducts);
      if (transactions?.[0]) {
        console.log("Sample Transaction:", JSON.stringify(transactions[0], null, 2));
        console.log("Sample Items:", transactions[0].items);
      }

      if (!transactions || transactions.length === 0) {
        Swal.fire({
          icon: "info",
          title: "No Transactions",
          text: `No transactions found in StoreHub for today (${today}).`,
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
        let customerPhone = "";
        let customerAddress = "";
        let customerState = "";

        if (transaction.customerRefId) {
          const storehubCustomer = storehubCustomers?.find(
            (c: any) => c.refId === transaction.customerRefId
          );
          if (storehubCustomer) {
            customerName = `${storehubCustomer.firstName || ""} ${storehubCustomer.lastName || ""}`.trim() || "Walk-In Customer";
            customerPhone = storehubCustomer.phone || "";
            customerAddress = [storehubCustomer.address1, storehubCustomer.address2, storehubCustomer.city]
              .filter(Boolean)
              .join(", ");
            customerState = storehubCustomer.state || "";
          }
        }

        // Check if this transaction already exists (by invoice number)
        const { data: existingPurchases } = await supabase
          .from("customer_purchases")
          .select("id")
          .eq("seller_id", user?.id)
          .ilike("remarks", `StoreHub: ${transaction.invoiceNumber}%`);

        if (existingPurchases && existingPurchases.length > 0) {
          skippedCount++;
          continue;
        }

        // Create or get customer
        let customerId: string | null = null;
        if (customerPhone) {
          const { data: existingCustomers } = await supabase
            .from("customers")
            .select("id")
            .eq("phone", customerPhone)
            .eq("created_by", user?.id);

          if (existingCustomers && existingCustomers.length > 0) {
            customerId = existingCustomers[0].id;
          }
        }

        if (!customerId) {
          const { data: newCustomer, error: customerError } = await supabase
            .from("customers")
            .insert({
              name: customerName,
              phone: customerPhone || `storehub-${transaction.refId?.substring(0, 8) || Date.now()}`,
              address: customerAddress,
              state: customerState || "Unknown",
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
        for (const item of transaction.items || []) {
          if (item.itemType !== "Item") continue;

          // Get StoreHub product info (use refId/productRefId per StoreHub API)
          const storehubProduct = storehubProducts?.find((p: any) =>
            p.refId === item.productRefId || p.id === item.productId
          );
          const storehubProductName = item.itemName || storehubProduct?.name || item.name || "Unknown Product";

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
              remarks: `StoreHub: ${transaction.invoiceNumber}`,
            });

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
          <p>StoreHub sync completed for ${today}</p>
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
                {purchases?.map((purchase: any, index) => (
                  <TableRow key={purchase.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      {format(new Date(purchase.created_at), "dd-MM-yyyy")}
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
                    <TableCell>{purchase.product?.name || purchase.storehub_product || "-"}</TableCell>
                    <TableCell>{purchase.quantity}</TableCell>
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
