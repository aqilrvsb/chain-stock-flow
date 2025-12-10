import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Search,
  Download,
  RotateCcw,
  Calendar,
  DollarSign,
  Package,
  Users,
  Clock,
  Truck,
  ShoppingBag,
  RotateCw,
} from "lucide-react";
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

  // Payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedOrderPayment, setSelectedOrderPayment] = useState<any>(null);

  // Fetch orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["marketer-history", userIdStaff, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("customer_purchases")
        .select("*")
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
          order.marketer_name?.toLowerCase().includes(searchLower) ||
          order.no_phone?.toLowerCase().includes(searchLower) ||
          order.produk?.toLowerCase().includes(searchLower) ||
          order.no_tracking?.toLowerCase().includes(searchLower)
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
    const totalCustomer = orders.length;
    const totalSales = orders.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const totalReturn = orders.filter((o: any) => o.delivery_status === "Return" || o.delivery_status === "Failed").length;
    const totalUnit = orders.reduce((sum: number, o: any) => sum + (o.quantity || 0), 0);
    const totalPending = orders.filter((o: any) => o.delivery_status === "Pending").length;
    const totalShipped = orders.filter((o: any) => o.delivery_status === "Shipped" || o.delivery_status === "Success").length;
    const totalCash = orders.filter((o: any) => o.cara_bayaran === "CASH").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const totalCOD = orders.filter((o: any) => o.cara_bayaran === "COD").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);

    return { totalCustomer, totalSales, totalReturn, totalUnit, totalPending, totalShipped, totalCash, totalCOD };
  }, [orders]);

  const resetFilters = () => {
    setSearch("");
    setStartDate(format(startOfMonth(today), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(today), "yyyy-MM-dd"));
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ["No", "Tarikh Order", "Nama Pelanggan", "Phone", "Produk", "Unit", "Tracking No", "Total Sales", "Cara Bayaran", "Delivery Status", "Jenis Platform", "Jenis Customer", "Negeri", "Alamat"];
    const rows = filteredOrders.map((order: any, idx: number) => [
      idx + 1,
      order.date_order || "-",
      order.marketer_name || "-",
      order.no_phone || "-",
      order.produk || "-",
      order.quantity || 1,
      order.no_tracking || "-",
      order.total_price || 0,
      order.cara_bayaran || "-",
      order.delivery_status || "-",
      order.jenis_platform || "-",
      order.jenis_customer || "-",
      order.negeri || "-",
      order.alamat || "-",
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

  const handlePaymentClick = (order: any) => {
    setSelectedOrderPayment(order);
    setPaymentModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          History
        </h1>
        <p className="text-muted-foreground">
          View dan export order history anda
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs uppercase font-medium">Total Customer</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalCustomer}</p>
        </div>

        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs uppercase font-medium">Total Sales</span>
          </div>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">RM {stats.totalSales.toLocaleString()}</p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs uppercase font-medium">Total Cash</span>
          </div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">RM {stats.totalCash.toLocaleString()}</p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs uppercase font-medium">Total COD</span>
          </div>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">RM {stats.totalCOD.toLocaleString()}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Package className="w-4 h-4 text-purple-500" />
            <span className="text-xs uppercase font-medium">Total Unit</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalUnit}</p>
        </div>

        <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs uppercase font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{stats.totalPending}</p>
        </div>

        <div className="bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 mb-1">
            <Truck className="w-4 h-4" />
            <span className="text-xs uppercase font-medium">Shipped</span>
          </div>
          <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{stats.totalShipped}</p>
        </div>

        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
            <RotateCw className="w-4 h-4" />
            <span className="text-xs uppercase font-medium">Return</span>
          </div>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.totalReturn}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">From</span>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setCurrentPage(1);
            }}
            className="w-40"
          />
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">To</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setCurrentPage(1);
            }}
            className="w-40"
          />
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Name, phone, product..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
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

        <div className="flex gap-2">
          <Button variant="outline" onClick={resetFilters}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={exportCSV} className="bg-green-600 hover:bg-green-700 text-white">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Tarikh Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Nama Pelanggan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Produk</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Unit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Tracking No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Total Sales</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Cara Bayaran</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Platform</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Negeri</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map((order: any, idx: number) => (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-foreground">{(currentPage - 1) * pageSize + idx + 1}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{order.date_order || "-"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{order.marketer_name || "-"}</td>
                    <td className="px-4 py-3 text-sm font-mono text-foreground">{order.no_phone || "-"}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{order.produk || "-"}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{order.quantity || 1}</td>
                    <td className="px-4 py-3 text-sm font-mono text-foreground">{order.no_tracking || "-"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">RM {Number(order.total_price || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm">
                      {order.cara_bayaran === "CASH" ? (
                        <button
                          onClick={() => handlePaymentClick(order)}
                          className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                        >
                          CASH
                        </button>
                      ) : (
                        <span className="text-muted-foreground">{order.cara_bayaran || "-"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.delivery_status === "Success" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                        order.delivery_status === "Shipped" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
                        order.delivery_status === "Pending" ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" :
                        order.delivery_status === "Processing" ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" :
                        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {order.delivery_status || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{order.jenis_platform || "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`font-medium ${
                        order.jenis_customer === "NP" ? "text-green-600" :
                        order.jenis_customer === "EP" ? "text-purple-600" :
                        order.jenis_customer === "EC" ? "text-amber-600" :
                        "text-muted-foreground"
                      }`}>
                        {order.jenis_customer || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{order.negeri || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-muted-foreground">
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
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
      </div>

      {/* Payment Details Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Butiran Bayaran</DialogTitle>
          </DialogHeader>
          {selectedOrderPayment && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Tarikh Bayaran</p>
                  <p className="text-sm font-medium text-foreground">{selectedOrderPayment.tarikh_bayaran || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Jenis Bayaran</p>
                  <p className="text-sm font-medium text-foreground">{selectedOrderPayment.jenis_bayaran || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bank</p>
                  <p className="text-sm font-medium text-foreground">{selectedOrderPayment.bank || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-sm font-medium text-foreground">RM {Number(selectedOrderPayment.total_price || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketerHistory;
