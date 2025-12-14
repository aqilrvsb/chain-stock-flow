import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import {
  Package,
  Truck,
  Clock,
  Loader2,
  Printer,
  Send,
  Search,
} from "lucide-react";
import { toast } from "sonner";

const PAYMENT_OPTIONS = ["All", "Online Transfer", "COD"];
const PAGE_SIZE_OPTIONS = [10, 50, 100];

const LogisticsOrder = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Filter states
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Selection state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // Loading states
  const [isShipping, setIsShipping] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Fetch pending orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["logistics-order", user?.id, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("customer_purchases")
        .select(`
          *,
          customer:customers(name, phone, address, state, postcode, city),
          product:products(name, sku)
        `)
        .eq("seller_id", user?.id)
        .eq("delivery_status", "Pending")
        .neq("platform", "StoreHub")
        .order("created_at", { ascending: false });

      if (startDate) {
        query = query.gte("created_at", startDate + "T00:00:00.000Z");
      }
      if (endDate) {
        query = query.lte("created_at", endDate + "T23:59:59.999Z");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Filter orders
  const filteredOrders = orders.filter((order: any) => {
    // Search filter
    if (search.trim()) {
      const searchTerms = search.toLowerCase().split("+").map((s) => s.trim()).filter(Boolean);
      const matchesSearch = searchTerms.every((term) =>
        order.customer?.name?.toLowerCase().includes(term) ||
        order.customer?.phone?.toLowerCase().includes(term) ||
        order.tracking_number?.toLowerCase().includes(term) ||
        order.product?.name?.toLowerCase().includes(term) ||
        order.customer?.address?.toLowerCase().includes(term)
      );
      if (!matchesSearch) return false;
    }

    // Payment filter
    if (paymentFilter !== "All" && order.payment_method !== paymentFilter) {
      return false;
    }

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Counts
  const counts = {
    total: filteredOrders.length,
    cash: filteredOrders.filter((o: any) => o.payment_method === "Online Transfer").length,
    cod: filteredOrders.filter((o: any) => o.payment_method === "COD").length,
  };

  // Checkbox handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(paginatedOrders.map((o: any) => o.id)));
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelection = new Set(selectedOrders);
    if (checked) {
      newSelection.add(orderId);
    } else {
      newSelection.delete(orderId);
    }
    setSelectedOrders(newSelection);
  };

  const isAllSelected = paginatedOrders.length > 0 && paginatedOrders.every((o: any) => selectedOrders.has(o.id));

  // Bulk Ship action
  const handleBulkShipped = async () => {
    if (selectedOrders.size === 0) {
      toast.error("Please select orders to mark as shipped");
      return;
    }

    setIsShipping(true);
    const today = new Date().toISOString().split("T")[0];

    try {
      const updatePromises = Array.from(selectedOrders).map((orderId) =>
        supabase
          .from("customer_purchases")
          .update({
            delivery_status: "Shipped",
            date_processed: today,
            seo: "Shipped",
          })
          .eq("id", orderId)
      );

      await Promise.all(updatePromises);

      toast.success(`${selectedOrders.size} order(s) marked as Shipped`);
      queryClient.invalidateQueries({ queryKey: ["logistics-order"] });
      queryClient.invalidateQueries({ queryKey: ["logistics-processed"] });
      setSelectedOrders(new Set());
    } catch (error: any) {
      toast.error(error.message || "Failed to update orders");
    } finally {
      setIsShipping(false);
    }
  };

  // Bulk Print action
  const handleBulkPrint = async () => {
    if (selectedOrders.size === 0) {
      toast.error("Please select orders to print waybills");
      return;
    }

    const selectedOrdersList = paginatedOrders.filter((o: any) => selectedOrders.has(o.id));
    const ordersWithTracking = selectedOrdersList.filter((o: any) => o.tracking_number);

    if (ordersWithTracking.length === 0) {
      toast.error("Selected orders do not have tracking numbers");
      return;
    }

    setIsPrinting(true);

    try {
      const trackingNumbers = ordersWithTracking.map((o: any) => o.tracking_number);
      const { data: session } = await supabase.auth.getSession();

      const response = await supabase.functions.invoke("ninjavan-waybill", {
        body: { trackingNumbers, profileId: user?.id },
        headers: { Authorization: `Bearer ${session?.session?.access_token}` },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to fetch waybills");
      }

      if (response.data) {
        const blob = new Blob([response.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        toast.success(`Waybill for ${trackingNumbers.length} order(s) opened`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to generate waybills");
    } finally {
      setIsPrinting(false);
    }
  };

  // Process single order
  const handleProcessOrder = async (orderId: string) => {
    const today = new Date().toISOString().split("T")[0];
    try {
      await supabase
        .from("customer_purchases")
        .update({
          delivery_status: "Shipped",
          date_processed: today,
          seo: "Shipped",
        })
        .eq("id", orderId);

      toast.success("Order marked as Shipped");
      queryClient.invalidateQueries({ queryKey: ["logistics-order"] });
      queryClient.invalidateQueries({ queryKey: ["logistics-processed"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to process order");
    }
  };

  const handleFilterChange = () => {
    setCurrentPage(1);
    setSelectedOrders(new Set());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Order Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage pending orders ready for shipment
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{counts.total}</p>
                <p className="text-sm text-muted-foreground">Total Order Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{counts.cash}</p>
                <p className="text-sm text-muted-foreground">Online Transfer Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Truck className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{counts.cod}</p>
                <p className="text-sm text-muted-foreground">COD Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search... (use + to combine filters)"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); handleFilterChange(); }}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); handleFilterChange(); }}
                  className="w-40"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); handleFilterChange(); }}
                  className="w-40"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Payment:</span>
                <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); handleFilterChange(); }}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Show:</span>
                <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">entries</span>
              </div>

              <div className="flex-1" />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleBulkPrint}
                  disabled={selectedOrders.size === 0 || isPrinting}
                >
                  {isPrinting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
                  Print ({selectedOrders.size})
                </Button>
                <Button
                  onClick={handleBulkShipped}
                  disabled={selectedOrders.size === 0 || isShipping}
                >
                  {isShipping ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Shipped ({selectedOrders.size})
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left w-10">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="p-3 text-left">No</th>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Customer</th>
                      <th className="p-3 text-left">Phone</th>
                      <th className="p-3 text-left">Product</th>
                      <th className="p-3 text-left">Qty</th>
                      <th className="p-3 text-left">Total</th>
                      <th className="p-3 text-left">Payment</th>
                      <th className="p-3 text-left">Tracking</th>
                      <th className="p-3 text-left">State</th>
                      <th className="p-3 text-left">Address</th>
                      <th className="p-3 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.length > 0 ? (
                      paginatedOrders.map((order: any, index: number) => (
                        <tr key={order.id} className="border-b hover:bg-muted/30">
                          <td className="p-3">
                            <Checkbox
                              checked={selectedOrders.has(order.id)}
                              onCheckedChange={(checked) => handleSelectOrder(order.id, !!checked)}
                            />
                          </td>
                          <td className="p-3">{(currentPage - 1) * pageSize + index + 1}</td>
                          <td className="p-3">{format(new Date(order.created_at), "dd-MM-yyyy")}</td>
                          <td className="p-3">{order.customer?.name || "-"}</td>
                          <td className="p-3">{order.customer?.phone || "-"}</td>
                          <td className="p-3">{order.product?.name || order.storehub_product || "-"}</td>
                          <td className="p-3">{order.quantity}</td>
                          <td className="p-3">RM {Number(order.total_price || 0).toFixed(2)}</td>
                          <td className="p-3">
                            <span className={order.payment_method === "COD" ? "text-orange-600 font-medium" : "text-blue-600 font-medium"}>
                              {order.payment_method}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-sm">{order.tracking_number || "-"}</td>
                          <td className="p-3">{order.customer?.state || "-"}</td>
                          <td className="p-3">
                            <div className="max-w-xs">
                              <p className="text-sm truncate">{order.customer?.address || "-"}</p>
                              <p className="text-xs text-muted-foreground">
                                {order.customer?.postcode} {order.customer?.city}
                              </p>
                            </div>
                          </td>
                          <td className="p-3">
                            <Button size="sm" onClick={() => handleProcessOrder(order.id)}>
                              Process
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={13} className="text-center py-12 text-muted-foreground">
                          No pending orders found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} entries
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
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

export default LogisticsOrder;
