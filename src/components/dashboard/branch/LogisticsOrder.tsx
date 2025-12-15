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
import { getMalaysiaDate } from "@/lib/utils";
import {
  Package,
  Truck,
  Clock,
  Loader2,
  Printer,
  Send,
  Search,
  ShoppingBag,
  Music2,
  DollarSign,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";

const PAYMENT_OPTIONS = ["All", "Online Transfer", "COD"];
const PLATFORM_OPTIONS = ["All", "Ninjavan", "Tiktok", "Shopee"];
const PAGE_SIZE_OPTIONS = [10, 50, 100];

const LogisticsOrder = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  // Filter states
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [platformFilter, setPlatformFilter] = useState("All");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Selection state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // Loading states
  const [isShipping, setIsShipping] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Fetch marketers under this branch
  const { data: marketers } = useQuery({
    queryKey: ["branch-marketers-logistics", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("branch_id", user?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch pending orders (both HQ orders and Marketer orders)
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["logistics-order", user?.id, startDate, endDate, marketers],
    queryFn: async () => {
      const marketerIds = marketers?.map(m => m.id) || [];

      // Query 1: HQ orders (seller_id = branch)
      let hqQuery = supabase
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
        hqQuery = hqQuery.gte("created_at", startDate + "T00:00:00.000Z");
      }
      if (endDate) {
        hqQuery = hqQuery.lte("created_at", endDate + "T23:59:59.999Z");
      }

      const { data: hqOrders, error: hqError } = await hqQuery;
      if (hqError) throw hqError;

      // Query 2: Marketer orders (marketer_id in branch's marketers)
      let marketerOrders: any[] = [];
      if (marketerIds.length > 0) {
        let marketerQuery = supabase
          .from("customer_purchases")
          .select(`
            *,
            customer:customers(name, phone, address, state, postcode, city),
            product:products(name, sku)
          `)
          .in("marketer_id", marketerIds)
          .eq("delivery_status", "Pending")
          .order("created_at", { ascending: false });

        if (startDate) {
          marketerQuery = marketerQuery.gte("created_at", startDate + "T00:00:00.000Z");
        }
        if (endDate) {
          marketerQuery = marketerQuery.lte("created_at", endDate + "T23:59:59.999Z");
        }

        const { data: mOrders, error: mError } = await marketerQuery;
        if (mError) throw mError;
        marketerOrders = mOrders || [];
      }

      // Combine and deduplicate by ID (same order might match both queries if seller_id = branch AND marketer_id in branch's marketers)
      const allOrders = [...(hqOrders || []), ...marketerOrders];
      const uniqueOrders = allOrders.filter((order, index, self) =>
        index === self.findIndex((o) => o.id === order.id)
      );
      uniqueOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return uniqueOrders;
    },
    enabled: !!user?.id,
  });

  // Helper function to determine order platform category
  const getOrderPlatformCategory = (order: any) => {
    const platform = order.jenis_platform?.toLowerCase() || "";
    if (platform === "tiktok") return "Tiktok";
    if (platform === "shopee") return "Shopee";
    // Everything else (Website, Facebook, etc.) goes through Ninjavan
    return "Ninjavan";
  };

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

    // Platform filter
    if (platformFilter !== "All") {
      const orderCategory = getOrderPlatformCategory(order);
      if (orderCategory !== platformFilter) {
        return false;
      }
    }

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Counts - use all orders (before platform filter) for stats
  // Ninjavan = orders that are NOT Tiktok, NOT Shopee, NOT StoreHub
  const ninjavanOrders = orders.filter((o: any) => {
    const platform = o.jenis_platform?.toLowerCase() || "";
    return platform !== "tiktok" && platform !== "shopee";
  });

  const counts = {
    // Total Order (Branch Order except storehub + Marketer order) - already excluded in query
    total: orders.length,
    // Order Tiktok (Tiktok Branch + Tiktok Marketer)
    tiktok: orders.filter((o: any) => o.jenis_platform?.toLowerCase() === "tiktok").length,
    // Order Shopee (Shopee Branch + Shopee Marketer)
    shopee: orders.filter((o: any) => o.jenis_platform?.toLowerCase() === "shopee").length,
    // Order Ninjavan (order branch and marketer order but except tiktok, shopee, storehub)
    ninjavan: ninjavanOrders.length,
    // Order Ninjavan COD
    ninjavanCod: ninjavanOrders.filter((o: any) => o.payment_method === "COD").length,
    // Order Ninjavan CASH (not COD)
    ninjavanCash: ninjavanOrders.filter((o: any) => o.payment_method !== "COD").length,
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
    const today = getMalaysiaDate();

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

    // Separate NinjaVan orders and Shopee/Tiktok orders
    const ninjavanOrders = selectedOrdersList.filter(
      (o: any) => o.jenis_platform !== "Shopee" && o.jenis_platform !== "Tiktok" && o.tracking_number
    );
    const marketplaceOrders = selectedOrdersList.filter(
      (o: any) => (o.jenis_platform === "Shopee" || o.jenis_platform === "Tiktok") && o.waybill_url
    );

    if (ninjavanOrders.length === 0 && marketplaceOrders.length === 0) {
      toast.error("Selected orders do not have waybills to print");
      return;
    }

    setIsPrinting(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      // Handle NinjaVan orders
      if (ninjavanOrders.length > 0) {
        const trackingNumbers = ninjavanOrders.map((o: any) => o.tracking_number);

        const response = await supabase.functions.invoke("ninjavan-waybill", {
          body: { trackingNumbers, profileId: user?.id },
          headers: { Authorization: `Bearer ${session?.session?.access_token}` },
        });

        if (response.error) {
          console.error("NinjaVan waybill error:", response.error);
          toast.error("Failed to fetch NinjaVan waybills");
        } else if (response.data) {
          const blob = new Blob([response.data], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
          toast.success(`NinjaVan waybill for ${trackingNumbers.length} order(s) opened`);
        }
      }

      // Handle Shopee/Tiktok orders (merge waybills)
      if (marketplaceOrders.length > 0) {
        const waybillUrls = marketplaceOrders.map((o: any) => o.waybill_url);

        const response = await supabase.functions.invoke("merge-waybills", {
          body: { waybillUrls },
          headers: { Authorization: `Bearer ${session?.session?.access_token}` },
        });

        if (response.error) {
          console.error("Marketplace waybill error:", response.error);
          toast.error("Failed to fetch Shopee/Tiktok waybills");
        } else if (response.data) {
          const blob = new Blob([response.data], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
          toast.success(`Shopee/Tiktok waybill for ${waybillUrls.length} order(s) opened`);
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to generate waybills");
    } finally {
      setIsPrinting(false);
    }
  };

  // Process single order
  const handleProcessOrder = async (orderId: string) => {
    const today = getMalaysiaDate();
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setPlatformFilter("All")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-6 h-6 text-orange-500" />
              <div>
                <p className="text-xl font-bold">{counts.total}</p>
                <p className="text-xs text-muted-foreground">Total Order</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setPlatformFilter("Tiktok")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Music2 className="w-6 h-6 text-pink-500" />
              <div>
                <p className="text-xl font-bold">{counts.tiktok}</p>
                <p className="text-xs text-muted-foreground">Order Tiktok</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setPlatformFilter("Shopee")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-orange-600" />
              <div>
                <p className="text-xl font-bold">{counts.shopee}</p>
                <p className="text-xs text-muted-foreground">Order Shopee</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setPlatformFilter("Ninjavan")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Truck className="w-6 h-6 text-red-500" />
              <div>
                <p className="text-xl font-bold">{counts.ninjavan}</p>
                <p className="text-xs text-muted-foreground">Order Ninjavan</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-yellow-600" />
              <div>
                <p className="text-xl font-bold">{counts.ninjavanCod}</p>
                <p className="text-xs text-muted-foreground">Ninjavan COD</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-green-500" />
              <div>
                <p className="text-xl font-bold">{counts.ninjavanCash}</p>
                <p className="text-xs text-muted-foreground">Ninjavan CASH</p>
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
                <span className="text-sm text-muted-foreground">Platform:</span>
                <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); handleFilterChange(); }}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt === "All" ? "All Order" : opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                      <th className="p-3 text-left">ID Marketer</th>
                      <th className="p-3 text-left">Marketer</th>
                      <th className="p-3 text-left">Customer</th>
                      <th className="p-3 text-left">Phone</th>
                      <th className="p-3 text-left">Product</th>
                      <th className="p-3 text-left">Qty</th>
                      <th className="p-3 text-left">Total</th>
                      <th className="p-3 text-left">Payment</th>
                      <th className="p-3 text-left">Tracking</th>
                      <th className="p-3 text-left">State</th>
                      <th className="p-3 text-left">Address</th>
                      <th className="p-3 text-left">Nota</th>
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
                          <td className="p-3 font-mono text-xs">{order.marketer_id_staff || "-"}</td>
                          <td className="p-3">{order.marketer_name || "-"}</td>
                          <td className="p-3">{order.customer?.name || order.marketer_name || "-"}</td>
                          <td className="p-3">{order.customer?.phone || order.no_phone || "-"}</td>
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
                              <p className="text-sm truncate">{order.alamat || order.customer?.address || "-"}</p>
                              <p className="text-xs text-muted-foreground">
                                {order.customer?.postcode} {order.customer?.city}
                              </p>
                            </div>
                          </td>
                          <td className="p-3">
                            <p className="text-sm truncate max-w-xs">{order.nota_staff || "-"}</p>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={15} className="text-center py-12 text-muted-foreground">
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
