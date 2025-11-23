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
import { Package, Plus, Calendar, CheckCircle, XCircle, AlertTriangle, Loader } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const ProcessedStock = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [status, setStatus] = useState("");
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

  // Fetch raw material stock
  const { data: rawMaterials } = useQuery({
    queryKey: ["raw-material-stock", startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("raw_material_stock")
        .select("quantity")
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

  const { data: processedStock, isLoading } = useQuery({
    queryKey: ["processed-stock", startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("processed_stock")
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

  const addProcessedStock = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("processed_stock")
        .insert({
          user_id: user?.id,
          product_id: selectedProduct,
          quantity: parseInt(quantity),
          status: status,
          date: stockDate,
          description: description || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processed-stock"] });
      toast.success("Processed stock added successfully");
      setIsDialogOpen(false);
      setSelectedProduct("");
      setQuantity("");
      setStatus("");
      setStockDate(format(new Date(), "yyyy-MM-dd"));
      setDescription("");
    },
    onError: (error: any) => {
      toast.error("Failed to add processed stock: " + error.message);
    },
  });

  // Calculate totals
  const totalRawMaterial = rawMaterials?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const totalSuccess = processedStock?.filter(item => item.status === 'success')
    .reduce((sum, item) => sum + item.quantity, 0) || 0;

  const totalReject = processedStock?.filter(item => item.status === 'reject')
    .reduce((sum, item) => sum + item.quantity, 0) || 0;

  const totalDamage = processedStock?.filter(item => item.status === 'damage')
    .reduce((sum, item) => sum + item.quantity, 0) || 0;

  const totalLost = processedStock?.filter(item => item.status === 'lost')
    .reduce((sum, item) => sum + item.quantity, 0) || 0;

  const totalPending = totalRawMaterial - totalSuccess - totalReject - totalDamage - totalLost;

  const stats = [
    {
      title: "Total Raw Material",
      value: totalRawMaterial,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Success Packaging",
      value: totalSuccess,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Total Reject Packaging",
      value: totalReject,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Total Damage Packaging",
      value: totalDamage,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Total Lost Packaging",
      value: totalLost,
      icon: XCircle,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Total Pending",
      value: totalPending,
      icon: Loader,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      success: "bg-green-100 text-green-800",
      reject: "bg-red-100 text-red-800",
      damage: "bg-orange-100 text-orange-800",
      lost: "bg-purple-100 text-purple-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusConfig[status as keyof typeof statusConfig]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Processed Stock
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage processed product inventory with packaging status
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Processed Stock
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm md:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Processed Stock</DialogTitle>
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
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="reject">Reject</SelectItem>
                    <SelectItem value="damage">Damage</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
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
                  placeholder="Add notes about this processed stock..."
                />
              </div>
              <Button
                onClick={() => addProcessedStock.mutate()}
                className="w-full"
                disabled={!selectedProduct || !quantity || !status || addProcessedStock.isPending}
              >
                {addProcessedStock.isPending ? "Adding..." : "Add Processed Stock"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter by Date</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4">
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
            <p>Loading processed stock records...</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedStock?.map((item) => {
                    const itemDate = item.date ? new Date(item.date) : null;
                    const isValidDate = itemDate && !isNaN(itemDate.getTime());

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          {isValidDate ? format(itemDate, "dd-MM-yyyy") : "-"}
                        </TableCell>
                        <TableCell>{item.product?.name}</TableCell>
                        <TableCell>{item.product?.sku}</TableCell>
                        <TableCell className="font-bold">{item.quantity}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell>{item.description || "-"}</TableCell>
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

export default ProcessedStock;
