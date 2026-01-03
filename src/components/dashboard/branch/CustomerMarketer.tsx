import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Users, ShoppingCart, DollarSign, Package, FileText, Trash2, Loader2, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMalaysiaDate } from "@/lib/utils";
import { toast } from "sonner";
import Swal from "sweetalert2";
import PaymentDetailsModal from "./PaymentDetailsModal";

const CustomerMarketer = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = getMalaysiaDate();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [marketerFilter, setMarketerFilter] = useState("all");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick search state (search without date filter)
  const [quickSearch, setQuickSearch] = useState("");
  const [isQuickSearchActive, setIsQuickSearchActive] = useState(false);

  // Payment details modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentModalOrder, setPaymentModalOrder] = useState<any>(null);

  // State for date edit modal
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [selectedPurchaseForDate, setSelectedPurchaseForDate] = useState<any>(null);
  const [dateEditType, setDateEditType] = useState<"date_order" | "date_processed">("date_order");
  const [newDate, setNewDate] = useState<string>("");

  // Fetch marketers under this branch
  const { data: marketers } = useQuery({
    queryKey: ["branch-marketers", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, idstaff, full_name")
        .eq("branch_id", user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch customer purchases from marketers (where marketer_id IS NOT NULL)
  const { data: purchases, isLoading } = useQuery({
    queryKey: ["customer_marketer_purchases", user?.id, startDate, endDate, platformFilter, marketerFilter, isQuickSearchActive],
    queryFn: async () => {
      let query = supabase
        .from("customer_purchases")
        .select("*")
        .eq("seller_id", user?.id)
        .not("marketer_id", "is", null)
        .order("date_order", { ascending: false, nullsFirst: false });

      // When Quick Search is active, don't filter by date - search ALL records
      if (!isQuickSearchActive) {
        if (startDate) {
          query = query.gte("date_order", startDate);
        }
        if (endDate) {
          query = query.lte("date_order", endDate);
        }
      }
      if (platformFilter !== "all") {
        query = query.eq("jenis_platform", platformFilter);
      }
      if (marketerFilter !== "all") {
        query = query.eq("marketer_id", marketerFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Quick search filter function
  const quickSearchFilteredPurchases = isQuickSearchActive && quickSearch
    ? (purchases || []).filter((p: any) => {
        const searchTerm = quickSearch.toLowerCase();
        return (
          p.marketer_name?.toLowerCase().includes(searchTerm) ||
          p.no_phone?.includes(quickSearch) ||
          p.tracking_number?.toLowerCase().includes(searchTerm)
        );
      })
    : purchases || [];

  // Calculate statistics - exclude products named "COD" from stats
  const filteredPurchases = quickSearchFilteredPurchases.filter(p => {
    const productName = p.produk || p.storehub_product || "";
    return !productName.toUpperCase().includes("COD");
  });

  const totalCustomers = new Set(filteredPurchases.map(p => p.customer_id)).size || 0;
  const totalTransactions = filteredPurchases.length;
  const totalUnitsPurchased = filteredPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0) || 0;
  const totalPrice = filteredPurchases.reduce((sum, p) => sum + (Number(p.total_price) || 0), 0);

  // Platform breakdown stats with all metrics (using jenis_platform for marketer)
  const getPlatformStats = (platformName: string, isOther: boolean = false) => {
    const platformPurchases = isOther
      ? filteredPurchases.filter(p => !["Facebook", "Tiktok", "Shopee"].includes(p.jenis_platform))
      : filteredPurchases.filter(p => p.jenis_platform === platformName);
    return {
      customers: new Set(platformPurchases.map(p => p.no_phone)).size,
      transactions: platformPurchases.length,
      units: platformPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0),
      revenue: platformPurchases.reduce((sum, p) => sum + (Number(p.total_price) || 0), 0),
    };
  };

  const platformStats = [
    { title: "Facebook", ...getPlatformStats("Facebook"), color: "bg-blue-100 text-blue-800" },
    { title: "Tiktok", ...getPlatformStats("Tiktok"), color: "bg-pink-100 text-pink-800" },
    { title: "Shopee", ...getPlatformStats("Shopee"), color: "bg-orange-100 text-orange-800" },
    { title: "Other", ...getPlatformStats("", true), color: "bg-gray-100 text-gray-800" },
  ];

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

  // Check if payment details should be clickable (Online Transfer from Facebook, Google, Database)
  const isPaymentClickable = (purchase: any) => {
    const platform = purchase.jenis_platform?.toLowerCase() || "";
    const isNinjavanSource = platform === "facebook" || platform === "google" || platform === "database";
    const paymentMethod = purchase.cara_bayaran || purchase.payment_method;
    const isOnlinePayment = paymentMethod === "Online Transfer";
    return isNinjavanSource && isOnlinePayment;
  };

  // Open payment details modal
  const handleOpenPaymentDetails = (purchase: any) => {
    setPaymentModalOrder({
      tarikh_bayaran: purchase.tarikh_bayaran,
      jenis_bayaran: purchase.jenis_bayaran,
      bank: purchase.bank,
      receipt_image_url: purchase.receipt_image_url,
      payment_method: purchase.cara_bayaran || purchase.payment_method,
      total_price: purchase.total_price,
      customer: { name: purchase.marketer_name },
    });
    setPaymentModalOpen(true);
  };

  // Checkbox handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(quickSearchFilteredPurchases.map((p: any) => p.id)));
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

  const isAllSelected = quickSearchFilteredPurchases.length > 0 && quickSearchFilteredPurchases.every((p: any) => selectedOrders.has(p.id));

  // Handle quick search button click
  const handleQuickSearch = () => {
    if (quickSearch.trim()) {
      setIsQuickSearchActive(true);
    }
  };

  // Clear quick search
  const clearQuickSearch = () => {
    setQuickSearch("");
    setIsQuickSearchActive(false);
  };

  // Open date edit modal
  const openDateModal = (purchase: any, type: "date_order" | "date_processed") => {
    setSelectedPurchaseForDate(purchase);
    setDateEditType(type);
    const currentDate = type === "date_order" ? purchase.date_order : purchase.date_processed;
    setNewDate(currentDate || "");
    setDateModalOpen(true);
  };

  // Save date from modal
  const saveDate = async () => {
    if (!selectedPurchaseForDate) return;

    try {
      const updateData: any = {};
      updateData[dateEditType] = newDate || null;

      const { error } = await supabase
        .from("customer_purchases")
        .update(updateData)
        .eq("id", selectedPurchaseForDate.id);

      if (error) throw error;

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ["customer_marketer_purchases"] });
      toast.success(`${dateEditType === "date_order" ? "Date Order" : "Date Processed"} updated`);
      setDateModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update date");
    }
  };

  // Delete selected orders
  const handleDeleteSelected = async () => {
    if (selectedOrders.size === 0) {
      toast.error("Please select orders to delete");
      return;
    }

    const result = await Swal.fire({
      icon: "warning",
      title: "Delete Orders?",
      text: `Are you sure you want to delete ${selectedOrders.size} order(s)? This action cannot be undone.`,
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedOrders).map((orderId) =>
        supabase.from("customer_purchases").delete().eq("id", orderId)
      );

      await Promise.all(deletePromises);

      toast.success(`${selectedOrders.size} order(s) deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ["customer_marketer_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setSelectedOrders(new Set());
    } catch (error: any) {
      toast.error(error.message || "Failed to delete orders");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Customer Marketer</h1>
          <p className="text-muted-foreground mt-2">
            View orders from marketers under your branch
          </p>
        </div>
        <div className="flex gap-2">
          {selectedOrders.size > 0 && (
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete ({selectedOrders.size})
            </Button>
          )}
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

      {/* Platform Breakdown Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {platformStats.map((platform) => (
          <Card key={platform.title}>
            <CardContent className="p-4">
              <div className="mb-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${platform.color}`}>
                  {platform.title}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Customers</p>
                  <p className="font-bold">{platform.customers}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Transactions</p>
                  <p className="font-bold">{platform.transactions}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Units</p>
                  <p className="font-bold">{platform.units}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Revenue</p>
                  <p className="font-bold text-green-600">RM {platform.revenue.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Card with Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Marketer Orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Search - Search by Name/Phone/Tracking without Date */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Quick Search</span>
                </div>
                <div className="flex flex-1 gap-2 items-center">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter name, phone, or tracking number..."
                      value={quickSearch}
                      onChange={(e) => {
                        setQuickSearch(e.target.value);
                        if (!e.target.value) setIsQuickSearchActive(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleQuickSearch();
                      }}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={handleQuickSearch} className="bg-primary hover:bg-primary/90">
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </Button>
                  {isQuickSearchActive && (
                    <Button variant="outline" onClick={clearQuickSearch}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  )}
                </div>
                {isQuickSearchActive && (
                  <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded">
                    Showing results for: "{quickSearch}"
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

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
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setIsQuickSearchActive(false);
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">End Date</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setIsQuickSearchActive(false);
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Jenis Platform</label>
                    <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); setIsQuickSearchActive(false); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Platforms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Platforms</SelectItem>
                        <SelectItem value="Facebook">Facebook</SelectItem>
                        <SelectItem value="Tiktok">Tiktok</SelectItem>
                        <SelectItem value="Shopee">Shopee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Marketer</label>
                    <Select value={marketerFilter} onValueChange={(v) => { setMarketerFilter(v); setIsQuickSearchActive(false); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Marketers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Marketers</SelectItem>
                        {marketers?.map((marketer) => (
                          <SelectItem key={marketer.id} value={marketer.id}>
                            {marketer.idstaff} - {marketer.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          {isLoading ? (
            <p>Loading marketer orders...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>No</TableHead>
                  <TableHead>Date Order</TableHead>
                  <TableHead>Date Processed</TableHead>
                  <TableHead>Marketer</TableHead>
                  <TableHead>Platform</TableHead>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quickSearchFilteredPurchases.map((purchase: any, index) => (
                  <TableRow key={purchase.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedOrders.has(purchase.id)}
                        onCheckedChange={(checked) => handleSelectOrder(purchase.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <span
                        onClick={() => openDateModal(purchase, "date_order")}
                        className="cursor-pointer hover:underline text-blue-600"
                      >
                        {purchase.date_order ? format(new Date(purchase.date_order), "dd-MM-yyyy") : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        onClick={() => openDateModal(purchase, "date_processed")}
                        className="cursor-pointer hover:underline text-purple-600"
                      >
                        {purchase.date_processed ? format(new Date(purchase.date_processed), "dd-MM-yyyy") : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {purchase.marketer_id_staff || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        purchase.jenis_platform === "Facebook"
                          ? "bg-blue-100 text-blue-800"
                          : purchase.jenis_platform === "Tiktok"
                          ? "bg-pink-100 text-pink-800"
                          : purchase.jenis_platform === "Shopee"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {purchase.jenis_platform || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{purchase.marketer_name || "-"}</TableCell>
                    <TableCell>{purchase.no_phone || "-"}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {purchase.alamat || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{purchase.negeri || "-"}</TableCell>
                    <TableCell>
                      {isPaymentClickable(purchase) ? (
                        <button
                          onClick={() => handleOpenPaymentDetails(purchase)}
                          className="text-blue-600 font-medium hover:underline cursor-pointer"
                        >
                          {purchase.cara_bayaran || purchase.payment_method}
                        </button>
                      ) : (
                        <span className={(purchase.cara_bayaran || purchase.payment_method) === "COD" ? "text-orange-600 font-medium" : ""}>
                          {purchase.cara_bayaran || purchase.payment_method || "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{purchase.jenis_closing || "-"}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {purchase.produk || purchase.storehub_product || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{purchase.quantity || 0}</TableCell>
                    <TableCell>RM {Number(purchase.total_price || 0).toFixed(2)}</TableCell>
                    <TableCell>{purchase.tracking_number || "-"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        purchase.delivery_status === "Success"
                          ? "bg-green-100 text-green-800"
                          : purchase.delivery_status === "Return"
                          ? "bg-red-100 text-red-800"
                          : purchase.delivery_status === "Processed"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {purchase.delivery_status || "Pending"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          window.open(`/invoice?order=${purchase.id}&type=customer`, '_blank');
                        }}
                        title="View Invoice"
                      >
                        <FileText className="h-4 w-4 text-blue-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Details Modal */}
      <PaymentDetailsModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        order={paymentModalOrder}
      />

      {/* Date Edit Modal */}
      <Dialog open={dateModalOpen} onOpenChange={setDateModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              Edit {dateEditType === "date_order" ? "Date Order" : "Date Processed"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              {dateEditType === "date_order" ? "Date Order" : "Date Processed"}
            </label>
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveDate}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerMarketer;
