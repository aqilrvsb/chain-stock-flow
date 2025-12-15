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
import { Package, Minus, Calendar, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getMalaysiaDate } from "@/lib/utils";

const StockOutBranch = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = getMalaysiaDate();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [stockDate, setStockDate] = useState(getMalaysiaDate());
  const [description, setDescription] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");

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

  // Get agents that belong to this branch
  const { data: myAgents } = useQuery({
    queryKey: ["branch-agents", user?.id],
    queryFn: async () => {
      // First get agent IDs from branch_agent_relationships
      const { data: relationships, error: relError } = await supabase
        .from("branch_agent_relationships")
        .select("agent_id")
        .eq("branch_id", user?.id);

      if (relError) throw relError;
      if (!relationships || relationships.length === 0) return [];

      const agentIds = relationships.map(r => r.agent_id);

      // Then get agent profiles
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, idstaff")
        .in("id", agentIds);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: stockOuts, isLoading } = useQuery({
    queryKey: ["stock-out-branch", user?.id, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("stock_out_branch")
        .select(`
          *,
          product:products(name, sku),
          recipient:profiles!stock_out_branch_recipient_id_fkey(idstaff, full_name)
        `)
        .eq("branch_id", user?.id)
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
    enabled: !!user?.id,
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

      // Insert stock out record
      const { error: stockOutError } = await supabase
        .from("stock_out_branch")
        .insert({
          branch_id: user?.id,
          product_id: selectedProduct,
          quantity: quantityToRemove,
          date: stockDate,
          description: description || null,
          recipient_id: selectedAgent || null,
        });

      if (stockOutError) throw stockOutError;

      // Branch inventory is automatically updated by the database trigger

      // If agent is selected, update agent's inventory
      if (selectedAgent && selectedAgent.trim() !== "") {
        // Check if agent already has inventory for this product
        const { data: agentInventory } = await supabase
          .from("inventory")
          .select("*")
          .eq("user_id", selectedAgent)
          .eq("product_id", selectedProduct)
          .single();

        if (agentInventory) {
          // Update existing agent inventory (increase)
          const { error: agentUpdateError } = await supabase
            .from("inventory")
            .update({ quantity: agentInventory.quantity + quantityToRemove })
            .eq("id", agentInventory.id);

          if (agentUpdateError) throw agentUpdateError;
        } else {
          // Create new inventory record for agent
          const { error: agentInsertError } = await supabase
            .from("inventory")
            .insert({
              user_id: selectedAgent,
              product_id: selectedProduct,
              quantity: quantityToRemove,
            });

          if (agentInsertError) throw agentInsertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-out-branch"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });

      const message = selectedAgent && selectedAgent.trim() !== ""
        ? "Stock transferred to Agent successfully"
        : "Stock out recorded successfully";
      toast.success(message);

      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to process stock out");
    },
  });

  const updateStock = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("stock_out_branch")
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
      queryClient.invalidateQueries({ queryKey: ["stock-out-branch"] });
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
        .from("stock_out_branch")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-out-branch"] });
      toast.success("Stock out record deleted successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to delete stock: " + error.message);
    },
  });

  const resetForm = () => {
    setSelectedProduct("");
    setQuantity("");
    setStockDate(getMalaysiaDate());
    setDescription("");
    setSelectedAgent("");
    setEditingItem(null);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setSelectedProduct(item.product_id);
    setQuantity(item.quantity.toString());
    setStockDate(item.date ? format(new Date(item.date), "yyyy-MM-dd") : getMalaysiaDate());
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

  const stats = [
    { title: "Total Records", value: totalRecords, icon: Calendar, color: "text-blue-600" },
    { title: "Total Units", value: totalQuantity, icon: Package, color: "text-red-600" },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Stock Out
          </h1>
          <p className="text-muted-foreground mt-2">
            Transfer stock to your agents (optional)
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
              <DialogTitle>Stock Out to Agent</DialogTitle>
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
                <Label>Agent (Optional)</Label>
                <div className="flex gap-2">
                  <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger>
                      <SelectValue placeholder="No Agent (Regular Stock Out)" />
                    </SelectTrigger>
                    <SelectContent>
                      {myAgents?.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.idstaff} - {agent.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAgent && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedAgent("")}
                    >
                      Clear
                    </Button>
                  )}
                </div>
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
                onClick={() => removeStock.mutate()}
                className="w-full"
                variant="destructive"
                disabled={!selectedProduct || !quantity || removeStock.isPending}
              >
                {removeStock.isPending ? "Processing..." : "Stock Out"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                    <TableHead>Agent</TableHead>
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
                        <TableCell>{item.recipient?.idstaff || "-"}</TableCell>
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
    </div>
  );
};

export default StockOutBranch;
