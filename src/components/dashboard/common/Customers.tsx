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
import { Users, ShoppingCart, DollarSign, Package, Plus } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground mt-2">
            Manage your customer purchases and track sales
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer Purchase
        </Button>
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
                    <TableCell>{purchase.product?.name || "-"}</TableCell>
                    <TableCell>{purchase.quantity}</TableCell>
                    <TableCell>RM {Number(purchase.total_price || 0).toFixed(2)}</TableCell>
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
