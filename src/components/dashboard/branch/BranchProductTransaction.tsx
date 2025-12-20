import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Loader2, TrendingUp, TrendingDown, RotateCcw, Truck, Store, Play, ShoppingBag, Globe, DollarSign } from "lucide-react";
import { format, parseISO, isWithinInterval } from "date-fns";

const BranchProductTransaction = () => {
  const { user } = useAuth();

  // Date filter state - default to current date only
  const today = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  // Fetch all products
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["all-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, base_cost, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch stock_in_branch for this branch
  const { data: stockInData, isLoading: stockInLoading } = useQuery({
    queryKey: ["branch-stock-in-transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_in_branch")
        .select("product_id, quantity, date")
        .eq("branch_id", user?.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch stock_out_branch for this branch
  const { data: stockOutData, isLoading: stockOutLoading } = useQuery({
    queryKey: ["branch-stock-out-transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_out_branch")
        .select("product_id, quantity, date")
        .eq("branch_id", user?.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch customer_purchases for this branch (for Shipped, Return, and Platform breakdown)
  const { data: purchasesData, isLoading: purchasesLoading } = useQuery({
    queryKey: ["branch-purchases-transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_purchases")
        .select("id, product_id, quantity, delivery_status, platform, jenis_platform, date_order, date_processed, date_return, marketer_id, total_price, storehub_product, produk, storehub_invoice, transaction_total")
        .eq("seller_id", user?.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Filter helper function
  const isInDateRange = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false;
    try {
      const date = parseISO(dateStr.split("T")[0]);
      return isWithinInterval(date, {
        start: parseISO(startDate),
        end: parseISO(endDate),
      });
    } catch {
      return false;
    }
  };

  // Helper function to check if SKU/name is a combo (contains " + ")
  const isCombo = (text: string | null | undefined): boolean => {
    return text ? text.includes(' + ') : false;
  };

  // Calculate product transaction data
  const productTransactions = useMemo(() => {
    if (!products) return [];

    // First, get regular products
    const regularProducts = products.map((product) => {
      // Stock In - filter by date
      const stockIn = stockInData
        ?.filter((s) => s.product_id === product.id && isInDateRange(s.date))
        ?.reduce((sum, s) => sum + (s.quantity || 0), 0) || 0;

      // Stock Out - filter by date
      const stockOut = stockOutData
        ?.filter((s) => s.product_id === product.id && isInDateRange(s.date))
        ?.reduce((sum, s) => sum + (s.quantity || 0), 0) || 0;

      // Get purchases for this product
      const productPurchases = purchasesData?.filter((p) => p.product_id === product.id) || [];

      // Total Sales - use total_price for per-product calculation
      // Note: For Product Transaction Report we use total_price (individual product price)
      // because we're showing sales PER PRODUCT, not total invoice
      const allOrdersByDateOrder = productPurchases.filter(
        (p) => isInDateRange(p.date_order)
      );
      const totalSales = allOrdersByDateOrder.reduce((sum, p) => sum + (Number(p.total_price) || 0), 0);

      // Shipped Out - delivery_status = 'Shipped', filter by date_processed
      const shippedPurchases = productPurchases.filter(
        (p) => p.delivery_status === "Shipped" && isInDateRange(p.date_processed)
      );
      const shippedUnits = shippedPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const shippedTransactions = shippedPurchases.length;

      // Return - delivery_status = 'Return', filter by date_return
      const returnPurchases = productPurchases.filter(
        (p) => p.delivery_status === "Return" && isInDateRange(p.date_return)
      );
      const returnUnits = returnPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const returnTransactions = returnPurchases.length;

      // Platform breakdown for Branch HQ orders (marketer_id is null)
      // Use 'platform' field for Branch HQ orders
      const branchHQShipped = shippedPurchases.filter((p) => !p.marketer_id);

      // StoreHub
      const storehubPurchases = branchHQShipped.filter((p) => p.platform === "StoreHub");
      const storehubUnits = storehubPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const storehubTransactions = storehubPurchases.length;

      // Tiktok HQ
      const tiktokPurchases = branchHQShipped.filter((p) => p.platform === "Tiktok HQ");
      const tiktokUnits = tiktokPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const tiktokTransactions = tiktokPurchases.length;

      // Shopee HQ
      const shopeePurchases = branchHQShipped.filter((p) => p.platform === "Shopee HQ");
      const shopeeUnits = shopeePurchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const shopeeTransactions = shopeePurchases.length;

      // Online (Facebook + Database + Google - NinjaVan)
      const onlinePurchases = branchHQShipped.filter(
        (p) => p.platform === "Facebook" || p.platform === "Database" || p.platform === "Google"
      );
      const onlineUnits = onlinePurchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const onlineTransactions = onlinePurchases.length;

      // Calculate percentages based on total shipped units
      const totalPlatformUnits = storehubUnits + tiktokUnits + shopeeUnits + onlineUnits;
      const storehubPct = totalPlatformUnits > 0 ? (storehubUnits / totalPlatformUnits) * 100 : 0;
      const tiktokPct = totalPlatformUnits > 0 ? (tiktokUnits / totalPlatformUnits) * 100 : 0;
      const shopeePct = totalPlatformUnits > 0 ? (shopeeUnits / totalPlatformUnits) * 100 : 0;
      const onlinePct = totalPlatformUnits > 0 ? (onlineUnits / totalPlatformUnits) * 100 : 0;

      return {
        ...product,
        totalSales,
        stockIn,
        stockOut,
        shippedUnits,
        shippedTransactions,
        returnUnits,
        returnTransactions,
        storehub: { units: storehubUnits, transactions: storehubTransactions, pct: storehubPct },
        tiktok: { units: tiktokUnits, transactions: tiktokTransactions, pct: tiktokPct },
        shopee: { units: shopeeUnits, transactions: shopeeTransactions, pct: shopeePct },
        online: { units: onlineUnits, transactions: onlineTransactions, pct: onlinePct },
        isCombo: false,
      };
    });

    // Now get combo products from purchases (where product_id is NULL and storehub_product or produk contains " + ")
    // This ensures no double counting - combos are only counted when product_id is NULL
    const comboPurchases = purchasesData?.filter((p: any) => {
      const productName = p.storehub_product || p.produk || "";
      // Only count as combo if product_id is NULL (not linked to a specific product)
      return !p.product_id && isCombo(productName) && isInDateRange(p.date_order);
    }) || [];

    // Group combo purchases by product name - also track units
    // Use total_price for per-product calculation (not transaction_total)
    const comboMap = new Map<string, { name: string; totalSales: number; units: number }>();
    comboPurchases.forEach((p: any) => {
      const comboName = p.storehub_product || p.produk || "Unknown Combo";
      const existing = comboMap.get(comboName);
      if (existing) {
        existing.totalSales += Number(p.total_price) || 0;
        existing.units += Number(p.quantity) || 0;
      } else {
        comboMap.set(comboName, {
          name: comboName,
          totalSales: Number(p.total_price) || 0,
          units: Number(p.quantity) || 0,
        });
      }
    });

    // Convert combo map to array with same structure as regular products
    const comboProducts = Array.from(comboMap.values()).map((combo, index) => ({
      id: `combo-${index}`,
      sku: `COMBO - ${combo.name}`, // Prefix with COMBO
      name: combo.name,
      totalSales: combo.totalSales,
      stockIn: 0,
      stockOut: 0,
      shippedUnits: combo.units, // Show combo units in Shipped Out column
      shippedTransactions: 0,
      returnUnits: 0,
      returnTransactions: 0,
      storehub: { units: 0, transactions: 0, pct: 0 },
      tiktok: { units: 0, transactions: 0, pct: 0 },
      shopee: { units: 0, transactions: 0, pct: 0 },
      online: { units: 0, transactions: 0, pct: 0 },
      isCombo: true,
    }));

    // Filter out combos with 0 sales and combine with regular products
    const filteredCombos = comboProducts.filter((c) => c.totalSales > 0);

    return [...regularProducts, ...filteredCombos];
  }, [products, stockInData, stockOutData, purchasesData, startDate, endDate]);

  // Summary stats - calculate Grand Total Sales using same logic as Dashboard
  const summaryStats = useMemo(() => {
    // Calculate Grand Total Sales using Dashboard's method:
    // - StoreHub: use transaction_total grouped by invoice
    // - Others: use total_price
    const allOrdersInRange = purchasesData?.filter((p: any) => isInDateRange(p.date_order)) || [];

    let grandTotalSales = 0;
    const storehubInvoiceTotals = new Map<string, number>();

    allOrdersInRange.forEach((o: any) => {
      if (o.platform === "StoreHub") {
        // StoreHub: use transaction_total grouped by invoice (same as Dashboard)
        const invoiceNumber = o.storehub_invoice || o.id;
        if (o.transaction_total && !storehubInvoiceTotals.has(invoiceNumber)) {
          storehubInvoiceTotals.set(invoiceNumber, Number(o.transaction_total) || 0);
        } else if (!o.transaction_total) {
          // Fallback for old data without transaction_total
          const current = storehubInvoiceTotals.get(invoiceNumber) || 0;
          storehubInvoiceTotals.set(invoiceNumber, current + (Number(o.total_price) || 0));
        }
      } else {
        // Non-StoreHub: use total_price
        grandTotalSales += Number(o.total_price) || 0;
      }
    });

    // Add StoreHub totals
    grandTotalSales += Array.from(storehubInvoiceTotals.values()).reduce((sum, v) => sum + v, 0);

    const totalStockIn = productTransactions.reduce((sum, p) => sum + p.stockIn, 0);
    const totalStockOut = productTransactions.reduce((sum, p) => sum + p.stockOut, 0);
    const totalShipped = productTransactions.reduce((sum, p) => sum + p.shippedUnits, 0);
    const totalReturn = productTransactions.reduce((sum, p) => sum + p.returnUnits, 0);
    const totalStorehub = productTransactions.reduce((sum, p) => sum + p.storehub.units, 0);
    const totalTiktok = productTransactions.reduce((sum, p) => sum + p.tiktok.units, 0);
    const totalShopee = productTransactions.reduce((sum, p) => sum + p.shopee.units, 0);
    const totalOnline = productTransactions.reduce((sum, p) => sum + p.online.units, 0);

    return {
      grandTotalSales,
      totalStockIn,
      totalStockOut,
      totalShipped,
      totalReturn,
      totalStorehub,
      totalTiktok,
      totalShopee,
      totalOnline,
    };
  }, [productTransactions, purchasesData, startDate, endDate]);

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const isLoading = productsLoading || stockInLoading || stockOutLoading || purchasesLoading;

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
          Product Transaction Report
        </h1>
        <p className="text-muted-foreground mt-2">
          View product transactions breakdown by date range
        </p>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="w-5 h-5" />
              <span className="font-medium text-foreground">Date Range:</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="space-y-1">
                <Label htmlFor="startDate" className="text-xs text-muted-foreground">From</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="endDate" className="text-xs text-muted-foreground">To</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-3">
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-yellow-600 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Total Sales</span>
            </div>
            <p className="text-xl font-bold">RM {summaryStats.grandTotalSales.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Stock In</span>
            </div>
            <p className="text-xl font-bold">{summaryStats.totalStockIn}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-medium">Stock Out</span>
            </div>
            <p className="text-xl font-bold">{summaryStats.totalStockOut}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Truck className="w-4 h-4" />
              <span className="text-xs font-medium">Shipped</span>
            </div>
            <p className="text-xl font-bold">{summaryStats.totalShipped}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <RotateCcw className="w-4 h-4" />
              <span className="text-xs font-medium">Return</span>
            </div>
            <p className="text-xl font-bold">{summaryStats.totalReturn}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-teal-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-teal-600 mb-1">
              <Store className="w-4 h-4" />
              <span className="text-xs font-medium">StoreHub</span>
            </div>
            <p className="text-xl font-bold">{summaryStats.totalStorehub}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-pink-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-pink-600 mb-1">
              <Play className="w-4 h-4" />
              <span className="text-xs font-medium">Tiktok</span>
            </div>
            <p className="text-xl font-bold">{summaryStats.totalTiktok}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-400">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-orange-500 mb-1">
              <ShoppingBag className="w-4 h-4" />
              <span className="text-xs font-medium">Shopee</span>
            </div>
            <p className="text-xl font-bold">{summaryStats.totalShopee}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-sky-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sky-600 mb-1">
              <Globe className="w-4 h-4" />
              <span className="text-xs font-medium">Online</span>
            </div>
            <p className="text-xl font-bold">{summaryStats.totalOnline}</p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Table */}
      <Card>
        <CardContent className="p-4">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10">SKU</TableHead>
                  <TableHead className="sticky left-16 bg-background z-10">Product Name</TableHead>
                  <TableHead className="text-center text-yellow-600">Total Sales</TableHead>
                  <TableHead className="text-center text-emerald-600">Stock In</TableHead>
                  <TableHead className="text-center text-red-600">Stock Out</TableHead>
                  <TableHead className="text-center text-blue-600">Shipped Out</TableHead>
                  <TableHead className="text-center text-orange-600">Return</TableHead>
                  <TableHead className="text-center bg-teal-50" colSpan={3}>
                    <div className="flex items-center justify-center gap-1">
                      <Store className="w-3 h-3" />
                      StoreHub
                    </div>
                  </TableHead>
                  <TableHead className="text-center bg-pink-50" colSpan={3}>
                    <div className="flex items-center justify-center gap-1">
                      <Play className="w-3 h-3" />
                      Tiktok
                    </div>
                  </TableHead>
                  <TableHead className="text-center bg-orange-50" colSpan={3}>
                    <div className="flex items-center justify-center gap-1">
                      <ShoppingBag className="w-3 h-3" />
                      Shopee
                    </div>
                  </TableHead>
                  <TableHead className="text-center bg-sky-50" colSpan={3}>
                    <div className="flex items-center justify-center gap-1">
                      <Globe className="w-3 h-3" />
                      Online
                    </div>
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10"></TableHead>
                  <TableHead className="sticky left-16 bg-background z-10"></TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground">RM</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground">Units</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground">Units</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground">Units</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground">Units</TableHead>
                  {/* StoreHub sub-headers */}
                  <TableHead className="text-center text-xs text-muted-foreground bg-teal-50">Units</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground bg-teal-50">Trans</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground bg-teal-50">%</TableHead>
                  {/* Tiktok sub-headers */}
                  <TableHead className="text-center text-xs text-muted-foreground bg-pink-50">Units</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground bg-pink-50">Trans</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground bg-pink-50">%</TableHead>
                  {/* Shopee sub-headers */}
                  <TableHead className="text-center text-xs text-muted-foreground bg-orange-50">Units</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground bg-orange-50">Trans</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground bg-orange-50">%</TableHead>
                  {/* Online sub-headers */}
                  <TableHead className="text-center text-xs text-muted-foreground bg-sky-50">Units</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground bg-sky-50">Trans</TableHead>
                  <TableHead className="text-center text-xs text-muted-foreground bg-sky-50">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productTransactions && productTransactions.length > 0 ? (
                  productTransactions.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium sticky left-0 bg-background z-10">{product.sku}</TableCell>
                      <TableCell className="sticky left-16 bg-background z-10">{product.name}</TableCell>
                      <TableCell className="text-center font-semibold text-yellow-600">{product.totalSales.toFixed(2)}</TableCell>
                      <TableCell className="text-center font-semibold text-emerald-600">{product.stockIn}</TableCell>
                      <TableCell className="text-center font-semibold text-red-600">{product.stockOut}</TableCell>
                      <TableCell className="text-center font-semibold text-blue-600">{product.shippedUnits}</TableCell>
                      <TableCell className="text-center font-semibold text-orange-600">{product.returnUnits}</TableCell>
                      {/* StoreHub */}
                      <TableCell className="text-center bg-teal-50/50">{product.storehub.units}</TableCell>
                      <TableCell className="text-center bg-teal-50/50">{product.storehub.transactions}</TableCell>
                      <TableCell className="text-center bg-teal-50/50 text-xs">{formatPercent(product.storehub.pct)}</TableCell>
                      {/* Tiktok */}
                      <TableCell className="text-center bg-pink-50/50">{product.tiktok.units}</TableCell>
                      <TableCell className="text-center bg-pink-50/50">{product.tiktok.transactions}</TableCell>
                      <TableCell className="text-center bg-pink-50/50 text-xs">{formatPercent(product.tiktok.pct)}</TableCell>
                      {/* Shopee */}
                      <TableCell className="text-center bg-orange-50/50">{product.shopee.units}</TableCell>
                      <TableCell className="text-center bg-orange-50/50">{product.shopee.transactions}</TableCell>
                      <TableCell className="text-center bg-orange-50/50 text-xs">{formatPercent(product.shopee.pct)}</TableCell>
                      {/* Online */}
                      <TableCell className="text-center bg-sky-50/50">{product.online.units}</TableCell>
                      <TableCell className="text-center bg-sky-50/50">{product.online.transactions}</TableCell>
                      <TableCell className="text-center bg-sky-50/50 text-xs">{formatPercent(product.online.pct)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={19} className="text-center py-8 text-muted-foreground">
                      No products available.
                    </TableCell>
                  </TableRow>
                )}
                {/* Summary Row */}
                {productTransactions && productTransactions.length > 0 && (
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell className="sticky left-0 bg-muted/50 z-10">TOTAL</TableCell>
                    <TableCell className="sticky left-16 bg-muted/50 z-10"></TableCell>
                    <TableCell className="text-center text-yellow-600">{summaryStats.grandTotalSales.toFixed(2)}</TableCell>
                    <TableCell className="text-center text-emerald-600">{summaryStats.totalStockIn}</TableCell>
                    <TableCell className="text-center text-red-600">{summaryStats.totalStockOut}</TableCell>
                    <TableCell className="text-center text-blue-600">{summaryStats.totalShipped}</TableCell>
                    <TableCell className="text-center text-orange-600">{summaryStats.totalReturn}</TableCell>
                    <TableCell className="text-center bg-teal-100/50">{summaryStats.totalStorehub}</TableCell>
                    <TableCell className="text-center bg-teal-100/50">
                      {productTransactions.reduce((sum, p) => sum + p.storehub.transactions, 0)}
                    </TableCell>
                    <TableCell className="text-center bg-teal-100/50">-</TableCell>
                    <TableCell className="text-center bg-pink-100/50">{summaryStats.totalTiktok}</TableCell>
                    <TableCell className="text-center bg-pink-100/50">
                      {productTransactions.reduce((sum, p) => sum + p.tiktok.transactions, 0)}
                    </TableCell>
                    <TableCell className="text-center bg-pink-100/50">-</TableCell>
                    <TableCell className="text-center bg-orange-100/50">{summaryStats.totalShopee}</TableCell>
                    <TableCell className="text-center bg-orange-100/50">
                      {productTransactions.reduce((sum, p) => sum + p.shopee.transactions, 0)}
                    </TableCell>
                    <TableCell className="text-center bg-orange-100/50">-</TableCell>
                    <TableCell className="text-center bg-sky-100/50">{summaryStats.totalOnline}</TableCell>
                    <TableCell className="text-center bg-sky-100/50">
                      {productTransactions.reduce((sum, p) => sum + p.online.transactions, 0)}
                    </TableCell>
                    <TableCell className="text-center bg-sky-100/50">-</TableCell>
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

export default BranchProductTransaction;
