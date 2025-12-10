import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  RotateCcw,
  Loader2,
  Printer,
  Send,
  XCircle,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";

type DeliveryStatus = "Pending" | "Shipped" | "Success" | "Return";

const BranchLogistics = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("order");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Selection states
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedShipped, setSelectedShipped] = useState<Set<string>>(new Set());
  const [selectedReturn, setSelectedReturn] = useState<Set<string>>(new Set());
  const [selectedPendingTracking, setSelectedPendingTracking] = useState<Set<string>>(new Set());

  // Loading states
  const [isShipping, setIsShipping] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch customer purchases (Manual only - not StoreHub)
  const { data: purchases, isLoading } = useQuery({
    queryKey: ["branch-logistics", user?.id, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("customer_purchases")
        .select(`
          *,
          customer:customers(name, phone, address, state),
          product:products(name, sku)
        `)
        .eq("seller_id", user?.id)
        .or("platform.is.null,platform.neq.StoreHub") // Only Manual platform (not StoreHub)
        .order("created_at", { ascending: false });

      if (startDate) {
        query = query.gte("created_at", startDate + 'T00:00:00.000Z');
      }
      if (endDate) {
        query = query.lte("created_at", endDate + 'T23:59:59.999Z');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Filter purchases by status
  const getFilteredPurchases = (status: DeliveryStatus | "PendingTracking") => {
    if (!purchases) return [];

    let filtered = purchases.filter((p: any) => {
      // Search filter
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        const matches =
          p.customer?.name?.toLowerCase().includes(search) ||
          p.customer?.phone?.toLowerCase().includes(search) ||
          p.tracking_number?.toLowerCase().includes(search) ||
          p.product?.name?.toLowerCase().includes(search);
        if (!matches) return false;
      }
      return true;
    });

    if (status === "PendingTracking") {
      // Shipped + COD + not yet marked as Success
      return filtered.filter(
        (p: any) =>
          p.delivery_status === "Shipped" &&
          p.payment_method === "COD" &&
          p.seo !== "Successfull Delivery"
      );
    }

    return filtered.filter((p: any) => {
      const deliveryStatus = p.delivery_status || "Pending";
      return deliveryStatus === status;
    });
  };

  const pendingOrders = getFilteredPurchases("Pending");
  const shippedOrders = getFilteredPurchases("Shipped");
  const successOrders = getFilteredPurchases("Success");
  const returnOrders = getFilteredPurchases("Return");
  const pendingTrackingOrders = getFilteredPurchases("PendingTracking");

  // Update delivery status mutation
  const updateStatus = useMutation({
    mutationFn: async ({
      purchaseId,
      newStatus,
      dateField,
    }: {
      purchaseId: string;
      newStatus: DeliveryStatus;
      dateField?: string;
    }) => {
      const updateData: any = { delivery_status: newStatus };

      if (dateField) {
        updateData[dateField] = new Date().toISOString().split('T')[0];
      }

      if (newStatus === "Shipped") {
        updateData.seo = "Shipped";
        updateData.date_processed = new Date().toISOString().split('T')[0];
      } else if (newStatus === "Success") {
        updateData.seo = "Successfull Delivery";
        updateData.tarikh_bayaran = new Date().toISOString().split('T')[0];
      } else if (newStatus === "Return") {
        updateData.seo = "Return";
        updateData.date_return = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from("customer_purchases")
        .update(updateData)
        .eq("id", purchaseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-logistics"] });
      toast.success("Status updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  // Bulk Ship selected orders
  const handleBulkShip = async () => {
    if (selectedOrders.size === 0) {
      toast.error("Please select orders to ship");
      return;
    }

    setIsShipping(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      const updatePromises = Array.from(selectedOrders).map((id) =>
        supabase
          .from("customer_purchases")
          .update({
            delivery_status: "Shipped",
            date_processed: today,
            seo: "Shipped",
          })
          .eq("id", id)
      );

      await Promise.all(updatePromises);
      queryClient.invalidateQueries({ queryKey: ["branch-logistics"] });
      setSelectedOrders(new Set());
      toast.success(`${selectedOrders.size} order(s) marked as Shipped`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update orders");
    } finally {
      setIsShipping(false);
    }
  };

  // Bulk Print Waybills
  const handleBulkPrint = async (orders: any[], selectedSet: Set<string>) => {
    const selectedOrdersList = orders.filter((o) => selectedSet.has(o.id));

    if (selectedOrdersList.length === 0) {
      toast.error("Please select orders to print waybills");
      return;
    }

    // Get orders with tracking numbers
    const ordersWithTracking = selectedOrdersList.filter((o) => o.tracking_number);

    if (ordersWithTracking.length === 0) {
      toast.error("Selected orders do not have tracking numbers");
      return;
    }

    setIsPrinting(true);

    try {
      const trackingNumbers = ordersWithTracking.map((o) => o.tracking_number);
      const { data: session } = await supabase.auth.getSession();

      const response = await supabase.functions.invoke("ninjavan-waybill", {
        body: {
          trackingNumbers,
          profileId: user?.id,
        },
        headers: {
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to fetch waybills");
      }

      // The response.data is the PDF blob
      if (response.data) {
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        toast.success(`Waybill for ${trackingNumbers.length} order(s) opened in new tab`);
      }
    } catch (error: any) {
      console.error("Error fetching waybills:", error);
      toast.error(error.message || "Failed to generate waybills");
    } finally {
      setIsPrinting(false);
    }
  };

  // Cancel NinjaVan order
  const handleCancelOrder = async (trackingNumber: string, purchaseId: string) => {
    const result = await Swal.fire({
      title: "Cancel Order",
      text: `Are you sure you want to cancel NinjaVan order ${trackingNumber}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, cancel it",
      cancelButtonText: "No, keep it",
    });

    if (!result.isConfirmed) return;

    setIsCancelling(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      const response = await supabase.functions.invoke("ninjavan-cancel", {
        body: {
          trackingNumber,
          profileId: user?.id,
        },
        headers: {
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to cancel order");
      }

      // Update local record
      await supabase
        .from("customer_purchases")
        .update({
          delivery_status: "Pending",
          tracking_number: null,
          ninjavan_order_id: null,
          date_processed: null,
          seo: null,
        })
        .eq("id", purchaseId);

      queryClient.invalidateQueries({ queryKey: ["branch-logistics"] });
      toast.success("NinjaVan order cancelled successfully");
    } catch (error: any) {
      console.error("Error cancelling order:", error);
      toast.error(error.message || "Failed to cancel order");
    } finally {
      setIsCancelling(false);
    }
  };

  // Bulk mark COD as received
  const handleBulkCODReceived = async () => {
    if (selectedPendingTracking.size === 0) {
      toast.error("Please select orders to mark as COD received");
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    try {
      const updatePromises = Array.from(selectedPendingTracking).map((id) =>
        supabase
          .from("customer_purchases")
          .update({
            delivery_status: "Success",
            seo: "Successfull Delivery",
            tarikh_bayaran: today,
          })
          .eq("id", id)
      );

      await Promise.all(updatePromises);
      queryClient.invalidateQueries({ queryKey: ["branch-logistics"] });
      setSelectedPendingTracking(new Set());
      toast.success(`${selectedPendingTracking.size} COD payment(s) marked as received`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update orders");
    }
  };

  // Checkbox handlers
  const handleSelectAll = (orders: any[], selectedSet: Set<string>, setSelected: React.Dispatch<React.SetStateAction<Set<string>>>, checked: boolean) => {
    if (checked) {
      setSelected(new Set(orders.map((o) => o.id)));
    } else {
      setSelected(new Set());
    }
  };

  const handleSelectOne = (id: string, selectedSet: Set<string>, setSelected: React.Dispatch<React.SetStateAction<Set<string>>>, checked: boolean) => {
    const newSet = new Set(selectedSet);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelected(newSet);
  };

  const handleStatusChange = async (purchaseId: string, newStatus: DeliveryStatus) => {
    const result = await Swal.fire({
      title: "Update Status",
      text: `Are you sure you want to mark this order as ${newStatus}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, update it",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      updateStatus.mutate({ purchaseId, newStatus });
    }
  };

  const renderOrderTable = (
    orders: any[],
    selectedSet: Set<string>,
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
    showActions: boolean = true,
    actionType?: string
  ) => {
    if (orders.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No orders found
        </div>
      );
    }

    const isAllSelected = orders.length > 0 && orders.every((o) => selectedSet.has(o.id));

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={(checked) =>
                  handleSelectAll(orders, selectedSet, setSelected, !!checked)
                }
              />
            </TableHead>
            <TableHead>No</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Tracking No.</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order: any, index) => (
            <TableRow key={order.id}>
              <TableCell>
                <Checkbox
                  checked={selectedSet.has(order.id)}
                  onCheckedChange={(checked) =>
                    handleSelectOne(order.id, selectedSet, setSelected, !!checked)
                  }
                />
              </TableCell>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{format(new Date(order.created_at), "dd-MM-yyyy")}</TableCell>
              <TableCell>{order.customer?.name || "-"}</TableCell>
              <TableCell>{order.customer?.phone || "-"}</TableCell>
              <TableCell>{order.product?.name || order.storehub_product || "-"}</TableCell>
              <TableCell>{order.quantity}</TableCell>
              <TableCell>RM {Number(order.total_price || 0).toFixed(2)}</TableCell>
              <TableCell>
                <Badge variant={order.payment_method === "COD" ? "secondary" : "outline"}>
                  {order.payment_method}
                </Badge>
              </TableCell>
              <TableCell>
                {order.tracking_number ? (
                  <span className="font-mono text-sm">{order.tracking_number}</span>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    order.delivery_status === "Success"
                      ? "default"
                      : order.delivery_status === "Return"
                      ? "destructive"
                      : order.delivery_status === "Shipped"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {order.delivery_status || "Pending"}
                </Badge>
              </TableCell>
              {showActions && (
                <TableCell>
                  <div className="flex gap-1">
                    {actionType === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(order.id, "Shipped")}
                        disabled={updateStatus.isPending}
                      >
                        <Truck className="h-4 w-4 mr-1" />
                        Ship
                      </Button>
                    )}
                    {actionType === "shipped" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600"
                          onClick={() => handleStatusChange(order.id, "Success")}
                          disabled={updateStatus.isPending}
                          title="Mark as Delivered"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => handleStatusChange(order.id, "Return")}
                          disabled={updateStatus.isPending}
                          title="Mark as Return"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        {order.tracking_number && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-orange-600"
                            onClick={() => handleCancelOrder(order.tracking_number, order.id)}
                            disabled={isCancelling}
                            title="Cancel NinjaVan Order"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                    {actionType === "pendingTracking" && order.payment_method === "COD" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600"
                        onClick={() => handleStatusChange(order.id, "Success")}
                        disabled={updateStatus.isPending}
                      >
                        <Wallet className="h-4 w-4 mr-1" />
                        COD Received
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Logistics</h1>
        <p className="text-muted-foreground mt-2">
          Manage your manual orders and shipments (excludes StoreHub transactions)
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <Input
                placeholder="Search customer, phone, tracking..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
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
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Orders</p>
                <p className="text-2xl font-bold mt-2">{pendingOrders.length}</p>
              </div>
              <Package className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Shipped</p>
                <p className="text-2xl font-bold mt-2">{shippedOrders.length}</p>
              </div>
              <Truck className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold mt-2">{successOrders.length}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Tracking</p>
                <p className="text-2xl font-bold mt-2">{pendingTrackingOrders.length}</p>
              </div>
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="order" className="gap-2">
                <Package className="h-4 w-4" />
                Order ({pendingOrders.length})
              </TabsTrigger>
              <TabsTrigger value="processed" className="gap-2">
                <Truck className="h-4 w-4" />
                Processed ({shippedOrders.length})
              </TabsTrigger>
              <TabsTrigger value="return" className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Return ({returnOrders.length})
              </TabsTrigger>
              <TabsTrigger value="pending-tracking" className="gap-2">
                <Clock className="h-4 w-4" />
                Pending Tracking ({pendingTrackingOrders.length})
              </TabsTrigger>
            </TabsList>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Order Tab */}
                <TabsContent value="order" className="mt-4">
                  <div className="flex gap-2 mb-4">
                    <Button
                      onClick={handleBulkShip}
                      disabled={selectedOrders.size === 0 || isShipping}
                    >
                      {isShipping ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Ship Selected ({selectedOrders.size})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleBulkPrint(pendingOrders, selectedOrders)}
                      disabled={selectedOrders.size === 0 || isPrinting}
                    >
                      {isPrinting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Printer className="h-4 w-4 mr-2" />
                      )}
                      Print Waybill ({selectedOrders.size})
                    </Button>
                  </div>
                  <div className="rounded-md border">
                    {renderOrderTable(pendingOrders, selectedOrders, setSelectedOrders, true, "pending")}
                  </div>
                </TabsContent>

                {/* Processed Tab */}
                <TabsContent value="processed" className="mt-4">
                  <div className="flex gap-2 mb-4">
                    <Button
                      variant="outline"
                      onClick={() => handleBulkPrint(shippedOrders, selectedShipped)}
                      disabled={selectedShipped.size === 0 || isPrinting}
                    >
                      {isPrinting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Printer className="h-4 w-4 mr-2" />
                      )}
                      Print Waybill ({selectedShipped.size})
                    </Button>
                  </div>
                  <div className="rounded-md border">
                    {renderOrderTable(shippedOrders, selectedShipped, setSelectedShipped, true, "shipped")}
                  </div>
                </TabsContent>

                {/* Return Tab */}
                <TabsContent value="return" className="mt-4">
                  <div className="flex gap-2 mb-4">
                    <Button
                      variant="outline"
                      onClick={() => handleBulkPrint(returnOrders, selectedReturn)}
                      disabled={selectedReturn.size === 0 || isPrinting}
                    >
                      {isPrinting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Printer className="h-4 w-4 mr-2" />
                      )}
                      Print Waybill ({selectedReturn.size})
                    </Button>
                  </div>
                  <div className="rounded-md border">
                    {renderOrderTable(returnOrders, selectedReturn, setSelectedReturn, false)}
                  </div>
                </TabsContent>

                {/* Pending Tracking Tab */}
                <TabsContent value="pending-tracking" className="mt-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Orders that have been shipped but COD payment not yet received.
                  </p>
                  <div className="flex gap-2 mb-4">
                    <Button
                      onClick={handleBulkCODReceived}
                      disabled={selectedPendingTracking.size === 0}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Wallet className="h-4 w-4 mr-2" />
                      Mark COD Received ({selectedPendingTracking.size})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleBulkPrint(pendingTrackingOrders, selectedPendingTracking)}
                      disabled={selectedPendingTracking.size === 0 || isPrinting}
                    >
                      {isPrinting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Printer className="h-4 w-4 mr-2" />
                      )}
                      Print Waybill ({selectedPendingTracking.size})
                    </Button>
                  </div>
                  <div className="rounded-md border">
                    {renderOrderTable(
                      pendingTrackingOrders,
                      selectedPendingTracking,
                      setSelectedPendingTracking,
                      true,
                      "pendingTracking"
                    )}
                  </div>
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default BranchLogistics;
