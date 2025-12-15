import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  RotateCw,
  Pencil,
  Trash2,
  Car,
  FileText,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface OrderForTracking {
  id: string;
  marketerName: string;
  noPhone: string;
  alamat: string;
  poskod: string;
  bandar: string;
  negeri: string;
  caraBayaran: string;
  produk: string;
  marketerIdStaff: string;
  hargaJualan: number;
}

interface MarketerHistoryProps {
  onEditOrder?: (order: any) => void;
}

const MarketerHistory = ({ onEditOrder }: MarketerHistoryProps) => {
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<{
    id: string;
    trackingNo: string;
    platform: string;
    receiptImageUrl?: string;
    waybillUrl?: string;
    noPhone?: string;
    marketerIdStaff?: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Regenerate tracking state
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [orderForTracking, setOrderForTracking] = useState<OrderForTracking | null>(null);
  const [regeneratePoskod, setRegeneratePoskod] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Get branch_id for NinjaVan
  const { data: branchId } = useQuery({
    queryKey: ["marketer-branch-id", user?.id, userProfile?.branch_id],
    queryFn: async () => {
      if (userProfile?.branch_id) {
        return userProfile.branch_id;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("created_by")
        .eq("user_id", user?.id)
        .eq("role", "marketer")
        .single();
      if (error || !data?.created_by) return null;
      return data.created_by;
    },
    enabled: !!user?.id,
  });

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
    const headers = ["No", "Tarikh Order", "Nama Pelanggan", "Phone", "Produk", "Unit", "Tracking No", "Total Sales", "Cara Bayaran", "Delivery Status", "Jenis Platform", "Jenis Customer", "Negeri", "Alamat", "SEO"];
    const rows = filteredOrders.map((order: any, idx: number) => [
      idx + 1,
      order.date_order || "-",
      order.marketer_name || "-",
      order.no_phone || "-",
      order.produk || "-",
      order.quantity || 1,
      order.tracking_number || "-",
      order.total_price || 0,
      order.cara_bayaran || "-",
      order.delivery_status || "-",
      order.jenis_platform || "-",
      order.jenis_customer || "-",
      order.negeri || "-",
      order.alamat || "-",
      order.seo || "-",
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

  const handleEditClick = (order: any) => {
    if (onEditOrder) {
      onEditOrder(order);
    } else {
      toast.info("Edit order tidak tersedia");
    }
  };

  const handleDeleteClick = (order: any) => {
    setOrderToDelete({
      id: order.id,
      trackingNo: order.tracking_number,
      platform: order.jenis_platform,
      receiptImageUrl: order.receipt_image_url,
      waybillUrl: order.waybill_url,
      noPhone: order.no_phone,
      marketerIdStaff: order.marketer_id_staff,
    });
    setDeleteDialogOpen(true);
  };

  const handleRegenerateClick = (order: any) => {
    setOrderForTracking({
      id: order.id,
      marketerName: order.marketer_name,
      noPhone: order.no_phone,
      alamat: order.alamat,
      poskod: order.poskod,
      bandar: order.bandar,
      negeri: order.negeri,
      caraBayaran: order.cara_bayaran,
      produk: order.produk,
      marketerIdStaff: order.marketer_id_staff,
      hargaJualan: order.total_price,
    });
    setRegeneratePoskod(order.poskod || "");
    setRegenerateDialogOpen(true);
  };

  const handleConfirmRegenerate = async () => {
    if (!orderForTracking || !branchId) return;

    setIsRegenerating(true);
    try {
      // Call NinjaVan API
      const { data: session } = await supabase.auth.getSession();
      const { data: ninjavanResult, error: ninjavanError } = await supabase.functions.invoke("ninjavan-order", {
        body: {
          profileId: branchId,
          customerName: orderForTracking.marketerName,
          phone: orderForTracking.noPhone,
          address: orderForTracking.alamat,
          postcode: regeneratePoskod,
          city: orderForTracking.bandar,
          state: orderForTracking.negeri,
          price: orderForTracking.hargaJualan,
          paymentMethod: orderForTracking.caraBayaran,
          productName: orderForTracking.produk,
          productSku: orderForTracking.sku,
          quantity: orderForTracking.quantity || 1,
          nota: orderForTracking.nota_staff || "",
        },
        headers: {
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
      });

      if (ninjavanError) throw ninjavanError;

      if (ninjavanResult?.error) {
        throw new Error(ninjavanResult.error);
      }

      const trackingNumber = ninjavanResult?.trackingNumber;
      if (!trackingNumber) {
        throw new Error("No tracking number returned from Ninjavan");
      }

      // Update order with tracking number
      const { error: updateError } = await supabase
        .from("customer_purchases")
        .update({ tracking_number: trackingNumber })
        .eq("id", orderForTracking.id);

      if (updateError) throw updateError;

      toast.success(`Tracking number ${trackingNumber} telah dijana.`);

      setRegenerateDialogOpen(false);
      setOrderForTracking(null);
      setRegeneratePoskod("");
      queryClient.invalidateQueries({ queryKey: ["marketer-history"] });
    } catch (error: any) {
      console.error("Regenerate tracking error:", error);
      toast.error(error.message || "Gagal menjana tracking number. Sila cuba lagi.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;

    setIsDeleting(true);
    try {
      const isNinjavanOrder = orderToDelete.platform !== "Shopee" && orderToDelete.platform !== "Tiktok";

      // If it's a Ninjavan order and has tracking number, cancel via API first
      if (isNinjavanOrder && orderToDelete.trackingNo && branchId) {
        try {
          const { data: cancelResult, error: cancelError } = await supabase.functions.invoke("ninjavan-cancel", {
            body: { trackingNumber: orderToDelete.trackingNo, profileId: branchId },
          });

          if (cancelError) {
            console.error("Ninjavan cancel error:", cancelError);
            toast.error("Gagal membatalkan order di Ninjavan. Order akan dipadam dari sistem sahaja.");
          } else if (cancelResult?.error) {
            console.error("Ninjavan cancel API error:", cancelResult.error);
            toast.error(cancelResult.error);
          } else {
            toast.success("Order Ninjavan telah dibatalkan.");
          }
        } catch (err) {
          console.error("Cancel API call failed:", err);
        }
      }

      // Delete files from Supabase storage if they exist
      const deleteFromStorage = async (url: string, bucket: string) => {
        try {
          // Extract file path from URL
          // URL format: https://xxx.supabase.co/storage/v1/object/public/bucket-name/path/to/file
          const urlParts = url.split(`/storage/v1/object/public/${bucket}/`);
          if (urlParts.length > 1) {
            const filePath = urlParts[1];
            const { error } = await supabase.storage.from(bucket).remove([filePath]);
            if (error) {
              console.error(`Failed to delete from ${bucket}:`, error);
            }
          }
        } catch (err) {
          console.error("Storage delete error:", err);
        }
      };

      // Delete receipt image if exists
      if (orderToDelete.receiptImageUrl) {
        await deleteFromStorage(orderToDelete.receiptImageUrl, "payment-receipts");
      }

      // Delete waybill if exists
      if (orderToDelete.waybillUrl) {
        await deleteFromStorage(orderToDelete.waybillUrl, "payment-receipts");
      }

      // Delete the order from database
      const { error: deleteError } = await supabase
        .from("customer_purchases")
        .delete()
        .eq("id", orderToDelete.id);

      if (deleteError) throw deleteError;

      // Decrement count_order for the lead
      if (orderToDelete.noPhone && orderToDelete.marketerIdStaff) {
        try {
          const { data: lead } = await supabase
            .from("prospects")
            .select("id, count_order")
            .eq("marketer_id_staff", orderToDelete.marketerIdStaff)
            .eq("no_telefon", orderToDelete.noPhone)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lead && lead.count_order > 0) {
            await supabase
              .from("prospects")
              .update({
                count_order: lead.count_order - 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", lead.id);
          }
        } catch (err) {
          console.error("Error decrementing count_order:", err);
        }
      }

      toast.success("Order telah berjaya dipadam.");
      queryClient.invalidateQueries({ queryKey: ["marketer-history"] });
    } catch (error) {
      console.error("Error deleting order:", error);
      toast.error("Gagal memadam order. Sila cuba lagi.");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
    }
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
        <h1 className="text-2xl font-bold text-primary">Order History</h1>
        <p className="text-muted-foreground">Monitor and manage your order history</p>
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

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs uppercase font-medium">Total Sales</span>
          </div>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">RM {stats.totalSales.toLocaleString()}</p>
        </div>

        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs uppercase font-medium">Total Cash</span>
          </div>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">RM {stats.totalCash.toLocaleString()}</p>
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
          <span className="text-sm text-muted-foreground">Start Date</span>
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
          <span className="text-sm text-muted-foreground">End Date</span>
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
            Reset Filters
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Delivery Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Jenis Platform</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Jenis Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Negeri</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Alamat</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Nota</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Waybill</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">SEO</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Action</th>
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
                    <td className="px-4 py-3 text-sm font-mono text-foreground">
                      {order.tracking_number ? (
                        order.tracking_number
                      ) : order.jenis_platform !== "Shopee" && order.jenis_platform !== "Tiktok" ? (
                        <button
                          onClick={() => handleRegenerateClick(order)}
                          className="p-1.5 rounded-md hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-600 dark:text-orange-400 transition-colors"
                          title="Generate Tracking"
                        >
                          <Car className="w-4 h-4" />
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
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
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          order.delivery_status === "Success"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : order.delivery_status === "Shipped"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            : order.delivery_status === "Pending"
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                            : order.delivery_status === "Processing"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {order.delivery_status || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{order.jenis_platform || "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`font-medium ${
                          order.jenis_customer === "NP"
                            ? "text-green-600"
                            : order.jenis_customer === "EP"
                            ? "text-purple-600"
                            : order.jenis_customer === "EC"
                            ? "text-amber-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {order.jenis_customer || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{order.negeri || "-"}</td>
                    <td className="px-4 py-3 text-sm text-foreground max-w-xs truncate">{order.alamat || "-"}</td>
                    <td className="px-4 py-3 text-sm text-foreground max-w-xs truncate">{order.nota_staff || "-"}</td>
                    <td className="px-4 py-3">
                      {order.waybill_url && (order.jenis_platform === "Tiktok" || order.jenis_platform === "Shopee") ? (
                        <a
                          href={order.waybill_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors inline-flex"
                          title="View Waybill"
                        >
                          <FileText className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          order.seo === "Successfull Delivery"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : order.seo === "Shipped"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            : order.seo === "Return"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400"
                        }`}
                      >
                        {order.seo || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {order.delivery_status === "Pending" && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditClick(order)}
                            className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                            title="Edit Order"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(order)}
                            className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                            title="Delete Order"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={18} className="px-4 py-12 text-center text-muted-foreground">
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
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredOrders.length)} of{" "}
              {filteredOrders.length}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Padam Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Adakah anda pasti mahu memadam order ini?
              {orderToDelete?.trackingNo && orderToDelete.platform !== "Shopee" && orderToDelete.platform !== "Tiktok" && (
                <span className="block mt-2 text-orange-600 dark:text-orange-400">
                  Order Ninjavan (Tracking: {orderToDelete.trackingNo}) juga akan dibatalkan.
                </span>
              )}
              Tindakan ini tidak boleh dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? "Memadam..." : "Padam"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate Tracking Dialog */}
      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Jana Tracking Number</DialogTitle>
            <DialogDescription>Masukkan poskod untuk menjana tracking number Ninjavan.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-foreground">Poskod</label>
            <Input
              type="text"
              value={regeneratePoskod}
              onChange={(e) => setRegeneratePoskod(e.target.value)}
              placeholder="Masukkan poskod"
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenerateDialogOpen(false)} disabled={isRegenerating}>
              Batal
            </Button>
            <Button onClick={handleConfirmRegenerate} disabled={isRegenerating || !regeneratePoskod}>
              {isRegenerating ? "Menjana..." : "Jana Tracking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <p className="text-sm text-muted-foreground">Harga Jualan</p>
                  <p className="text-sm font-medium text-foreground">RM {Number(selectedOrderPayment.total_price || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Receipt Image */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Resit Bayaran</p>
                {selectedOrderPayment.receipt_image_url ? (
                  <a href={selectedOrderPayment.receipt_image_url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={selectedOrderPayment.receipt_image_url}
                      alt="Resit Bayaran"
                      className="max-w-full h-48 object-contain rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Tiada resit dimuat naik</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketerHistory;
