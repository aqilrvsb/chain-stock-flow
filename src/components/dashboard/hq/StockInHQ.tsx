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
import { Package, Plus, Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const StockInHQ = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [stockDate, setStockDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");

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

  const { data: stockIns, isLoading } = useQuery({
    queryKey: ["stock-in-hq", startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("stock_in_hq")
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

  const addStock = useMutation({
    mutationFn: async () => {
      // Insert stock in record
      const { error: stockInError } = await supabase
        .from("stock_in_hq")
        .insert({
          user_id: user?.id,
          product_id: selectedProduct,
          quantity: parseInt(quantity),
          date: stockDate,
          description: description || null,
        });

      if (stockInError) throw stockInError;

      // Update inventory
      const { data: existing } = await supabase
        .from("inventory")
        .select("*")
        .eq("user_id", user?.id)
        .eq("product_id", selectedProduct)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("inventory")
          .update({ quantity: existing.quantity + parseInt(quantity) })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("inventory")
          .insert({
            user_id: user?.id,
            product_id: selectedProduct,
            quantity: parseInt(quantity),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-in-hq"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Stock added successfully");
      setIsDialogOpen(false);
      setSelectedProduct("");
      setQuantity("");
      setStockDate(format(new Date(), "yyyy-MM-dd"));
      setDescription("");
    },
  });

  const totalRecords = stockIns?.length || 0;
  const totalQuantity = stockIns?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const stats = [
    { title: "Total Records", value: totalRecords, icon: Calendar, color: "text-blue-600" },
    { title: "Total Units", value: totalQuantity, icon: Package, color: "text-green-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Stock In HQ
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage HQ inventory and stock additions
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Stock
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Stock to HQ</DialogTitle>
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
                  placeholder="Add notes about this stock addition..."
                />
              </div>
              <Button onClick={() => addStock.mutate()} className="w-full">
                Add Stock
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
                {stockIns?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{format(new Date(item.date), "dd-MM-yyyy")}</TableCell>
                    <TableCell>{item.product?.name}</TableCell>
                    <TableCell>{item.product?.sku}</TableCell>
                    <TableCell className="font-bold">{item.quantity}</TableCell>
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

export default StockInHQ;
