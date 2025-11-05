import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShoppingCart, CheckCircle2, XCircle, Clock, Package, MessageSquare, DollarSign } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const TransactionAgent = () => {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingRemarks, setEditingRemarks] = useState<{ [key: string]: string }>({});
  const [remarkDialogOpen, setRemarkDialogOpen] = useState<{ [key: string]: boolean }>({});

  const { data: purchases, isLoading } = useQuery({
    queryKey: ["agent-purchases", startDate, endDate, statusFilter],
    queryFn: async () => {
      // Get Malaysia current date
      const now = new Date();
      const malaysiaNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));

      // Default to 1st of current month if startDate is empty
      const defaultStartDate = new Date(malaysiaNow.getFullYear(), malaysiaNow.getMonth(), 1);
      const defaultEndDate = malaysiaNow;

      // Use provided dates or defaults
      const effectiveStartDate = startDate || defaultStartDate.toISOString().split('T')[0];
      const effectiveEndDate = endDate || defaultEndDate.toISOString().split('T')[0];

      // Convert to UTC for database queries
      const startDateTime = effectiveStartDate + 'T00:00:00.000Z';
      const endDateTime = effectiveEndDate + 'T23:59:59.999Z';

      let query = supabase
        .from("agent_purchases" as any)
        .select(`
          *,
          agent:profiles!agent_id(idstaff, full_name, whatsapp_number, delivery_address),
          product:products(name, sku),
          bundle:bundles(name)
        `)
        .order("created_at", { ascending: false })
        .gte("created_at", startDateTime)
        .lte("created_at", endDateTime);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any;
    },
  });

  // Calculate statistics
  const totalTransactions = purchases?.length || 0;
  const totalSuccess = purchases?.filter(p => p.status === "completed").length || 0;
  const totalFailed = purchases?.filter(p => p.status === "failed").length || 0;
  const totalPending = purchases?.filter(p => p.status === "pending").length || 0;
  const totalUnitSuccess = purchases
    ?.filter(p => p.status === "completed")
    .reduce((sum, p) => sum + (p.quantity || 0), 0) || 0;
  const totalPriceSuccess = purchases
    ?.filter(p => p.status === "completed")
    .reduce((sum, p) => sum + (Number(p.total_price) || 0), 0) || 0;

  const updateStatusMutation = useMutation({
    mutationFn: async ({ purchaseId, status }: { purchaseId: string; status: string }) => {
      const purchase = purchases?.find(p => p.id === purchaseId);
      if (!purchase) throw new Error("Purchase not found");

      // Update purchase status
      const { error: updateError } = await supabase
        .from("agent_purchases" as any)
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", purchaseId);

      if (updateError) throw updateError;

      // If approved, update inventory
      if (status === "completed") {
        // Get master agent ID from the purchase
        const { data: masterAgentData } = await supabase
          .from("profiles")
          .select("master_agent_id")
          .eq("id", purchase.agent_id)
          .single();

        const masterAgentId = masterAgentData?.master_agent_id;

        if (!masterAgentId) {
          throw new Error("Master agent not found for this agent");
        }

        // Deduct from master agent inventory
        const { data: inventory, error: invError } = await supabase
          .from("inventory")
          .select("quantity")
          .eq("user_id", masterAgentId)
          .eq("product_id", purchase.product_id)
          .maybeSingle();

        if (invError) throw invError;

        const currentQty = inventory?.quantity || 0;
        const newQty = currentQty - purchase.quantity;

        if (newQty < 0) {
          throw new Error("Insufficient inventory");
        }

        if (inventory) {
          await supabase
            .from("inventory")
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq("user_id", masterAgentId)
            .eq("product_id", purchase.product_id);
        }

        // Add to agent inventory
        const { data: agentInv } = await supabase
          .from("inventory")
          .select("quantity")
          .eq("user_id", purchase.agent_id)
          .eq("product_id", purchase.product_id)
          .maybeSingle();

        if (agentInv) {
          await supabase
            .from("inventory")
            .update({
              quantity: agentInv.quantity + purchase.quantity,
              updated_at: new Date().toISOString()
            })
            .eq("user_id", purchase.agent_id)
            .eq("product_id", purchase.product_id);
        } else {
          await supabase
            .from("inventory")
            .insert({
              user_id: purchase.agent_id,
              product_id: purchase.product_id,
              quantity: purchase.quantity,
            });
        }
      }
    },
    onSuccess: () => {
      toast.success("Status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["agent-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  const updateRemarksMutation = useMutation({
    mutationFn: async ({ purchaseId, remarks }: { purchaseId: string; remarks: string }) => {
      const { error } = await supabase
        .from("agent_purchases" as any)
        .update({ remarks, updated_at: new Date().toISOString() })
        .eq("id", purchaseId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success("Remarks updated successfully");
      queryClient.invalidateQueries({ queryKey: ["agent-purchases"] });
      setEditingRemarks({});
      setRemarkDialogOpen(prev => ({ ...prev, [variables.purchaseId]: false }));
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update remarks");
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">SUCCESS</Badge>;
      case "failed":
        return <Badge variant="destructive">FAILED</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Transaction</p>
                <h3 className="text-3xl font-bold mt-2">{totalTransactions}</h3>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Success</p>
                <h3 className="text-3xl font-bold mt-2">{totalSuccess}</h3>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Failed</p>
                <h3 className="text-3xl font-bold mt-2">{totalFailed}</h3>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Pending</p>
                <h3 className="text-3xl font-bold mt-2">{totalPending}</h3>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Unit (Success)</p>
                <h3 className="text-3xl font-bold mt-2">{totalUnitSuccess}</h3>
              </div>
              <Package className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sales (Success)</p>
                <h3 className="text-3xl font-bold mt-2">RM {totalPriceSuccess.toFixed(2)}</h3>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History with Filters */}
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
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      placeholder="dd/mm/yyyy"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      placeholder="dd/mm/yyyy"
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger id="status">
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
          ) : purchases && purchases.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>IDSTAFF</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>No Whatsapp</TableHead>
                  <TableHead>Alamat</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Bundle</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Total Sale</TableHead>
                  <TableHead>Bank Holder</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Receipt Date</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Remark</TableHead>
                  <TableHead>Remark Done</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases?.map((purchase, index) => (
                  <TableRow key={purchase.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{format(new Date(purchase.created_at), "dd-MM-yyyy")}</TableCell>
                    <TableCell>{purchase.agent?.idstaff || "-"}</TableCell>
                    <TableCell>{purchase.agent?.full_name || "-"}</TableCell>
                    <TableCell>{purchase.agent?.whatsapp_number || "-"}</TableCell>
                    <TableCell>{purchase.agent?.delivery_address || "-"}</TableCell>
                    <TableCell>{purchase.product?.name}</TableCell>
                    <TableCell>{purchase.bundle?.name}</TableCell>
                    <TableCell>{purchase.quantity}</TableCell>
                    <TableCell>RM {Number(purchase.total_price || 0).toFixed(2)}</TableCell>
                    <TableCell>{purchase.bank_holder_name || "-"}</TableCell>
                    <TableCell>{purchase.bank_name || "-"}</TableCell>
                    <TableCell>{purchase.receipt_date ? format(new Date(purchase.receipt_date), "dd-MM-yyyy") : "-"}</TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">View</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>Payment Receipt</DialogTitle>
                          </DialogHeader>
                          <img
                            src={purchase.receipt_image_url}
                            alt="Payment receipt"
                            className="w-full h-auto"
                          />
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                    <TableCell>{getStatusBadge(purchase.status)}</TableCell>
                    <TableCell>
                      {purchase.status === "pending" ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              updateStatusMutation.mutate({
                                purchaseId: purchase.id,
                                status: "completed",
                              })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              updateStatusMutation.mutate({
                                purchaseId: purchase.id,
                                status: "failed",
                              })
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Dialog
                        open={remarkDialogOpen[purchase.id]}
                        onOpenChange={(open) => {
                          setRemarkDialogOpen(prev => ({ ...prev, [purchase.id]: open }));
                          if (open) {
                            setEditingRemarks(prev => ({ ...prev, [purchase.id]: purchase.remarks || "" }));
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                          <DialogHeader>
                            <DialogTitle>Order Remark</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <Textarea
                              value={editingRemarks[purchase.id] ?? ""}
                              onChange={(e) => setEditingRemarks(prev => ({
                                ...prev,
                                [purchase.id]: e.target.value
                              }))}
                              placeholder="Enter remark here..."
                              className="min-h-[120px]"
                            />
                            <Button
                              onClick={() =>
                                updateRemarksMutation.mutate({
                                  purchaseId: purchase.id,
                                  remarks: editingRemarks[purchase.id] || ""
                                })
                              }
                              className="w-full"
                            >
                              Save Remark
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{purchase.remarks || "-"}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              No purchase transactions yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionAgent;
