import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Users, ShoppingCart, DollarSign, Package, FileText, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMalaysiaDate } from "@/lib/utils";
import { toast } from "sonner";
import Swal from "sweetalert2";

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
    queryKey: ["customer_marketer_purchases", user?.id, startDate, endDate, platformFilter, marketerFilter],
    queryFn: async () => {
      // Get marketer IDs under this branch
      const marketerIds = marketers?.map(m => m.id) || [];

      if (marketerIds.length === 0) {
        return [];
      }

      let query = supabase
        .from("customer_purchases")
        .select("*")
        .in("marketer_id", marketerIds)
        .order("date_order", { ascending: false, nullsFirst: false });

      if (startDate) {
        query = query.gte("date_order", startDate);
      }
      if (endDate) {
        query = query.lte("date_order", endDate);
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
    enabled: !!user?.id && !!marketers,
  });

  // Calculate statistics - exclude products named "COD" from stats
  const filteredPurchases = purchases?.filter(p => {
    const productName = p.produk || p.storehub_product || "";
    return !productName.toUpperCase().includes("COD");
  }) || [];

  const totalCustomers = new Set(filteredPurchases.map(p => p.customer_id)).size || 0;
  const totalTransactions = filteredPurchases.length;
  const totalUnitsPurchased = filteredPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0) || 0;
  const totalPrice = filteredPurchases.reduce((sum, p) => sum + (Number(p.total_price) || 0), 0);

  // Platform breakdown stats (using jenis_platform for marketer)
  const platformCounts = {
    facebook: filteredPurchases.filter(p => p.jenis_platform === "Facebook").length,
    tiktok: filteredPurchases.filter(p => p.jenis_platform === "Tiktok").length,
    shopee: filteredPurchases.filter(p => p.jenis_platform === "Shopee").length,
    other: filteredPurchases.filter(p => !["Facebook", "Tiktok", "Shopee"].includes(p.jenis_platform)).length,
  };

  const platformPercent = (count: number) => totalTransactions > 0 ? ((count / totalTransactions) * 100).toFixed(1) : "0.0";

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

  const platformStats = [
    { title: "Facebook", count: platformCounts.facebook, percent: platformPercent(platformCounts.facebook), color: "bg-blue-100 text-blue-800" },
    { title: "Tiktok", count: platformCounts.tiktok, percent: platformPercent(platformCounts.tiktok), color: "bg-pink-100 text-pink-800" },
    { title: "Shopee", count: platformCounts.shopee, percent: platformPercent(platformCounts.shopee), color: "bg-orange-100 text-orange-800" },
    { title: "Other", count: platformCounts.other, percent: platformPercent(platformCounts.other), color: "bg-gray-100 text-gray-800" },
  ];

  // Checkbox handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set((purchases || []).map((p: any) => p.id)));
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

  const isAllSelected = (purchases || []).length > 0 && (purchases || []).every((p: any) => selectedOrders.has(p.id));

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
              <div className="flex items-center justify-between">
                <div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${platform.color}`}>
                    {platform.title}
                  </span>
                  <p className="text-xl font-bold mt-2">{platform.count}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-muted-foreground">{platform.percent}%</p>
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
                    <label className="text-sm font-medium mb-2 block">Jenis Platform</label>
                    <Select value={platformFilter} onValueChange={setPlatformFilter}>
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
                    <Select value={marketerFilter} onValueChange={setMarketerFilter}>
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
                  <TableHead>Date</TableHead>
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
                {(purchases || []).map((purchase: any, index) => (
                  <TableRow key={purchase.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedOrders.has(purchase.id)}
                        onCheckedChange={(checked) => handleSelectOrder(purchase.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      {purchase.date_order ? format(new Date(purchase.date_order), "dd-MM-yyyy") : "-"}
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
                    <TableCell>{purchase.cara_bayaran || purchase.payment_method || "-"}</TableCell>
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
    </div>
  );
};

export default CustomerMarketer;
