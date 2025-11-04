import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { DollarSign, CheckCircle2, XCircle, Clock, ShoppingCart, FileText, ExternalLink, RefreshCw } from "lucide-react";
import Swal from "sweetalert2";

const TransactionHistory = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [recheckingBills, setRecheckingBills] = useState<Set<string>>(new Set());

  const { data: orders, isLoading } = useQuery({
    queryKey: ["pending_orders", user?.id, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("pending_orders")
        .select("*")
        .eq("buyer_id", user?.id)
        .order("created_at", { ascending: false });

      if (startDate) {
        query = query.gte("created_at", new Date(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte("created_at", new Date(endDate).toISOString());
      }
      
      const { data: ordersData, error } = await query;
      if (error) throw error;

      // Fetch products data
      const productIds = [...new Set(ordersData?.map(o => o.product_id))];
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, sku")
        .in("id", productIds);

      // Merge products with orders
      const productsMap = new Map(productsData?.map(p => [p.id, p]));
      return ordersData?.map(order => ({
        ...order,
        product: productsMap.get(order.product_id)
      }));
    },
  });

  // Calculate statistics
  const totalTransactions = orders?.length || 0;
  const totalSuccess = orders?.filter(o => o.status === "completed").length || 0;
  const totalFailed = orders?.filter(o => o.status === "failed").length || 0;
  const totalPending = orders?.filter(o => o.status === "pending").length || 0;
  const totalPriceSuccess = orders
    ?.filter(o => o.status === "completed")
    .reduce((sum, o) => sum + Number(o.total_price), 0) || 0;

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
      title: "Total Price (Success)",
      value: `RM ${totalPriceSuccess.toFixed(2)}`,
      icon: DollarSign,
      color: "text-emerald-600",
    },
  ];

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
          text: 'The payment is still failed. Please make another purchase.',
          confirmButtonText: 'OK'
        });
      } else if (data.status === 'completed') {
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
          {/* Date Filters */}
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Filter by Date</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <TableHead>Product</TableHead>
                  <TableHead>Bundle</TableHead>
                  <TableHead>Bill ID</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.map((order, index) => (
                  <TableRow key={order.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      {format(new Date(order.created_at), "dd-MM-yyyy")}
                    </TableCell>
                    <TableCell>{order.product?.name || "-"}</TableCell>
                    <TableCell>{order.order_number || "-"}</TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground">
                        {(order as any).billplz_bill_id || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{order.quantity}</TableCell>
                    <TableCell>
                      {getStatusBadge(order.status)}
                    </TableCell>
                    <TableCell>
                      {order.status === 'failed' && (order as any).billplz_bill_id ? (
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
                      ) : order.status === 'completed' && (order as any).billplz_bill_id ? (
                        <a
                          href={`https://www.billplz.com/bills/${(order as any).billplz_bill_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                          title="View Invoice"
                        >
                          <FileText className="h-4 w-4" />
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
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

export default TransactionHistory;
