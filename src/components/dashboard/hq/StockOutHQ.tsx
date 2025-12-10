import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Minus, Calendar, Pencil, Trash2, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const StockOutHQ = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [stockDate, setStockDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [selectedMasterAgent, setSelectedMasterAgent] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [recipientType, setRecipientType] = useState<"none" | "master_agent" | "branch">("none");
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: masterAgents } = useQuery({
    queryKey: ["master-agents"],
    queryFn: async () => {
      // First get all user_ids with master_agent role
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "master_agent");

      if (rolesError) throw rolesError;
      if (!userRoles || userRoles.length === 0) return [];

      const masterAgentIds = userRoles.map(ur => ur.user_id);

      // Then get profiles for those user_ids
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, idstaff")
        .in("id", masterAgentIds);

      if (error) throw error;
      return data;
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches-list"],
    queryFn: async () => {
      // First get all user_ids with branch role
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "branch");

      if (rolesError) throw rolesError;
      if (!userRoles || userRoles.length === 0) return [];

      const branchIds = userRoles.map(ur => ur.user_id);

      // Then get profiles for those user_ids
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, idstaff")
        .in("id", branchIds);

      if (error) throw error;
      return data;
    },
  });

  // Get pending stock requests from branches
  const { data: pendingRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ["branch-stock-requests-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_stock_requests")
        .select(`
          *,
          product:products(name, sku),
          branch:profiles!branch_stock_requests_branch_id_fkey(idstaff, full_name)
        `)
        .eq("status", "pending")
        .order("requested_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: stockOuts, isLoading } = useQuery({
    queryKey: ["stock-out-hq", startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("stock_out_hq")
        .select(`
          *,
          product:products(name, sku)
        `)
        .order("date", { ascending: false });

      if (startDate) {
        query = query.gte("date", startDate);
      }
      if (endDate) {
        query = query.lte("date", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const removeStock = useMutation({
    mutationFn: async () => {
      // Check if sufficient inventory exists
      const { data: existing, error: fetchError } = await supabase
        .from("inventory")
        .select("*")
        .eq("user_id", user?.id)
        .eq("product_id", selectedProduct)
        .single();

      if (fetchError || !existing) {
        throw new Error("No inventory found for this product");
      }

      const quantityToRemove = parseInt(quantity);
      if (existing.quantity < quantityToRemove) {
        throw new Error(`Insufficient inventory. Available: ${existing.quantity}, Requested: ${quantityToRemove}`);
      }

      // Get product details for pricing
      const { data: product } = await supabase
        .from("products")
        .select("price_hq_to_ma")
        .eq("id", selectedProduct)
        .single();

      // Determine recipient
      const recipientId = recipientType === "master_agent" ? selectedMasterAgent :
                          recipientType === "branch" ? selectedBranch : null;

      // Insert stock out record with recipient info
      const { error: stockOutError } = await supabase
        .from("stock_out_hq")
        .insert({
          user_id: user?.id,
          product_id: selectedProduct,
          quantity: quantityToRemove,
          date: stockDate,
          description: description || null,
          recipient_id: recipientId,
          recipient_type: recipientType !== "none" ? recipientType : null,
        });

      if (stockOutError) throw stockOutError;

      // Update HQ inventory (decrease)
      const newQuantity = existing.quantity - quantityToRemove;
      const { error: updateError } = await supabase
        .from("inventory")
        .update({ quantity: newQuantity })
        .eq("id", existing.id);

      if (updateError) throw updateError;

      // If master agent is selected, create pending_order record and update MA inventory
      if (recipientType === "master_agent" && selectedMasterAgent && selectedMasterAgent.trim() !== "") {
        const unitPrice = product?.price_hq_to_ma || 0;
        const totalPrice = unitPrice * quantityToRemove;

        // Generate order number
        const orderNumber = `HQ-${Date.now()}`;

        // Create pending_orders record with billplz_bill_id = 'HQ' for HQ manual transfers
        const { error: orderError } = await supabase
          .from("pending_orders")
          .insert({
            order_number: orderNumber,
            buyer_id: selectedMasterAgent,
            product_id: selectedProduct,
            quantity: quantityToRemove,
            unit_price: unitPrice,
            total_price: totalPrice,
            status: "completed",
            transaction_id: "HQ_MANUAL_TRANSFER",
            billplz_bill_id: "HQ",
            remarks: description || `Manual stock transfer from HQ - Date: ${stockDate}`,
          });

        if (orderError) throw orderError;

        // Check if MA already has inventory for this product
        const { data: maInventory } = await supabase
          .from("inventory")
          .select("*")
          .eq("user_id", selectedMasterAgent)
          .eq("product_id", selectedProduct)
          .single();

        if (maInventory) {
          // Update existing MA inventory (increase)
          const { error: maUpdateError } = await supabase
            .from("inventory")
            .update({ quantity: maInventory.quantity + quantityToRemove })
            .eq("id", maInventory.id);

          if (maUpdateError) throw maUpdateError;
        } else {
          // Create new inventory record for MA
          const { error: maInsertError } = await supabase
            .from("inventory")
            .insert({
              user_id: selectedMasterAgent,
              product_id: selectedProduct,
              quantity: quantityToRemove,
            });

          if (maInsertError) throw maInsertError;
        }
      }

      // If branch is selected, create stock_in_branch record and update Branch inventory
      if (recipientType === "branch" && selectedBranch && selectedBranch.trim() !== "") {
        // Create stock_in_branch record for the branch
        const { data: stockOutRecord } = await supabase
          .from("stock_out_hq")
          .select("id")
          .eq("user_id", user?.id)
          .eq("product_id", selectedProduct)
          .eq("date", stockDate)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const { error: stockInBranchError } = await supabase
          .from("stock_in_branch")
          .insert({
            branch_id: selectedBranch,
            product_id: selectedProduct,
            quantity: quantityToRemove,
            description: description || `Stock transfer from HQ - Date: ${stockDate}`,
            date: stockDate,
            source_type: "hq",
            hq_stock_out_id: stockOutRecord?.id || null,
          });

        if (stockInBranchError) throw stockInBranchError;

        // Branch inventory is automatically updated by the database trigger
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-out-hq"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-in-branch"] });

      const message = recipientType === "master_agent"
        ? "Stock transferred to Master Agent successfully"
        : recipientType === "branch"
        ? "Stock transferred to Branch successfully"
        : "Stock out recorded successfully";
      toast.success(message);

      setIsDialogOpen(false);
      setSelectedProduct("");
      setQuantity("");
      setStockDate(format(new Date(), "yyyy-MM-dd"));
      setDescription("");
      setSelectedMasterAgent("");
      setSelectedBranch("");
      setRecipientType("none");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to process stock out");
    },
  });

  const updateStock = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("stock_out_hq")
        .update({
          product_id: selectedProduct,
          quantity: parseInt(quantity),
          date: stockDate,
          description: description || null,
        })
        .eq("id", editingItem?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-out-hq"] });
      toast.success("Stock out record updated successfully");
      setIsEditDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Failed to update stock: " + error.message);
    },
  });

  const deleteStock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("stock_out_hq")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-out-hq"] });
      toast.success("Stock out record deleted successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to delete stock: " + error.message);
    },
  });

  // Approve branch stock request
  const approveRequest = useMutation({
    mutationFn: async (request: any) => {
      // Check if sufficient inventory exists in HQ
      const { data: existing, error: fetchError } = await supabase
        .from("inventory")
        .select("*")
        .eq("user_id", user?.id)
        .eq("product_id", request.product_id)
        .single();

      if (fetchError || !existing) {
        throw new Error("No inventory found for this product in HQ");
      }

      if (existing.quantity < request.quantity) {
        throw new Error(`Insufficient HQ inventory. Available: ${existing.quantity}, Requested: ${request.quantity}`);
      }

      const today = format(new Date(), "yyyy-MM-dd");

      // Insert stock out record for HQ
      const { data: stockOutRecord, error: stockOutError } = await supabase
        .from("stock_out_hq")
        .insert({
          user_id: user?.id,
          product_id: request.product_id,
          quantity: request.quantity,
          date: today,
          description: `Approved request from Branch - ${request.description || "No notes"}`,
          recipient_id: request.branch_id,
          recipient_type: "branch",
        })
        .select("id")
        .single();

      if (stockOutError) throw stockOutError;

      // Update HQ inventory (decrease)
      const newQuantity = existing.quantity - request.quantity;
      const { error: updateError } = await supabase
        .from("inventory")
        .update({ quantity: newQuantity })
        .eq("id", existing.id);

      if (updateError) throw updateError;

      // Create stock_in_branch record for the branch
      const { error: stockInBranchError } = await supabase
        .from("stock_in_branch")
        .insert({
          branch_id: request.branch_id,
          product_id: request.product_id,
          quantity: request.quantity,
          description: request.description || `Stock approved from HQ - Request approved`,
          date: today,
          source_type: "hq",
          hq_stock_out_id: stockOutRecord?.id || null,
        });

      if (stockInBranchError) throw stockInBranchError;

      // Update request status to approved
      const { error: requestError } = await supabase
        .from("branch_stock_requests")
        .update({
          status: "approved",
          processed_at: new Date().toISOString(),
          processed_by: user?.id,
        })
        .eq("id", request.id);

      if (requestError) throw requestError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-stock-requests-pending"] });
      queryClient.invalidateQueries({ queryKey: ["stock-out-hq"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["stock-in-branch"] });
      toast.success("Stock request approved! Stock transferred to branch.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to approve request");
    },
  });

  // Reject branch stock request
  const rejectRequest = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const { error } = await supabase
        .from("branch_stock_requests")
        .update({
          status: "rejected",
          processed_at: new Date().toISOString(),
          processed_by: user?.id,
          rejection_reason: reason || "Request rejected by HQ",
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-stock-requests-pending"] });
      toast.success("Stock request rejected");
      setIsRejectDialogOpen(false);
      setRejectingRequest(null);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast.error("Failed to reject request: " + error.message);
    },
  });

  const handleApprove = (request: any) => {
    if (confirm(`Approve stock request for ${request.quantity} units of ${request.product?.name}?`)) {
      approveRequest.mutate(request);
    }
  };

  const handleReject = (request: any) => {
    setRejectingRequest(request);
    setIsRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (rejectingRequest) {
      rejectRequest.mutate({
        requestId: rejectingRequest.id,
        reason: rejectionReason,
      });
    }
  };

  const resetForm = () => {
    setSelectedProduct("");
    setQuantity("");
    setStockDate(format(new Date(), "yyyy-MM-dd"));
    setDescription("");
    setSelectedMasterAgent("");
    setSelectedBranch("");
    setRecipientType("none");
    setEditingItem(null);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setSelectedProduct(item.product_id);
    setQuantity(item.quantity.toString());
    setStockDate(item.date ? format(new Date(item.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
    setDescription(item.description || "");
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this stock out record?")) {
      deleteStock.mutate(id);
    }
  };

  const totalRecords = stockOuts?.length || 0;
  const totalQuantity = stockOuts?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const pendingRequestsCount = pendingRequests?.length || 0;

  const stats = [
    { title: "Pending Requests", value: pendingRequestsCount, icon: Clock, color: "text-yellow-600" },
    { title: "Total Records", value: totalRecords, icon: Calendar, color: "text-blue-600" },
    { title: "Total Units", value: totalQuantity, icon: Package, color: "text-red-600" },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Stock Out HQ
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage HQ inventory and stock removals
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <Minus className="mr-2 h-4 w-4" />
              Stock Out
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Stock Out from HQ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Transfer To (Optional)</Label>
                <Select
                  value={recipientType}
                  onValueChange={(value: "none" | "master_agent" | "branch") => {
                    setRecipientType(value);
                    setSelectedMasterAgent("");
                    setSelectedBranch("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipient type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Transfer (Regular Stock Out)</SelectItem>
                    <SelectItem value="master_agent">Master Agent</SelectItem>
                    <SelectItem value="branch">Branch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recipientType === "master_agent" && (
                <div className="space-y-2">
                  <Label>Master Agent</Label>
                  <Select value={selectedMasterAgent} onValueChange={setSelectedMasterAgent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Master Agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {masterAgents?.map((ma) => (
                        <SelectItem key={ma.id} value={ma.id}>
                          {ma.idstaff} - {ma.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {recipientType === "branch" && (
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches?.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.idstaff} - {branch.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={stockDate}
                  onChange={(e) => setStockDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add notes about this stock out..."
                />
              </div>
              <Button
                onClick={() => removeStock.mutate()}
                className="w-full"
                variant="destructive"
              >
                Stock Out
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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

      {/* Pending Branch Stock Requests */}
      {pendingRequestsCount > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Pending Branch Stock Requests ({pendingRequestsCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <p>Loading requests...</p>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests?.map((request: any) => {
                      const requestDate = request.requested_at ? new Date(request.requested_at) : null;
                      const isValidDate = requestDate && !isNaN(requestDate.getTime());

                      return (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div className="text-sm">
                              <div>{isValidDate ? format(requestDate, "dd-MM-yyyy") : "-"}</div>
                              <div className="text-muted-foreground text-xs">
                                {isValidDate ? format(requestDate, "HH:mm") : ""}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{request.branch?.idstaff}</div>
                              <div className="text-xs text-muted-foreground">{request.branch?.full_name}</div>
                            </div>
                          </TableCell>
                          <TableCell>{request.product?.name}</TableCell>
                          <TableCell>{request.product?.sku}</TableCell>
                          <TableCell className="font-bold">{request.quantity}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{request.description || "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                                onClick={() => handleApprove(request)}
                                disabled={approveRequest.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-red-50 hover:bg-red-100 text-red-700 border-red-300"
                                onClick={() => handleReject(request)}
                                disabled={rejectRequest.isPending}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filter by Date</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading stock records...</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockOuts?.map((item) => {
                  const itemDate = item.date ? new Date(item.date) : null;
                  const isValidDate = itemDate && !isNaN(itemDate.getTime());

                  return (
                    <TableRow key={item.id}>
                      <TableCell>{isValidDate ? format(itemDate, "dd-MM-yyyy") : "-"}</TableCell>
                      <TableCell>{item.product?.name}</TableCell>
                      <TableCell>{item.product?.sku}</TableCell>
                      <TableCell className="font-bold text-red-600">{item.quantity}</TableCell>
                      <TableCell>{item.description || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-sm md:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Stock Out Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={stockDate}
                onChange={(e) => setStockDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add notes about this stock out..."
              />
            </div>
            <Button
              onClick={() => updateStock.mutate()}
              className="w-full"
              disabled={!selectedProduct || !quantity || updateStock.isPending}
            >
              {updateStock.isPending ? "Updating..." : "Update Stock Out"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Request Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={(open) => {
        setIsRejectDialogOpen(open);
        if (!open) {
          setRejectingRequest(null);
          setRejectionReason("");
        }
      }}>
        <DialogContent className="max-w-sm md:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Stock Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {rejectingRequest && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm"><strong>Branch:</strong> {rejectingRequest.branch?.idstaff}</p>
                <p className="text-sm"><strong>Product:</strong> {rejectingRequest.product?.name}</p>
                <p className="text-sm"><strong>Quantity:</strong> {rejectingRequest.quantity}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsRejectDialogOpen(false);
                  setRejectingRequest(null);
                  setRejectionReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={confirmReject}
                disabled={rejectRequest.isPending}
              >
                {rejectRequest.isPending ? "Rejecting..." : "Reject Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockOutHQ;
