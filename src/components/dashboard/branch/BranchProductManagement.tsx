import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Package, TrendingUp, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface FilteredStock {
  productId: string;
  stockIn: number;
  stockOut: number;
}

interface OrderStock {
  productId: string;
  returnIn: number;
  processedOut: number;
}

const BranchProductManagement = () => {
  const { user } = useAuth();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filteredStocks, setFilteredStocks] = useState<FilteredStock[]>([]);
  const [orderStocks, setOrderStocks] = useState<OrderStock[]>([]);
  const [allTimeOrderStocks, setAllTimeOrderStocks] = useState<OrderStock[]>([]);
  const [isFilterLoading, setIsFilterLoading] = useState(false);

  // Fetch products that have stock_in_branch records for this branch
  const { data: products, isLoading } = useQuery({
    queryKey: ["branch-products-with-stock", user?.id],
    queryFn: async () => {
      // First get distinct product_ids from stock_in_branch for this branch
      const { data: stockInData, error: stockInError } = await supabase
        .from("stock_in_branch")
        .select("product_id")
        .eq("branch_id", user?.id);

      if (stockInError) throw stockInError;

      // Get unique product IDs
      const productIds = [...new Set(stockInData?.map(s => s.product_id) || [])];

      if (productIds.length === 0) {
        return [];
      }

      // Fetch products with those IDs
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .in("id", productIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch bundles to map product names to product IDs
  const { data: bundles } = useQuery({
    queryKey: ["bundles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bundles")
        .select("id, name, product_id");
      if (error) throw error;
      return data || [];
    },
  });

  // Helper: Get product_id from bundle/product name
  const getProductIdFromName = (productName: string): string | null => {
    // First check bundles
    const bundle = bundles?.find(b => b.name === productName);
    if (bundle?.product_id) return bundle.product_id;

    // Then check products directly
    const product = products?.find(p => p.name === productName || p.sku === productName);
    return product?.id || null;
  };

  // Fetch all-time order stocks (for Quantity calculation - no date filter)
  useEffect(() => {
    const fetchAllTimeOrderStocks = async () => {
      if (!user?.id) return;

      try {
        // Fetch Return orders (delivery_status = 'Return') for this branch
        const { data: returnData, error: returnError } = await supabase
          .from("customer_purchases")
          .select("produk, sku, quantity, product_id")
          .eq("seller_id", user.id)
          .eq("delivery_status", "Return");

        if (returnError) throw returnError;

        // Fetch Shipped orders (delivery_status = 'Shipped') for this branch
        const { data: shippedData, error: shippedError } = await supabase
          .from("customer_purchases")
          .select("produk, sku, quantity, product_id")
          .eq("seller_id", user.id)
          .eq("delivery_status", "Shipped");

        if (shippedError) throw shippedError;

        // Aggregate by product_id
        const orderMap = new Map<string, { returnIn: number; processedOut: number }>();

        (returnData || []).forEach((order: any) => {
          // Try product_id first, then lookup by name/sku
          let productId = order.product_id;
          if (!productId) {
            productId = getProductIdFromName(order.produk) || getProductIdFromName(order.sku);
          }
          if (productId) {
            const existing = orderMap.get(productId) || { returnIn: 0, processedOut: 0 };
            existing.returnIn += order.quantity || 1;
            orderMap.set(productId, existing);
          }
        });

        (shippedData || []).forEach((order: any) => {
          let productId = order.product_id;
          if (!productId) {
            productId = getProductIdFromName(order.produk) || getProductIdFromName(order.sku);
          }
          if (productId) {
            const existing = orderMap.get(productId) || { returnIn: 0, processedOut: 0 };
            existing.processedOut += order.quantity || 1;
            orderMap.set(productId, existing);
          }
        });

        const result: OrderStock[] = Array.from(orderMap.entries()).map(([productId, stocks]) => ({
          productId,
          returnIn: stocks.returnIn,
          processedOut: stocks.processedOut,
        }));

        setAllTimeOrderStocks(result);
      } catch (error) {
        console.error("Error fetching all-time order stocks:", error);
      }
    };

    if (bundles && products && user?.id) {
      fetchAllTimeOrderStocks();
    }
  }, [bundles, products, user?.id]);

  // Fetch filtered stock movements when date filters change
  useEffect(() => {
    const fetchFilteredData = async () => {
      if (!user?.id) return;

      setIsFilterLoading(true);
      try {
        // Fetch stock_in_branch (Stock In)
        let stockInQuery = supabase
          .from("stock_in_branch")
          .select("product_id, quantity, date")
          .eq("branch_id", user.id);

        if (startDate) {
          stockInQuery = stockInQuery.gte("date", startDate + "T00:00:00.000Z");
        }
        if (endDate) {
          stockInQuery = stockInQuery.lte("date", endDate + "T23:59:59.999Z");
        }

        const { data: stockInData, error: stockInError } = await stockInQuery;
        if (stockInError) throw stockInError;

        // Fetch stock_out_branch (Stock Out)
        let stockOutQuery = supabase
          .from("stock_out_branch")
          .select("product_id, quantity, date")
          .eq("branch_id", user.id);

        if (startDate) {
          stockOutQuery = stockOutQuery.gte("date", startDate + "T00:00:00.000Z");
        }
        if (endDate) {
          stockOutQuery = stockOutQuery.lte("date", endDate + "T23:59:59.999Z");
        }

        const { data: stockOutData, error: stockOutError } = await stockOutQuery;
        if (stockOutError) throw stockOutError;

        // Aggregate stock movements by product
        const stockMap = new Map<string, { stockIn: number; stockOut: number }>();

        (stockInData || []).forEach((movement: any) => {
          const existing = stockMap.get(movement.product_id) || { stockIn: 0, stockOut: 0 };
          existing.stockIn += movement.quantity;
          stockMap.set(movement.product_id, existing);
        });

        (stockOutData || []).forEach((movement: any) => {
          const existing = stockMap.get(movement.product_id) || { stockIn: 0, stockOut: 0 };
          existing.stockOut += movement.quantity;
          stockMap.set(movement.product_id, existing);
        });

        const filteredStockResult: FilteredStock[] = Array.from(stockMap.entries()).map(([productId, stocks]) => ({
          productId,
          stockIn: stocks.stockIn,
          stockOut: stocks.stockOut,
        }));
        setFilteredStocks(filteredStockResult);

        // Fetch Return In orders (filter by date_return)
        let returnQuery = supabase
          .from("customer_purchases")
          .select("produk, sku, quantity, product_id, date_return")
          .eq("seller_id", user.id)
          .eq("delivery_status", "Return");

        if (startDate) {
          returnQuery = returnQuery.gte("date_return", startDate);
        }
        if (endDate) {
          returnQuery = returnQuery.lte("date_return", endDate);
        }

        const { data: returnData, error: returnError } = await returnQuery;
        if (returnError) throw returnError;

        // Fetch Processed Out orders (filter by date_processed)
        let processedQuery = supabase
          .from("customer_purchases")
          .select("produk, sku, quantity, product_id, date_processed")
          .eq("seller_id", user.id)
          .eq("delivery_status", "Shipped");

        if (startDate) {
          processedQuery = processedQuery.gte("date_processed", startDate);
        }
        if (endDate) {
          processedQuery = processedQuery.lte("date_processed", endDate);
        }

        const { data: processedData, error: processedError } = await processedQuery;
        if (processedError) throw processedError;

        // Aggregate order stocks by product_id
        const orderMap = new Map<string, { returnIn: number; processedOut: number }>();

        (returnData || []).forEach((order: any) => {
          let productId = order.product_id;
          if (!productId) {
            productId = getProductIdFromName(order.produk) || getProductIdFromName(order.sku);
          }
          if (productId) {
            const existing = orderMap.get(productId) || { returnIn: 0, processedOut: 0 };
            existing.returnIn += order.quantity || 1;
            orderMap.set(productId, existing);
          }
        });

        (processedData || []).forEach((order: any) => {
          let productId = order.product_id;
          if (!productId) {
            productId = getProductIdFromName(order.produk) || getProductIdFromName(order.sku);
          }
          if (productId) {
            const existing = orderMap.get(productId) || { returnIn: 0, processedOut: 0 };
            existing.processedOut += order.quantity || 1;
            orderMap.set(productId, existing);
          }
        });

        const orderStockResult: OrderStock[] = Array.from(orderMap.entries()).map(([productId, stocks]) => ({
          productId,
          returnIn: stocks.returnIn,
          processedOut: stocks.processedOut,
        }));
        setOrderStocks(orderStockResult);

      } catch (error) {
        console.error("Error fetching filtered data:", error);
      } finally {
        setIsFilterLoading(false);
      }
    };

    fetchFilteredData();
  }, [startDate, endDate, bundles, products, user?.id]);

  const hasDateFilter = startDate || endDate;

  // Get stock values - filtered if date filter applied
  const getStockIn = (productId: string) => {
    const filtered = filteredStocks.find(f => f.productId === productId);
    return filtered?.stockIn || 0;
  };

  const getStockOut = (productId: string) => {
    const filtered = filteredStocks.find(f => f.productId === productId);
    return filtered?.stockOut || 0;
  };

  // Get Return In for a product
  const getReturnIn = (productId: string) => {
    if (!hasDateFilter) {
      const allTime = allTimeOrderStocks.find(f => f.productId === productId);
      return allTime?.returnIn || 0;
    }
    const filtered = orderStocks.find(f => f.productId === productId);
    return filtered?.returnIn || 0;
  };

  // Get Processed Out for a product
  const getProcessedOut = (productId: string) => {
    if (!hasDateFilter) {
      const allTime = allTimeOrderStocks.find(f => f.productId === productId);
      return allTime?.processedOut || 0;
    }
    const filtered = orderStocks.find(f => f.productId === productId);
    return filtered?.processedOut || 0;
  };

  // Calculate Quantity: Stock In + Return In - Stock Out - Processed Out (ALL TIME)
  const getQuantity = (productId: string) => {
    // Get all-time stock in/out
    const allTimeStockFiltered = filteredStocks.find(f => f.productId === productId);
    const stockIn = allTimeStockFiltered?.stockIn || 0;
    const stockOut = allTimeStockFiltered?.stockOut || 0;

    // Get all-time return/processed
    const allTimeReturn = allTimeOrderStocks.find(f => f.productId === productId);
    const returnIn = allTimeReturn?.returnIn || 0;
    const processedOut = allTimeReturn?.processedOut || 0;

    return stockIn + returnIn - stockOut - processedOut;
  };

  // Get all-time stock for quantity calculation (no date filter)
  const getAllTimeStockIn = (productId: string) => {
    const filtered = filteredStocks.find(f => f.productId === productId);
    return filtered?.stockIn || 0;
  };

  const getAllTimeStockOut = (productId: string) => {
    const filtered = filteredStocks.find(f => f.productId === productId);
    return filtered?.stockOut || 0;
  };

  // Stats calculation
  const stats = {
    totalProducts: products?.length || 0,
    activeProducts: products?.filter((p) => p.is_active).length || 0,
    inactiveProducts: products?.filter((p) => !p.is_active).length || 0,
    stockIn: filteredStocks.reduce((sum, f) => sum + f.stockIn, 0),
    stockOut: filteredStocks.reduce((sum, f) => sum + f.stockOut, 0),
    returnIn: hasDateFilter
      ? orderStocks.reduce((sum, f) => sum + f.returnIn, 0)
      : allTimeOrderStocks.reduce((sum, f) => sum + f.returnIn, 0),
    processedOut: hasDateFilter
      ? orderStocks.reduce((sum, f) => sum + f.processedOut, 0)
      : allTimeOrderStocks.reduce((sum, f) => sum + f.processedOut, 0),
    totalQuantity: (products || []).reduce((sum, p) => {
      const stockIn = getAllTimeStockIn(p.id);
      const stockOut = getAllTimeStockOut(p.id);
      const allTimeReturn = allTimeOrderStocks.find(f => f.productId === p.id);
      const returnIn = allTimeReturn?.returnIn || 0;
      const processedOut = allTimeReturn?.processedOut || 0;
      return sum + (stockIn + returnIn - stockOut - processedOut);
    }, 0),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          Inventory Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your inventory quantities and stock levels
        </p>
      </div>

      {/* Stats Cards - 8 cards in grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Products</p>
                <p className="text-xl font-bold">{stats.totalProducts}</p>
              </div>
              <Package className="w-6 h-6 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Quantity</p>
                <p className="text-xl font-bold">{stats.totalQuantity.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Products</p>
                <p className="text-xl font-bold">{stats.activeProducts}</p>
              </div>
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Inactive Products</p>
                <p className="text-xl font-bold">{stats.inactiveProducts}</p>
              </div>
              <XCircle className="w-6 h-6 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Stock In</p>
                <p className="text-xl font-bold">{stats.stockIn.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Return In</p>
                <p className="text-xl font-bold">{stats.returnIn.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Stock Out</p>
                <p className="text-xl font-bold">{stats.stockOut.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-red-500 rotate-180" />
            </div>
          </CardContent>
        </Card>

        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Processed Out</p>
                <p className="text-xl font-bold">{stats.processedOut.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-orange-500 rotate-180" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Filters */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-4">Date Filters (Stock In/Out only)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          {hasDateFilter && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
            >
              Clear Filter
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Inventory Management</h3>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Base Cost</TableHead>
                  <TableHead>Stock In</TableHead>
                  <TableHead>Return In</TableHead>
                  <TableHead>Stock Out</TableHead>
                  <TableHead>Processed Out</TableHead>
                  <TableHead>Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products && products.length > 0 ? (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.sku}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>RM {(product.base_cost || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-green-600">
                        {isFilterLoading ? "..." : getStockIn(product.id).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-blue-600">
                        {isFilterLoading ? "..." : getReturnIn(product.id).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-red-600">
                        {isFilterLoading ? "..." : getStockOut(product.id).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-orange-600">
                        {isFilterLoading ? "..." : getProcessedOut(product.id).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-bold">
                        {getQuantity(product.id).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No products with stock received yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BranchProductManagement;
