import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, Download, FileText, DollarSign, Package, Users } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const MarketerHistory = () => {
  const { userProfile } = useAuth();
  const userIdStaff = userProfile?.idstaff;

  // Filters
  const today = new Date();
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["marketer-history", userIdStaff, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("customer_purchases")
        .select(`
          *,
          customer:customers(name, phone, address, state, postcode, city),
          product:products(name, sku)
        `)
        .eq("marketer_id_staff", userIdStaff)
        .order("created_at", { ascending: false });

      if (startDate) {
        query = query.gte("date_order", startDate);
      }
      if (endDate) {
        query = query.lte("date_order", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!userIdStaff,
  });

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order: any) => {
      if (search.trim()) {
        const searchLower = search.toLowerCase();
        return (
          order.customer?.name?.toLowerCase().includes(searchLower) ||
          order.customer?.phone?.toLowerCase().includes(searchLower) ||
          order.product?.name?.toLowerCase().includes(searchLower) ||
          order.tracking_number?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [orders, search]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Stats
  const stats = useMemo(() => {
    const totalSales = filteredOrders.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const totalOrders = filteredOrders.length;
    const totalUnits = filteredOrders.reduce((sum: number, o: any) => sum + (o.quantity || 0), 0);
    const totalCash = filteredOrders
      .filter((o: any) => o.payment_method === "CASH" || o.payment_method === "Online Transfer")
      .reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const totalCOD = filteredOrders
      .filter((o: any) => o.payment_method === "COD")
      .reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);

    return { totalSales, totalOrders, totalUnits, totalCash, totalCOD };
  }, [filteredOrders]);

  // Export CSV
  const exportCSV = () => {
    const headers = ["No", "Date", "Customer", "Phone", "Product", "Qty", "Total", "Platform", "Payment", "Status", "Tracking"];
    const rows = filteredOrders.map((order: any, idx: number) => [
      idx + 1,
      order.date_order || "-",
      order.customer?.name || order.marketer_name || "-",
      order.customer?.phone || "-",
      order.product?.name || "-",
      order.quantity,
      order.total_price,
      order.jenis_platform || "-",
      order.payment_method || "-",
      order.delivery_status || "-",
      order.tracking_number || "-",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `order_history_${userIdStaff}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "Shipped":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Shipped</Badge>;
      case "Success":
        return <Badge variant="outline" className="bg-green-100 text-green-800">Success</Badge>;
      case "Failed":
      case "Return":
        return <Badge variant="outline" className="bg-red-100 text-red-800">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status || "-"}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Order History</h1>
        <p className="text-muted-foreground mt-2">
          View your order history and export reports
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-500" />
              <div>
                <p className="text-lg font-bold">RM {stats.totalSales.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total Sales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-500" />
              <div>
                <p className="text-lg font-bold">{stats.totalOrders}</p>
                <p className="text-xs text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="w-6 h-6 text-purple-500" />
              <div>
                <p className="text-lg font-bold">{stats.totalUnits}</p>
                <p className="text-xs text-muted-foreground">Total Units</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-600" />
              <div>
                <p className="text-lg font-bold">RM {stats.totalCash.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Cash</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-orange-500" />
              <div>
                <p className="text-lg font-bold">RM {stats.totalCOD.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">COD</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search customer, phone, product..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-36"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-36"
              />
            </div>
            <Select
              value={pageSize.toString()}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tracking</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrders.length > 0 ? (
                      paginatedOrders.map((order: any, idx: number) => (
                        <TableRow key={order.id}>
                          <TableCell>{(currentPage - 1) * pageSize + idx + 1}</TableCell>
                          <TableCell>{order.date_order || "-"}</TableCell>
                          <TableCell>{order.customer?.name || order.marketer_name || "-"}</TableCell>
                          <TableCell>{order.customer?.phone || "-"}</TableCell>
                          <TableCell>{order.product?.name || "-"}</TableCell>
                          <TableCell>{order.quantity}</TableCell>
                          <TableCell>RM {Number(order.total_price || 0).toFixed(2)}</TableCell>
                          <TableCell>{order.jenis_platform || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={order.payment_method === "COD" ? "outline" : "default"}>
                              {order.payment_method || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(order.delivery_status)}</TableCell>
                          <TableCell className="font-mono text-xs">{order.tracking_number || "-"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                          No orders found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * pageSize + 1} to{" "}
                    {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketerHistory;
