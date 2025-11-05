import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { DollarSign, CheckCircle2, XCircle, Clock, ShoppingCart, FileText, ExternalLink, RefreshCw, Receipt, MessageSquare, Check, X, Package } from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";

const TransactionManagement = () => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [recheckingBills, setRecheckingBills] = useState<Set<string>>(new Set());
  const [remarkText, setRemarkText] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["all_pending_orders", startDate, endDate, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("pending_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (startDate) {
        query = query.gte("created_at", startDate + 'T00:00:00.000Z');
      }
      if (endDate) {
        query = query.lte("created_at", endDate + 'T23:59:59.999Z');
      }
      if (statusFilter !== "all") {
        if (statusFilter === "completed_no_remarks") {
          query = query.eq("status", "completed").or("remarks.is.null,remarks.eq.");
        } else {
          query = query.eq("status", statusFilter);
        }
      }

      const { data: ordersData, error } = await query;
      if (error) throw error;

      // Fetch products, bundles, and buyer data with complete information
      const productIds = [...new Set(ordersData?.map(o => o.product_id))];
      const bundleIds = [...new Set(ordersData?.map(o => o.bundle_id).filter(Boolean))];
      const buyerIds = [...new Set(ordersData?.map(o => o.buyer_id))];

      const [{ data: productsData }, { data: bundlesData }, { data: buyersData }] = await Promise.all([
        supabase.from("products").select("id, name, sku").in("id", productIds),
        supabase.from("bundles").select("id, name").in("id", bundleIds),
        supabase.from("profiles").select("id, idstaff, full_name, email, whatsapp_number, delivery_address").in("id", buyerIds)
      ]);

      const productsMap = new Map(productsData?.map(p => [p.id, p]));
      const bundlesMap = new Map(bundlesData?.map(b => [b.id, b]));
      const buyersMap = new Map(buyersData?.map(b => [b.id, b]));

      return ordersData?.map(order => ({
        ...order,
        product: productsMap.get(order.product_id),
        bundle: bundlesMap.get(order.bundle_id),
        buyer: buyersMap.get(order.buyer_id)
      }));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const order = orders?.find(o => o.id === orderId);
      if (!order) throw new Error("Order not found");

      // Update order status
      const { error: updateError } = await supabase
        .from("pending_orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (updateError) throw updateError;

      // If status is completed, handle inventory updates
      if (status === "completed") {
        // Get HQ user_id (assuming first HQ user for now)
        const { data: hqUser } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "hq")
          .single();

        if (!hqUser) throw new Error("HQ user not found");

        // Increase buyer's inventory
        const { data: buyerInventory } = await supabase
          .from("inventory")
          .select("quantity")
          .eq("user_id", order.buyer_id)
          .eq("product_id", order.product_id)
          .single();

        if (buyerInventory) {
          await supabase
            .from("inventory")
            .update({ quantity: buyerInventory.quantity + order.quantity })
            .eq("user_id", order.buyer_id)
            .eq("product_id", order.product_id);
        } else {
          await supabase
            .from("inventory")
            .insert({
              user_id: order.buyer_id,
              product_id: order.product_id,
              quantity: order.quantity
            });
        }

        // Decrease HQ inventory
        const { data: hqInventory } = await supabase
          .from("inventory")
          .select("quantity")
          .eq("user_id", hqUser.user_id)
          .eq("product_id", order.product_id)
          .single();

        if (hqInventory) {
          const newQuantity = hqInventory.quantity - order.quantity;
          if (newQuantity < 0) {
            throw new Error("Insufficient HQ inventory");
          }
          await supabase
            .from("inventory")
            .update({ quantity: newQuantity })
            .eq("user_id", hqUser.user_id)
            .eq("product_id", order.product_id);
        } else {
          throw new Error("HQ inventory not found for this product");
        }

        // Create transaction record
        await supabase.from("transactions").insert({
          buyer_id: order.buyer_id,
          seller_id: hqUser.user_id,
          product_id: order.product_id,
          quantity: order.quantity,
          unit_price: order.unit_price,
          total_price: order.total_price,
          transaction_type: "purchase"
        });
      }

      return { orderId, status };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["all_pending_orders"] });
      toast.success(`Order ${variables.status === "completed" ? "approved" : "rejected"} successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update order: ${error.message}`);
    },
  });

  // Mutation for saving remarks
  const saveRemarkMutation = useMutation({
    mutationFn: async ({ orderId, remark }: { orderId: string; remark: string }) => {
      const { error } = await supabase
        .from("pending_orders")
        .update({ remarks: remark })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Remark saved successfully");
      queryClient.invalidateQueries({ queryKey: ["all_pending_orders"] });
      setRemarkText("");
      setSelectedOrderId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save remark");
    },
  });

  const handleSaveRemark = (orderId: string) => {
    saveRemarkMutation.mutate({ orderId, remark: remarkText });
  };

  // Calculate statistics
  const totalTransactions = orders?.length || 0;
  const totalSuccess = orders?.filter(o => o.status === "completed").length || 0;
  const totalFailed = orders?.filter(o => o.status === "failed").length || 0;
  const totalPending = orders?.filter(o => o.status === "pending").length || 0;
  const totalPriceSuccess = orders
    ?.filter(o => o.status === "completed")
    .reduce((sum, o) => sum + Number(o.total_price), 0) || 0;
  const totalUnitSuccess = orders
    ?.filter(o => o.status === "completed")
    .reduce((sum, o) => sum + Number(o.quantity), 0) || 0;

  const stats = [
    {
      title: "Total Transaction",
      value: totalTransactions,
      icon: ShoppingCart,
      color: "text-blue-600",
    },
    {
      title: "Total Success",
      value: totalSuccess,
      icon: CheckCircle2,
      color: "text-green-600",
    },
    {
      title: "Total Failed",
      value: totalFailed,
      icon: XCircle,
      color: "text-red-600",
    },
    {
      title: "Total Pending",
      value: totalPending,
      icon: Clock,
      color: "text-yellow-600",
    },
    {
      title: "Total Sales (Success)",
      value: `RM ${totalPriceSuccess.toFixed(2)}`,
      icon: DollarSign,
      color: "text-emerald-600",
    },
    {
      title: "Total Unit (Success)",
      value: totalUnitSuccess,
      icon: Package,
      color: "text-purple-600",
    },
  ];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", className: string }> = {
      completed: { variant: "default", className: "bg-green-600 hover:bg-green-700" },
      failed: { variant: "destructive", className: "" },
      pending: { variant: "secondary", className: "bg-yellow-600 hover:bg-yellow-700 text-white" },
    };
    
    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className={config.className}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const handleRecheck = async (billId: string, orderNumber: string) => {
    setRecheckingBills(prev => new Set(prev).add(billId));
    
    try {
      const { data, error } = await supabase.functions.invoke('billplz-payment', {
        body: { 
          action: 'recheck',
          bill_id: billId 
        }
      });

      if (error) throw error;

      if (data.status === 'failed') {
        await Swal.fire({
          icon: 'error',
          title: 'Payment Failed',
          text: 'The payment is still failed.',
          confirmButtonText: 'OK'
        });
      } else if (data.status === 'completed') {
        await Swal.fire({
          icon: 'success',
          title: 'Payment Successful!',
          text: 'Payment verified and inventory updated.',
          confirmButtonText: 'OK'
        });
        queryClient.invalidateQueries({ queryKey: ["all_pending_orders"] });
      } else {
        await Swal.fire({
          icon: 'info',
          title: 'Payment Pending',
          text: 'The payment is still pending.',
          confirmButtonText: 'OK'
        });
      }
    } catch (error: any) {
      console.error('Recheck error:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Failed to check payment status',
        confirmButtonText: 'OK'
      });
    } finally {
      setRecheckingBills(prev => {
        const newSet = new Set(prev);
        newSet.delete(billId);
        return newSet;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Transaction Management</h1>
        <p className="text-muted-foreground mt-2">
          View and manage all pending orders from the system
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          <CardTitle>All Transactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="completed_no_remarks">Success with No Remarks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          {isLoading ? (
            <p>Loading transactions...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Bill ID</TableHead>
                  <TableHead>IDSTAFF</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>No Whatsapp</TableHead>
                  <TableHead>Alamat</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Bundle</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Total Sale</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Remark</TableHead>
                  <TableHead>Remark Done</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.map((order, index) => (
                  <TableRow key={order.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      {format(new Date(order.created_at), "dd-MM-yyyy")}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground">
                        {(order as any).billplz_bill_id || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{order.buyer?.idstaff || "-"}</TableCell>
                    <TableCell>{order.buyer?.full_name || "-"}</TableCell>
                    <TableCell>
                      {order.buyer?.whatsapp_number ? (
                        <a
                          href={`https://api.whatsapp.com/send?phone=${order.buyer.whatsapp_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700 hover:underline"
                        >
                          {order.buyer.whatsapp_number}
                        </a>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {order.buyer?.delivery_address || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{order.product?.name || "-"}</TableCell>
                    <TableCell>{order.bundle?.name || "-"}</TableCell>
                    <TableCell>{order.quantity}</TableCell>
                    <TableCell>RM {Number(order.total_price || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      {getStatusBadge(order.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {order.status === 'pending' ? (
                          <>
                            {(order as any).billplz_bill_id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRecheck((order as any).billplz_bill_id, order.order_number)}
                                disabled={recheckingBills.has((order as any).billplz_bill_id)}
                                className="gap-2"
                                title="Recheck Payment Status"
                              >
                                <RefreshCw className={`h-4 w-4 ${recheckingBills.has((order as any).billplz_bill_id) ? 'animate-spin' : ''}`} />
                                Recheck
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: 'completed' })}
                              className="gap-2 bg-green-600 hover:bg-green-700"
                              title="Approve Order"
                            >
                              <Check className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: 'failed' })}
                              className="gap-2"
                              title="Reject Order"
                            >
                              <X className="h-4 w-4" />
                              Reject
                            </Button>
                          </>
                        ) : order.status === 'completed' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(`/invoice?order=${order.order_number}`, '_blank')}
                            className="gap-2"
                            title="View Invoice"
                          >
                            <Receipt className="h-4 w-4" />
                            Invoice
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedOrderId(order.id);
                              setRemarkText((order as any).remarks || "");
                            }}
                            className="gap-2"
                            title="Add/View Remark"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Order Remark</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <Textarea
                              placeholder="Enter remark here..."
                              value={remarkText}
                              onChange={(e) => setRemarkText(e.target.value)}
                              rows={5}
                            />
                            <Button
                              onClick={() => handleSaveRemark(order.id)}
                              disabled={saveRemarkMutation.isPending}
                            >
                              {saveRemarkMutation.isPending ? "Saving..." : "Save Remark"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {(order as any).remarks || "-"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionManagement;
