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
import { Package, Minus, Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const StockOutHQ = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [stockDate, setStockDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [selectedMasterAgent, setSelectedMasterAgent] = useState("");

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

      // Insert stock out record
      const { error: stockOutError } = await supabase
        .from("stock_out_hq")
        .insert({
          user_id: user?.id,
          product_id: selectedProduct,
          quantity: quantityToRemove,
          date: stockDate,
          description: description || null,
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
      if (selectedMasterAgent && selectedMasterAgent.trim() !== "") {
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-out-hq"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["pending-orders"] });

      const message = selectedMasterAgent && selectedMasterAgent.trim() !== ""
        ? "Stock transferred to Master Agent successfully"
        : "Stock out recorded successfully";
      toast.success(message);

      setIsDialogOpen(false);
      setSelectedProduct("");
      setQuantity("");
      setStockDate(format(new Date(), "yyyy-MM-dd"));
      setDescription("");
      setSelectedMasterAgent("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to process stock out");
    },
  });

  const totalRecords = stockOuts?.length || 0;
  const totalQuantity = stockOuts?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const stats = [
    { title: "Total Records", value: totalRecords, icon: Calendar, color: "text-blue-600" },
    { title: "Total Units", value: totalQuantity, icon: Package, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
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
                <Label>Master Agent ID Staff (Optional)</Label>
                <div className="flex gap-2">
                  <Select value={selectedMasterAgent} onValueChange={setSelectedMasterAgent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Not Selected (Regular Stock Out)" />
                    </SelectTrigger>
                    <SelectContent>
                      {masterAgents?.map((ma) => (
                        <SelectItem key={ma.id} value={ma.id}>
                          {ma.idstaff}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedMasterAgent && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedMasterAgent("")}
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
              >
                Stock Out
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
          <div className="grid gap-4 md:grid-cols-2 mt-4">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockOuts?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{format(new Date(item.date), "dd-MM-yyyy")}</TableCell>
                    <TableCell>{item.product?.name}</TableCell>
                    <TableCell>{item.product?.sku}</TableCell>
                    <TableCell className="font-bold text-red-600">{item.quantity}</TableCell>
                    <TableCell>{item.description || "-"}</TableCell>
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

export default StockOutHQ;
