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
import { Package, TrendingUp, Minus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const MasterAgentInventory = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [quantity, setQuantity] = useState("");
  const [stockDate, setStockDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");

  // Date filters for Stock In/Out
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: products, isLoading } = useQuery({
    queryKey: ["master-agent-inventory", user?.id, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          inventory!inner(quantity)
        `)
        .eq("inventory.user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Calculate Stock In and Stock Out for each product
      const productsWithStock = await Promise.all(
        data.map(async (product) => {
          // Stock In from pending_orders (Master Agent purchases from HQ)
          let stockInQuery = supabase
            .from("pending_orders")
            .select("quantity")
            .eq("buyer_id", user?.id)
            .eq("product_id", product.id)
            .eq("status", "completed");

          if (startDate) {
            stockInQuery = stockInQuery.gte("created_at", startDate + 'T00:00:00.000Z');
          }
          if (endDate) {
            stockInQuery = stockInQuery.lte("created_at", endDate + 'T23:59:59.999Z');
          }

          const { data: stockInData } = await stockInQuery;
          const stockIn = stockInData?.reduce((sum, item) => sum + item.quantity, 0) || 0;

          // Stock Out from agent_purchases (Agent purchases from Master Agent)
          let stockOutQuery = supabase
            .from("agent_purchases")
            .select("quantity")
            .eq("master_agent_id", user?.id)
            .eq("product_id", product.id)
            .eq("status", "completed");

          if (startDate) {
            stockOutQuery = stockOutQuery.gte("created_at", startDate + 'T00:00:00.000Z');
          }
          if (endDate) {
            stockOutQuery = stockOutQuery.lte("created_at", endDate + 'T23:59:59.999Z');
          }

          const { data: stockOutData } = await stockOutQuery;
          const stockOut = stockOutData?.reduce((sum, item) => sum + item.quantity, 0) || 0;

          return {
            ...product,
            stockIn,
            stockOut,
          };
        })
      );

      return productsWithStock;
    },
    enabled: !!user?.id,
  });

  // Fetch all active products for the dropdown
  const { data: allProducts } = useQuery({
    queryKey: ["all-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch agents under this master agent
  const { data: agents } = useQuery({
    queryKey: ["ma-agents", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_agent_relationships")
        .select(`
          agent_id,
          agent:profiles!master_agent_relationships_agent_id_fkey(
            id,
            full_name,
            idstaff
          )
        `)
        .eq("master_agent_id", user?.id);
      if (error) throw error;
      return data?.map(rel => rel.agent) || [];
    },
    enabled: !!user?.id,
  });

  const stockOutToAgent = useMutation({
    mutationFn: async () => {
      if (!selectedAgent) {
        throw new Error("Please select an agent");
      }

      // Check if sufficient inventory exists for MA
      const { data: existing, error: fetchError } = await supabase
        .from("inventory")
        .select("*")
        .eq("user_id", user?.id)
        .eq("product_id", selectedProduct)
        .single();

      if (fetchError || !existing) {
        throw new Error("No inventory found for this product");
      }

      const quantityToTransfer = parseInt(quantity);
      if (existing.quantity < quantityToTransfer) {
        throw new Error(`Insufficient inventory. Available: ${existing.quantity}, Requested: ${quantityToTransfer}`);
      }

      // Get product details for pricing
      const { data: product } = await supabase
        .from("products")
        .select("price_ma_to_agent")
        .eq("id", selectedProduct)
        .single();

      const unitPrice = product?.price_ma_to_agent || 0;
      const totalPrice = unitPrice * quantityToTransfer;

      // Create agent_purchases record for MA to Agent transfer
      const { error: purchaseError } = await supabase
        .from("agent_purchases")
        .insert({
          agent_id: selectedAgent,
          master_agent_id: user?.id,
          product_id: selectedProduct,
          quantity: quantityToTransfer,
          unit_price: unitPrice,
          total_price: totalPrice,
          status: "completed",
          notes: description || "Manual stock transfer from Master Agent",
          bank_holder_name: "Master Agent",
          bank_name: null,
          receipt_date: null,
          receipt_image_url: null,
          remarks: `Date: ${stockDate}`,
        });

      if (purchaseError) throw purchaseError;

      // Update MA inventory (decrease)
      const newQuantity = existing.quantity - quantityToTransfer;
      const { error: updateError } = await supabase
        .from("inventory")
        .update({ quantity: newQuantity })
        .eq("id", existing.id);

      if (updateError) throw updateError;

      // Check if Agent already has inventory for this product
      const { data: agentInventory } = await supabase
        .from("inventory")
        .select("*")
        .eq("user_id", selectedAgent)
        .eq("product_id", selectedProduct)
        .single();

      if (agentInventory) {
        // Update existing Agent inventory (increase)
        const { error: agentUpdateError } = await supabase
          .from("inventory")
          .update({ quantity: agentInventory.quantity + quantityToTransfer })
          .eq("id", agentInventory.id);

        if (agentUpdateError) throw agentUpdateError;
      } else {
        // Create new inventory record for Agent
        const { error: agentInsertError } = await supabase
          .from("inventory")
          .insert({
            user_id: selectedAgent,
            product_id: selectedProduct,
            quantity: quantityToTransfer,
          });

        if (agentInsertError) throw agentInsertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-agent-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["agent-purchases"] });

      toast.success("Stock transferred to Agent successfully");

      setIsDialogOpen(false);
      setSelectedProduct("");
      setSelectedAgent("");
      setQuantity("");
      setStockDate(format(new Date(), "yyyy-MM-dd"));
      setDescription("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to process stock out");
    },
  });

  // Calculate summary stats
  const totalProducts = products?.length || 0;
  const totalQuantity = products?.reduce((sum, p) =>
    sum + (p.inventory?.reduce((invSum: number, inv: any) => invSum + inv.quantity, 0) || 0), 0
  ) || 0;
  const totalStockIn = products?.reduce((sum, p) => sum + ((p as any).stockIn || 0), 0) || 0;
  const totalStockOut = products?.reduce((sum, p) => sum + ((p as any).stockOut || 0), 0) || 0;

  const summaryStats = [
    { title: "Total Products", value: totalProducts, icon: Package, color: "text-blue-600" },
    { title: "Total Quantity", value: totalQuantity, icon: TrendingUp, color: "text-purple-600" },
    { title: "Stock In", value: totalStockIn, icon: TrendingUp, color: "text-green-600" },
    { title: "Stock Out", value: totalStockOut, icon: Minus, color: "text-red-600" },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Inventory Management
          </h1>
          <p className="text-muted-foreground mt-2">
            View your inventory quantities and stock levels
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <Minus className="mr-2 h-4 w-4" />
              Stock Out
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm md:max-w-md">
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
                    {allProducts?.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Agent ID Staff *</Label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Agent (Required)" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents?.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.idstaff}
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
                onClick={() => stockOutToAgent.mutate()}
                className="w-full"
                variant="destructive"
                disabled={!selectedAgent}
              >
                Stock Out
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {summaryStats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4 sm:p-6">
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

      {/* Date Filters */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Date Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory Management</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading inventory...</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Stock In</TableHead>
                  <TableHead>Stock Out</TableHead>
                  <TableHead>Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map((product) => {
                  const totalQuantity = product.inventory?.reduce((sum: number, inv: any) => sum + inv.quantity, 0) || 0;
                  const stockIn = (product as any).stockIn || 0;
                  const stockOut = (product as any).stockOut || 0;

                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.sku}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell className="font-medium text-green-600">{stockIn}</TableCell>
                      <TableCell className="font-medium text-red-600">{stockOut}</TableCell>
                      <TableCell className="font-medium">{totalQuantity}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MasterAgentInventory;
