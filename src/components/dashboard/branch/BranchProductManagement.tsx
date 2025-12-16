import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Package, TrendingUp, TrendingDown, Loader2 } from "lucide-react";

interface FilteredStock {
  productId: string;
  stockIn: number;
  stockOutAgent: number;
  stockOutBranch: number; // stock_out_branch without agent
}

interface OrderStock {
  productId: string;
  returnIn: number;
  stockOutMarketer: number; // delivery_status = 'Shipped' to marketers
  agentPurchases: number; // purchases by agents (buyer_id is an agent)
  branchCustomerShipped: number; // Branch customer orders with delivery_status = 'Shipped' (non-agent, no marketer)
}

const BranchProductManagement = () => {
  const { user } = useAuth();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filteredStocks, setFilteredStocks] = useState<FilteredStock[]>([]);
  const [orderStocks, setOrderStocks] = useState<OrderStock[]>([]);
  const [allTimeOrderStocks, setAllTimeOrderStocks] = useState<OrderStock[]>([]);
  const [allTimeStocks, setAllTimeStocks] = useState<FilteredStock[]>([]);
  const [isFilterLoading, setIsFilterLoading] = useState(false);

  // Fetch products that have stock_in_branch records for this branch, with inventory quantity
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

      // Fetch inventory quantities for this branch
      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory")
        .select("product_id, quantity")
        .eq("user_id", user?.id)
        .in("product_id", productIds);

      if (inventoryError) {
        console.error("Error fetching inventory:", inventoryError);
      }

      // Map inventory quantities to products
      const inventoryMap = new Map(
        (inventoryData || []).map(inv => [inv.product_id, inv.quantity])
      );

      return (data || []).map(product => ({
        ...product,
        currentQuantity: inventoryMap.get(product.id) || 0,
      }));
    },
    enabled: !!user?.id,
  });

  // Fetch all agents (profiles with role = 'agent') to identify Stock Out Agent
  const { data: agents } = useQuery({
    queryKey: ["agents-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "agent");
      if (error) throw error;
      return data?.map(a => a.user_id) || [];
    },
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

  // Fetch all-time stocks (for Quantity calculation - no date filter)
  useEffect(() => {
    const fetchAllTimeData = async () => {
      if (!user?.id) return;

      try {
        // Fetch all stock_in_branch
        const { data: stockInData } = await supabase
          .from("stock_in_branch")
          .select("product_id, quantity")
          .eq("branch_id", user.id);

        // Fetch all stock_out_branch with recipient_id
        const { data: stockOutData } = await supabase
          .from("stock_out_branch")
          .select("product_id, quantity, recipient_id")
          .eq("branch_id", user.id);

        // Aggregate stock movements by product
        const stockMap = new Map<string, { stockIn: number; stockOutAgent: number; stockOutBranch: number }>();

        (stockInData || []).forEach((movement: any) => {
          const existing = stockMap.get(movement.product_id) || { stockIn: 0, stockOutAgent: 0, stockOutBranch: 0 };
          existing.stockIn += movement.quantity;
          stockMap.set(movement.product_id, existing);
        });

        (stockOutData || []).forEach((movement: any) => {
          const existing = stockMap.get(movement.product_id) || { stockIn: 0, stockOutAgent: 0, stockOutBranch: 0 };
          // Check if recipient is an agent
          const isAgent = movement.recipient_id && agents?.includes(movement.recipient_id);
          if (isAgent) {
            existing.stockOutAgent += movement.quantity;
          } else {
            // Stock Out Branch = stock_out_branch without agent recipient
            existing.stockOutBranch += movement.quantity;
          }
          stockMap.set(movement.product_id, existing);
        });

        const allTimeStockResult: FilteredStock[] = Array.from(stockMap.entries()).map(([productId, stocks]) => ({
          productId,
          stockIn: stocks.stockIn,
          stockOutAgent: stocks.stockOutAgent,
          stockOutBranch: stocks.stockOutBranch,
        }));
        setAllTimeStocks(allTimeStockResult);

        // Fetch Return orders (delivery_status = 'Return') for this branch
        const { data: returnData } = await supabase
          .from("customer_purchases")
          .select("produk, sku, quantity, product_id")
          .eq("seller_id", user.id)
          .eq("delivery_status", "Return");

        // Fetch ALL Shipped orders (delivery_status = 'Shipped') for this branch with marketer_id
        const { data: shippedData } = await supabase
          .from("customer_purchases")
          .select("produk, sku, quantity, product_id, marketer_id")
          .eq("seller_id", user.id)
          .eq("delivery_status", "Shipped");

        // Fetch Agent Purchases from agent_purchases table (where branch_id = this branch)
        const { data: agentPurchaseData } = await supabase
          .from("agent_purchases")
          .select("product_id, quantity")
          .eq("branch_id", user.id)
          .eq("status", "completed");

        // Aggregate by product_id
        const orderMap = new Map<string, { returnIn: number; stockOutMarketer: number; agentPurchases: number; branchCustomerShipped: number }>();

        (returnData || []).forEach((order: any) => {
          let productId = order.product_id;
          if (!productId) {
            productId = getProductIdFromName(order.produk) || getProductIdFromName(order.sku);
          }
          if (productId) {
            const existing = orderMap.get(productId) || { returnIn: 0, stockOutMarketer: 0, agentPurchases: 0, branchCustomerShipped: 0 };
            existing.returnIn += order.quantity || 1;
            orderMap.set(productId, existing);
          }
        });

        // Process shipped orders - categorize into Stock Out Marketer vs Branch Customer Shipped
        (shippedData || []).forEach((order: any) => {
          let productId = order.product_id;
          if (!productId) {
            productId = getProductIdFromName(order.produk) || getProductIdFromName(order.sku);
          }
          if (productId) {
            const existing = orderMap.get(productId) || { returnIn: 0, stockOutMarketer: 0, agentPurchases: 0, branchCustomerShipped: 0 };

            if (order.marketer_id) {
              // Has marketer_id = Stock Out Marketer
              existing.stockOutMarketer += order.quantity || 1;
            } else {
              // No marketer_id = Branch direct customer order (Stock Out Branch)
              existing.branchCustomerShipped += order.quantity || 1;
            }
            orderMap.set(productId, existing);
          }
        });

        // Count agent purchases from agent_purchases table
        (agentPurchaseData || []).forEach((purchase: any) => {
          const productId = purchase.product_id;
          if (productId) {
            const existing = orderMap.get(productId) || { returnIn: 0, stockOutMarketer: 0, agentPurchases: 0, branchCustomerShipped: 0 };
            existing.agentPurchases += purchase.quantity || 1;
            orderMap.set(productId, existing);
          }
        });

        const result: OrderStock[] = Array.from(orderMap.entries()).map(([productId, stocks]) => ({
          productId,
          returnIn: stocks.returnIn,
          stockOutMarketer: stocks.stockOutMarketer,
          agentPurchases: stocks.agentPurchases,
          branchCustomerShipped: stocks.branchCustomerShipped,
        }));

        setAllTimeOrderStocks(result);
      } catch (error) {
        console.error("Error fetching all-time data:", error);
      }
    };

    if (bundles && products && user?.id && agents) {
      fetchAllTimeData();
    }
  }, [bundles, products, user?.id, agents]);

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
          stockInQuery = stockInQuery.gte("date", startDate + "T00:00:00+08:00");
        }
        if (endDate) {
          stockInQuery = stockInQuery.lte("date", endDate + "T23:59:59.999+08:00");
        }

        const { data: stockInData, error: stockInError } = await stockInQuery;
        if (stockInError) throw stockInError;

        // Fetch stock_out_branch with recipient_id
        let stockOutQuery = supabase
          .from("stock_out_branch")
          .select("product_id, quantity, date, recipient_id")
          .eq("branch_id", user.id);

        if (startDate) {
          stockOutQuery = stockOutQuery.gte("date", startDate + "T00:00:00+08:00");
        }
        if (endDate) {
          stockOutQuery = stockOutQuery.lte("date", endDate + "T23:59:59.999+08:00");
        }

        const { data: stockOutData, error: stockOutError } = await stockOutQuery;
        if (stockOutError) throw stockOutError;

        // Aggregate stock movements by product
        const stockMap = new Map<string, { stockIn: number; stockOutAgent: number; stockOutBranch: number }>();

        (stockInData || []).forEach((movement: any) => {
          const existing = stockMap.get(movement.product_id) || { stockIn: 0, stockOutAgent: 0, stockOutBranch: 0 };
          existing.stockIn += movement.quantity;
          stockMap.set(movement.product_id, existing);
        });

        (stockOutData || []).forEach((movement: any) => {
          const existing = stockMap.get(movement.product_id) || { stockIn: 0, stockOutAgent: 0, stockOutBranch: 0 };
          // Check if recipient is an agent
          const isAgent = movement.recipient_id && agents?.includes(movement.recipient_id);
          if (isAgent) {
            existing.stockOutAgent += movement.quantity;
          } else {
            // Stock Out Branch = stock_out_branch without agent recipient
            existing.stockOutBranch += movement.quantity;
          }
          stockMap.set(movement.product_id, existing);
        });

        const filteredStockResult: FilteredStock[] = Array.from(stockMap.entries()).map(([productId, stocks]) => ({
          productId,
          stockIn: stocks.stockIn,
          stockOutAgent: stocks.stockOutAgent,
          stockOutBranch: stocks.stockOutBranch,
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

        // Fetch ALL Shipped orders (filter by date_processed) with marketer_id
        let processedQuery = supabase
          .from("customer_purchases")
          .select("produk, sku, quantity, product_id, date_processed, marketer_id")
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

        // Fetch Agent Purchases from agent_purchases table (filter by created_at)
        let agentPurchaseQuery = supabase
          .from("agent_purchases")
          .select("product_id, quantity, created_at")
          .eq("branch_id", user.id)
          .eq("status", "completed");

        if (startDate) {
          agentPurchaseQuery = agentPurchaseQuery.gte("created_at", startDate + "T00:00:00+08:00");
        }
        if (endDate) {
          agentPurchaseQuery = agentPurchaseQuery.lte("created_at", endDate + "T23:59:59.999+08:00");
        }

        const { data: agentPurchaseData, error: agentPurchaseError } = await agentPurchaseQuery;
        if (agentPurchaseError) throw agentPurchaseError;

        // Aggregate order stocks by product_id
        const orderMap = new Map<string, { returnIn: number; stockOutMarketer: number; agentPurchases: number; branchCustomerShipped: number }>();

        (returnData || []).forEach((order: any) => {
          let productId = order.product_id;
          if (!productId) {
            productId = getProductIdFromName(order.produk) || getProductIdFromName(order.sku);
          }
          if (productId) {
            const existing = orderMap.get(productId) || { returnIn: 0, stockOutMarketer: 0, agentPurchases: 0, branchCustomerShipped: 0 };
            existing.returnIn += order.quantity || 1;
            orderMap.set(productId, existing);
          }
        });

        // Process shipped orders - categorize into Stock Out Marketer vs Branch Customer Shipped
        (processedData || []).forEach((order: any) => {
          let productId = order.product_id;
          if (!productId) {
            productId = getProductIdFromName(order.produk) || getProductIdFromName(order.sku);
          }
          if (productId) {
            const existing = orderMap.get(productId) || { returnIn: 0, stockOutMarketer: 0, agentPurchases: 0, branchCustomerShipped: 0 };

            if (order.marketer_id) {
              // Has marketer_id = Stock Out Marketer
              existing.stockOutMarketer += order.quantity || 1;
            } else {
              // No marketer_id = Branch direct customer order (Stock Out Branch)
              existing.branchCustomerShipped += order.quantity || 1;
            }
            orderMap.set(productId, existing);
          }
        });

        // Count agent purchases from agent_purchases table
        (agentPurchaseData || []).forEach((purchase: any) => {
          const productId = purchase.product_id;
          if (productId) {
            const existing = orderMap.get(productId) || { returnIn: 0, stockOutMarketer: 0, agentPurchases: 0, branchCustomerShipped: 0 };
            existing.agentPurchases += purchase.quantity || 1;
            orderMap.set(productId, existing);
          }
        });

        const orderStockResult: OrderStock[] = Array.from(orderMap.entries()).map(([productId, stocks]) => ({
          productId,
          returnIn: stocks.returnIn,
          stockOutMarketer: stocks.stockOutMarketer,
          agentPurchases: stocks.agentPurchases,
          branchCustomerShipped: stocks.branchCustomerShipped,
        }));
        setOrderStocks(orderStockResult);

      } catch (error) {
        console.error("Error fetching filtered data:", error);
      } finally {
        setIsFilterLoading(false);
      }
    };

    fetchFilteredData();
  }, [startDate, endDate, bundles, products, user?.id, agents]);

  const hasDateFilter = startDate || endDate;

  // Get stock values - filtered if date filter applied, otherwise all-time
  const getStockIn = (productId: string) => {
    const source = hasDateFilter ? filteredStocks : allTimeStocks;
    const filtered = source.find(f => f.productId === productId);
    return filtered?.stockIn || 0;
  };

  const getStockOutAgent = (productId: string) => {
    const source = hasDateFilter ? filteredStocks : allTimeStocks;
    const filtered = source.find(f => f.productId === productId);
    return filtered?.stockOutAgent || 0;
  };

  // Get Stock Out Branch (stock_out_branch without agent + HQ customer shipped)
  const getStockOutBranchOnly = (productId: string) => {
    const source = hasDateFilter ? filteredStocks : allTimeStocks;
    const filtered = source.find(f => f.productId === productId);
    return filtered?.stockOutBranch || 0;
  };

  // Get Branch Customer Shipped (Branch direct orders with delivery_status = 'Shipped')
  const getBranchCustomerShipped = (productId: string) => {
    const source = hasDateFilter ? orderStocks : allTimeOrderStocks;
    const filtered = source.find(f => f.productId === productId);
    return filtered?.branchCustomerShipped || 0;
  };

  // Get Total Stock Out Branch (stock_out_branch without agent + Branch customer shipped)
  const getTotalStockOutBranch = (productId: string) => {
    return getStockOutBranchOnly(productId) + getBranchCustomerShipped(productId);
  };

  // Get Return In for a product
  const getReturnIn = (productId: string) => {
    const source = hasDateFilter ? orderStocks : allTimeOrderStocks;
    const filtered = source.find(f => f.productId === productId);
    return filtered?.returnIn || 0;
  };

  // Get Stock Out Marketer for a product (delivery_status = 'Shipped' with marketer_id)
  const getStockOutMarketer = (productId: string) => {
    const source = hasDateFilter ? orderStocks : allTimeOrderStocks;
    const filtered = source.find(f => f.productId === productId);
    return filtered?.stockOutMarketer || 0;
  };

  // Get Agent Purchases for a product
  const getAgentPurchases = (productId: string) => {
    const source = hasDateFilter ? orderStocks : allTimeOrderStocks;
    const filtered = source.find(f => f.productId === productId);
    return filtered?.agentPurchases || 0;
  };

  // Get Total Stock Out Agent (Stock Out Agent + Agent Purchases)
  const getTotalStockOutAgent = (productId: string) => {
    return getStockOutAgent(productId) + getAgentPurchases(productId);
  };

  // Get Total Stock Out (Agent + Marketer + Branch)
  const getTotalStockOut = (productId: string) => {
    return getTotalStockOutAgent(productId) + getStockOutMarketer(productId) + getTotalStockOutBranch(productId);
  };

  // Get Quantity from inventory table (source of truth - like HQ)
  const getQuantity = (productId: string) => {
    const product = products?.find(p => p.id === productId);
    return product?.currentQuantity || 0;
  };

  // Stats calculation
  const stockOutAgentFromBranch = (hasDateFilter ? filteredStocks : allTimeStocks).reduce((sum, f) => sum + f.stockOutAgent, 0);
  const agentPurchasesTotal = (hasDateFilter ? orderStocks : allTimeOrderStocks).reduce((sum, f) => sum + (f.agentPurchases || 0), 0);
  const stockOutBranchOnly = (hasDateFilter ? filteredStocks : allTimeStocks).reduce((sum, f) => sum + f.stockOutBranch, 0);
  const branchCustomerShippedTotal = (hasDateFilter ? orderStocks : allTimeOrderStocks).reduce((sum, f) => sum + (f.branchCustomerShipped || 0), 0);

  // Total Quantity from inventory table (source of truth - not affected by date filter)
  const totalQuantity = (products || []).reduce((sum, p) => sum + (p.currentQuantity || 0), 0);

  const stats = {
    totalProducts: products?.length || 0,
    totalQuantity,
    totalStockIn: (hasDateFilter ? filteredStocks : allTimeStocks).reduce((sum, f) => sum + f.stockIn, 0),
    returnIn: (hasDateFilter ? orderStocks : allTimeOrderStocks).reduce((sum, f) => sum + f.returnIn, 0),
    stockOutAgent: stockOutAgentFromBranch + agentPurchasesTotal, // Stock Out Agent + Agent Purchases
    stockOutMarketer: (hasDateFilter ? orderStocks : allTimeOrderStocks).reduce((sum, f) => sum + f.stockOutMarketer, 0),
    stockOutBranch: stockOutBranchOnly + branchCustomerShippedTotal, // Stock Out Branch + Branch Customer Shipped
    totalStockOut: 0,
  };
  stats.totalStockOut = stats.stockOutAgent + stats.stockOutMarketer + stats.stockOutBranch;

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

      {/* Stats Cards */}
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
                <p className="text-xs text-muted-foreground">Total Stock In</p>
                <p className="text-xl font-bold">{stats.totalStockIn.toLocaleString()}</p>
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
                <p className="text-xs text-muted-foreground">Stock Out Agent</p>
                <p className="text-xl font-bold text-orange-600">{stats.stockOutAgent.toLocaleString()}</p>
              </div>
              <TrendingDown className="w-6 h-6 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Stock Out Marketer</p>
                <p className="text-xl font-bold text-yellow-600">{stats.stockOutMarketer.toLocaleString()}</p>
              </div>
              <TrendingDown className="w-6 h-6 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Stock Out Branch</p>
                <p className="text-xl font-bold text-gray-600">{stats.stockOutBranch.toLocaleString()}</p>
              </div>
              <TrendingDown className="w-6 h-6 text-gray-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Stock Out</p>
                <p className="text-xl font-bold text-red-600">{stats.totalStockOut.toLocaleString()}</p>
              </div>
              <TrendingDown className="w-6 h-6 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Filters */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-4">Date Filters (Stock In/Out only - Quantity not affected)</h3>
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
                  <TableHead>Total Stock In</TableHead>
                  <TableHead>Return In</TableHead>
                  <TableHead className="text-orange-600">Stock Out Agent</TableHead>
                  <TableHead className="text-yellow-600">Stock Out Marketer</TableHead>
                  <TableHead className="text-gray-600">Stock Out Branch</TableHead>
                  <TableHead className="text-red-600">Total Stock Out</TableHead>
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
                      <TableCell className="text-orange-600">
                        {isFilterLoading ? "..." : getTotalStockOutAgent(product.id).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-yellow-600">
                        {isFilterLoading ? "..." : getStockOutMarketer(product.id).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {isFilterLoading ? "..." : getTotalStockOutBranch(product.id).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-red-600 font-medium">
                        {isFilterLoading ? "..." : getTotalStockOut(product.id).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-bold">
                        {getQuantity(product.id).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
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
