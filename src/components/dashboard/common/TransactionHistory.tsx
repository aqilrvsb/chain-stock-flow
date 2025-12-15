import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, ShoppingCart, RefreshCw, Receipt, Package, DollarSign } from "lucide-react";
import Swal from "sweetalert2";
import PaymentDetailsModal from "./PaymentDetailsModal";
import { getMalaysiaDate } from "@/lib/utils";

const TransactionHistory = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = getMalaysiaDate();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState("all");
  const [recheckingBills, setRecheckingBills] = useState<Set<string>>(new Set());
  const [paymentDetailsModal, setPaymentDetailsModal] = useState<{
    open: boolean;
    paymentType: string;
    paymentDate: string | null;
    bankName: string | null;
    receiptImageUrl: string | null;
  }>({
    open: false,
    paymentType: "",
    paymentDate: null,
    bankName: null,
    receiptImageUrl: null,
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["pending_orders", user?.id, startDate, endDate, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("pending_orders")
        .select("*")
        .eq("buyer_id", user?.id)
        .order("created_at", { ascending: false});

      if (startDate) {
        query = query.gte("created_at", startDate + 'T00:00:00.000Z');
      }
      if (endDate) {
        query = query.lte("created_at", endDate + 'T23:59:59.999Z');
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: ordersData, error} = await query;
      if (error) throw error;

      // Fetch products data
      const productIds = [...new Set(ordersData?.map(o => o.product_id))];
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, sku")
        .in("id", productIds);

      // Fetch bundles data
      const bundleIds = [...new Set(ordersData?.map(o => o.bundle_id).filter(Boolean))];
      const { data: bundlesData } = await supabase
        .from("bundles")
        .select("id, name")
        .in("id", bundleIds);

      // Merge all data with orders
      const productsMap = new Map(productsData?.map(p => [p.id, p]));
      const bundlesMap = new Map(bundlesData?.map(b => [b.id, b]));

      return ordersData?.map(order => ({
        ...order,
        product: productsMap.get(order.product_id),
        bundle: bundlesMap.get(order.bundle_id)
      }));
    },
  });

  // Calculate statistics
  const totalTransactions = orders?.length || 0;
  const totalSuccess = orders?.filter(o => o.status === "completed").length || 0;
  const totalFailed = orders?.filter(o => o.status === "failed").length || 0;
  const totalPending = orders?.filter(o => o.status === "pending").length || 0;
  const totalUnitSuccess = orders
    ?.filter(o => o.status === "completed")
    .reduce((sum, o) => sum + (o.quantity || 0), 0) || 0;
  const totalPriceSuccess = orders
    ?.filter(o => o.status === "completed")
    .reduce((sum, o) => sum + (Number(o.total_price) || 0), 0) || 0;

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
      title: "Total Unit Purchase (Success)",
      value: totalUnitSuccess,
      icon: Package,
      color: "text-emerald-600",
    },
    {
      title: "Total Purchase (Success)",
      value: `RM ${totalPriceSuccess.toFixed(2)}`,
      icon: DollarSign,
      color: "text-purple-600",
    },
  ];

  const handleRecheck = async (billId: string, orderNumber: string) => {
    setRecheckingBills(prev => new Set(prev).add(billId));

    try {
      // Refresh session to get a fresh token
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();

      if (sessionError || !session) {
        throw new Error('Session expired. Please login again.');
      }

      const { data, error } = await supabase.functions.invoke('billplz-payment', {
        body: {
          action: 'recheck',
          bill_id: billId
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      // Check for function error
      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to invoke payment check function');
      }

      // Check if data contains an error
      if (data && data.error) {
        console.error('Payment check error:', data.error);
        throw new Error(data.error);
      }

      if (data && data.status === 'failed') {
        await Swal.fire({
          icon: 'error',
          title: 'Payment Failed',
          text: 'The payment is still failed. Please make another purchase.',
          confirmButtonText: 'OK'
        });
        // Refresh the transaction list to show updated status
        queryClient.invalidateQueries({ queryKey: ["pending_orders"] });
      } else if (data && data.status === 'completed') {
        await Swal.fire({
          icon: 'success',
          title: 'Payment Successful!',
          text: 'Your payment has been verified and your inventory has been updated.',
          confirmButtonText: 'OK'
        });
        queryClient.invalidateQueries({ queryKey: ["pending_orders"] });
      } else {
        await Swal.fire({
          icon: 'info',
          title: 'Payment Pending',
          text: 'The payment is still pending. Please try again later.',
          confirmButtonText: 'OK'
        });
      }
    } catch (error: any) {
      console.error('Recheck error:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Recheck Failed',
        text: error.message || 'Failed to check payment status. Please try again later.',
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

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
          <CardTitle>Transaction History</CardTitle>
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
            <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">No</TableHead>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="whitespace-nowrap">Product</TableHead>
                    <TableHead className="whitespace-nowrap">Bundle</TableHead>
                    <TableHead className="whitespace-nowrap">Payment Method</TableHead>
                    <TableHead className="whitespace-nowrap">Bill ID</TableHead>
                    <TableHead className="whitespace-nowrap">Unit</TableHead>
                    <TableHead className="whitespace-nowrap">Total Purchase</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap">Action</TableHead>
                    <TableHead className="whitespace-nowrap">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders?.map((order, index) => (
                    <TableRow key={order.id}>
                      <TableCell className="whitespace-nowrap">{index + 1}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(order.created_at), "dd-MM-yyyy")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{order.product?.name || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{order.bundle?.name || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {(order as any).billplz_bill_id ? (
                          <span className="text-sm">FPX</span>
                        ) : (order as any).payment_type ? (
                          <button
                            onClick={() => setPaymentDetailsModal({
                              open: true,
                              paymentType: (order as any).payment_type,
                              paymentDate: (order as any).payment_date,
                              bankName: (order as any).bank_name,
                              receiptImageUrl: (order as any).receipt_image_url,
                            })}
                            className="text-sm text-primary hover:underline cursor-pointer"
                          >
                            {(order as any).payment_type}
                          </button>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="text-xs font-mono text-muted-foreground">
                          {(order as any).billplz_bill_id || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{order.quantity}</TableCell>
                      <TableCell className="whitespace-nowrap">RM {Number(order.total_price || 0).toFixed(2)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {getStatusBadge(order.status)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {order.status === 'pending' && (order as any).billplz_bill_id ? (
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
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="text-sm text-muted-foreground">
                          {(order as any).remarks || "-"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Details Modal */}
      <PaymentDetailsModal
        open={paymentDetailsModal.open}
        onOpenChange={(open) => setPaymentDetailsModal({ ...paymentDetailsModal, open })}
        paymentType={paymentDetailsModal.paymentType}
        paymentDate={paymentDetailsModal.paymentDate}
        bankName={paymentDetailsModal.bankName}
        receiptImageUrl={paymentDetailsModal.receiptImageUrl}
      />
    </div>
  );
};

export default TransactionHistory;
