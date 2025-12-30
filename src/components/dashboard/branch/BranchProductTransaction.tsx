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
      // Branch/Marketer breakdown for Total Sales
      const branchSales = allOrdersByDateOrder.filter((p) => !p.marketer_id).reduce((sum, p) => sum + (Number(p.total_price) || 0), 0);
      const marketerSales = allOrdersByDateOrder.filter((p) => p.marketer_id).reduce((sum, p) => sum + (Number(p.total_price) || 0), 0);

      // Shipped Out - delivery_status = 'Shipped', filter by date_processed
      const shippedPurchases = productPurchases.filter(
        (p) => p.delivery_status === "Shipped" && isInDateRange(p.date_processed)
      );
      const shippedUnits = shippedPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const shippedTransactions = shippedPurchases.length;
      // Branch/Marketer breakdown for Shipped
      const branchShippedUnits = shippedPurchases.filter((p) => !p.marketer_id).reduce((sum, p) => sum + (p.quantity || 0), 0);
      const marketerShippedUnits = shippedPurchases.filter((p) => p.marketer_id).reduce((sum, p) => sum + (p.quantity || 0), 0);

      // Return - delivery_status = 'Return', filter by date_return
      const returnPurchases = productPurchases.filter(
        (p) => p.delivery_status === "Return" && isInDateRange(p.date_return)
      );
      const returnUnits = returnPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const returnTransactions = returnPurchases.length;
      // Branch/Marketer breakdown for Return
      const branchReturnUnits = returnPurchases.filter((p) => !p.marketer_id).reduce((sum, p) => sum + (p.quantity || 0), 0);
      const marketerReturnUnits = returnPurchases.filter((p) => p.marketer_id).reduce((sum, p) => sum + (p.quantity || 0), 0);

      // Platform breakdown - Branch uses 'platform', Marketer uses 'jenis_platform'
      const branchHQShipped = shippedPurchases.filter((p) => !p.marketer_id);
      const marketerShipped = shippedPurchases.filter((p) => p.marketer_id);

      // StoreHub (Branch only)
      const storehubPurchases = branchHQShipped.filter((p) => p.platform === "StoreHub");
      const storehubUnits = storehubPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const storehubTransactions = storehubPurchases.length;

      // Tiktok - Branch uses "Tiktok HQ", Marketer uses jenis_platform "Tiktok"
      const branchTiktokPurchases = branchHQShipped.filter((p) => p.platform === "Tiktok HQ");
      const branchTiktokUnits = branchTiktokPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const branchTiktokTransactions = branchTiktokPurchases.length;
      const marketerTiktokPurchases = marketerShipped.filter((p) => p.jenis_platform === "Tiktok");
      const marketerTiktokUnits = marketerTiktokPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const marketerTiktokTransactions = marketerTiktokPurchases.length;
      const tiktokUnits = branchTiktokUnits + marketerTiktokUnits;
      const tiktokTransactions = branchTiktokTransactions + marketerTiktokTransactions;

      // Shopee - Branch uses "Shopee HQ", Marketer uses jenis_platform "Shopee"
      const branchShopeePurchases = branchHQShipped.filter((p) => p.platform === "Shopee HQ");
      const branchShopeeUnits = branchShopeePurchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const branchShopeeTransactions = branchShopeePurchases.length;
      const marketerShopeePurchases = marketerShipped.filter((p) => p.jenis_platform === "Shopee");
      const marketerShopeeUnits = marketerShopeePurchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const marketerShopeeTransactions = marketerShopeePurchases.length;
      const shopeeUnits = branchShopeeUnits + marketerShopeeUnits;
      const shopeeTransactions = branchShopeeTransactions + marketerShopeeTransactions;

      // Online - Branch uses Facebook/Database/Google, Marketer uses other jenis_platform
      const branchOnlinePurchases = branchHQShipped.filter(
        (p) => p.platform === "Facebook" || p.platform === "Database" || p.platform === "Google"
      );
      const branchOnlineUnits = branchOnlinePurchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const branchOnlineTransactions = branchOnlinePurchases.length;
      const marketerOnlinePurchases = marketerShipped.filter(
        (p) => p.jenis_platform && p.jenis_platform !== "Tiktok" && p.jenis_platform !== "Shopee"
      );
      const marketerOnlineUnits = marketerOnlinePurchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const marketerOnlineTransactions = marketerOnlinePurchases.length;
      const onlineUnits = branchOnlineUnits + marketerOnlineUnits;
      const onlineTransactions = branchOnlineTransactions + marketerOnlineTransactions;

      // Calculate percentages based on total shipped units
      const totalPlatformUnits = storehubUnits + tiktokUnits + shopeeUnits + onlineUnits;
      const storehubPct = totalPlatformUnits > 0 ? (storehubUnits / totalPlatformUnits) * 100 : 0;
      const tiktokPct = totalPlatformUnits > 0 ? (tiktokUnits / totalPlatformUnits) * 100 : 0;
      const branchTiktokPct = totalPlatformUnits > 0 ? (branchTiktokUnits / totalPlatformUnits) * 100 : 0;
      const marketerTiktokPct = totalPlatformUnits > 0 ? (marketerTiktokUnits / totalPlatformUnits) * 100 : 0;
      const shopeePct = totalPlatformUnits > 0 ? (shopeeUnits / totalPlatformUnits) * 100 : 0;
      const branchShopeePct = totalPlatformUnits > 0 ? (branchShopeeUnits / totalPlatformUnits) * 100 : 0;
      const marketerShopeePct = totalPlatformUnits > 0 ? (marketerShopeeUnits / totalPlatformUnits) * 100 : 0;
      const onlinePct = totalPlatformUnits > 0 ? (onlineUnits / totalPlatformUnits) * 100 : 0;
      const branchOnlinePct = totalPlatformUnits > 0 ? (branchOnlineUnits / totalPlatformUnits) * 100 : 0;
      const marketerOnlinePct = totalPlatformUnits > 0 ? (marketerOnlineUnits / totalPlatformUnits) * 100 : 0;

      return {
        ...product,
        totalSales,
        branchSales,
        marketerSales,
        stockIn,
        stockOut,
        shippedUnits,
        branchShippedUnits,
        marketerShippedUnits,
        shippedTransactions,
        returnUnits,
        branchReturnUnits,
        marketerReturnUnits,
        returnTransactions,
        storehub: { units: storehubUnits, transactions: storehubTransactions, pct: storehubPct },
        tiktok: { units: tiktokUnits, branchUnits: branchTiktokUnits, marketerUnits: marketerTiktokUnits, transactions: tiktokTransactions, branchTransactions: branchTiktokTransactions, marketerTransactions: marketerTiktokTransactions, pct: tiktokPct, branchPct: branchTiktokPct, marketerPct: marketerTiktokPct },
        shopee: { units: shopeeUnits, branchUnits: branchShopeeUnits, marketerUnits: marketerShopeeUnits, transactions: shopeeTransactions, branchTransactions: branchShopeeTransactions, marketerTransactions: marketerShopeeTransactions, pct: shopeePct, branchPct: branchShopeePct, marketerPct: marketerShopeePct },
        online: { units: onlineUnits, branchUnits: branchOnlineUnits, marketerUnits: marketerOnlineUnits, transactions: onlineTransactions, branchTransactions: branchOnlineTransactions, marketerTransactions: marketerOnlineTransactions, pct: onlinePct, branchPct: branchOnlinePct, marketerPct: marketerOnlinePct },
        isCombo: false,
      };
    });

    // Now get combo products from purchases (where product_id is NULL and storehub_product or produk contains " + ")
    // This ensures no double counting - combos are only counted when product_id is NULL
    const allComboPurchases = purchasesData?.filter((p: any) => {
      const productName = p.storehub_product || p.produk || "";
      // Only count as combo if product_id is NULL (not linked to a specific product)
      return !p.product_id && isCombo(productName);
    }) || [];

    // Group combo purchases by product name with full breakdown like regular products
    const comboMap = new Map<string, {
      name: string;
      totalSales: number;
      branchSales: number;
      marketerSales: number;
      shippedUnits: number;
      branchShippedUnits: number;
      marketerShippedUnits: number;
      shippedTransactions: number;
      returnUnits: number;
      branchReturnUnits: number;
      marketerReturnUnits: number;
      returnTransactions: number;
      storehub: { units: number; transactions: number };
      tiktok: { units: number; branchUnits: number; marketerUnits: number; transactions: number; branchTransactions: number; marketerTransactions: number };
      shopee: { units: number; branchUnits: number; marketerUnits: number; transactions: number; branchTransactions: number; marketerTransactions: number };
      online: { units: number; branchUnits: number; marketerUnits: number; transactions: number; branchTransactions: number; marketerTransactions: number };
    }>();

    allComboPurchases.forEach((p: any) => {
      const comboName = p.storehub_product || p.produk || "Unknown Combo";
      const isBranch = !p.marketer_id;

      // Get or create combo entry
      if (!comboMap.has(comboName)) {
        comboMap.set(comboName, {
          name: comboName,
          totalSales: 0,
          branchSales: 0,
          marketerSales: 0,
          shippedUnits: 0,
          branchShippedUnits: 0,
          marketerShippedUnits: 0,
          shippedTransactions: 0,
          returnUnits: 0,
          branchReturnUnits: 0,
          marketerReturnUnits: 0,
          returnTransactions: 0,
          storehub: { units: 0, transactions: 0 },
          tiktok: { units: 0, branchUnits: 0, marketerUnits: 0, transactions: 0, branchTransactions: 0, marketerTransactions: 0 },
          shopee: { units: 0, branchUnits: 0, marketerUnits: 0, transactions: 0, branchTransactions: 0, marketerTransactions: 0 },
          online: { units: 0, branchUnits: 0, marketerUnits: 0, transactions: 0, branchTransactions: 0, marketerTransactions: 0 },
        });
      }

      const combo = comboMap.get(comboName)!;
      const qty = Number(p.quantity) || 0;

      // Total Sales - filter by date_order
      if (isInDateRange(p.date_order)) {
        const price = Number(p.total_price) || 0;
        combo.totalSales += price;
        if (isBranch) {
          combo.branchSales += price;
        } else {
          combo.marketerSales += price;
        }
      }

      // Shipped Out - delivery_status = 'Shipped', filter by date_processed
      if (p.delivery_status === "Shipped" && isInDateRange(p.date_processed)) {
        combo.shippedUnits += qty;
        combo.shippedTransactions += 1;
        if (isBranch) {
          combo.branchShippedUnits += qty;
        } else {
          combo.marketerShippedUnits += qty;
        }

        // Platform breakdown - Branch uses 'platform', Marketer uses 'jenis_platform'
        if (isBranch) {
          if (p.platform === "StoreHub") {
            combo.storehub.units += qty;
            combo.storehub.transactions += 1;
          } else if (p.platform === "Tiktok HQ") {
            combo.tiktok.units += qty;
            combo.tiktok.branchUnits += qty;
            combo.tiktok.transactions += 1;
            combo.tiktok.branchTransactions += 1;
          } else if (p.platform === "Shopee HQ") {
            combo.shopee.units += qty;
            combo.shopee.branchUnits += qty;
            combo.shopee.transactions += 1;
            combo.shopee.branchTransactions += 1;
          } else if (p.platform === "Facebook" || p.platform === "Database" || p.platform === "Google") {
            combo.online.units += qty;
            combo.online.branchUnits += qty;
            combo.online.transactions += 1;
            combo.online.branchTransactions += 1;
          }
        } else {
          // Marketer - use jenis_platform
          if (p.jenis_platform === "Tiktok") {
            combo.tiktok.units += qty;
            combo.tiktok.marketerUnits += qty;
            combo.tiktok.transactions += 1;
            combo.tiktok.marketerTransactions += 1;
          } else if (p.jenis_platform === "Shopee") {
            combo.shopee.units += qty;
            combo.shopee.marketerUnits += qty;
            combo.shopee.transactions += 1;
            combo.shopee.marketerTransactions += 1;
          } else if (p.jenis_platform) {
            combo.online.units += qty;
            combo.online.marketerUnits += qty;
            combo.online.transactions += 1;
            combo.online.marketerTransactions += 1;
          }
        }
      }

      // Return - delivery_status = 'Return', filter by date_return
      if (p.delivery_status === "Return" && isInDateRange(p.date_return)) {
        combo.returnUnits += qty;
        combo.returnTransactions += 1;
        if (isBranch) {
          combo.branchReturnUnits += qty;
        } else {
          combo.marketerReturnUnits += qty;
        }
      }
    });

    // Convert combo map to array with same structure as regular products
    const comboProducts = Array.from(comboMap.values()).map((combo, index) => {
      // Calculate percentages based on total shipped units
      const totalPlatformUnits = combo.storehub.units + combo.tiktok.units + combo.shopee.units + combo.online.units;
      const storehubPct = totalPlatformUnits > 0 ? (combo.storehub.units / totalPlatformUnits) * 100 : 0;
      const tiktokPct = totalPlatformUnits > 0 ? (combo.tiktok.units / totalPlatformUnits) * 100 : 0;
      const branchTiktokPct = totalPlatformUnits > 0 ? (combo.tiktok.branchUnits / totalPlatformUnits) * 100 : 0;
      const marketerTiktokPct = totalPlatformUnits > 0 ? (combo.tiktok.marketerUnits / totalPlatformUnits) * 100 : 0;
      const shopeePct = totalPlatformUnits > 0 ? (combo.shopee.units / totalPlatformUnits) * 100 : 0;
      const branchShopeePct = totalPlatformUnits > 0 ? (combo.shopee.branchUnits / totalPlatformUnits) * 100 : 0;
      const marketerShopeePct = totalPlatformUnits > 0 ? (combo.shopee.marketerUnits / totalPlatformUnits) * 100 : 0;
      const onlinePct = totalPlatformUnits > 0 ? (combo.online.units / totalPlatformUnits) * 100 : 0;
      const branchOnlinePct = totalPlatformUnits > 0 ? (combo.online.branchUnits / totalPlatformUnits) * 100 : 0;
      const marketerOnlinePct = totalPlatformUnits > 0 ? (combo.online.marketerUnits / totalPlatformUnits) * 100 : 0;

      return {
        id: `combo-${index}`,
        sku: `COMBO - ${combo.name}`, // Prefix with COMBO
        name: combo.name,
        totalSales: combo.totalSales,
        branchSales: combo.branchSales,
        marketerSales: combo.marketerSales,
        stockIn: 0,
        stockOut: 0,
        shippedUnits: combo.shippedUnits,
        branchShippedUnits: combo.branchShippedUnits,
        marketerShippedUnits: combo.marketerShippedUnits,
        shippedTransactions: combo.shippedTransactions,
        returnUnits: combo.returnUnits,
        branchReturnUnits: combo.branchReturnUnits,
        marketerReturnUnits: combo.marketerReturnUnits,
        returnTransactions: combo.returnTransactions,
        storehub: { units: combo.storehub.units, transactions: combo.storehub.transactions, pct: storehubPct },
        tiktok: { units: combo.tiktok.units, branchUnits: combo.tiktok.branchUnits, marketerUnits: combo.tiktok.marketerUnits, transactions: combo.tiktok.transactions, branchTransactions: combo.tiktok.branchTransactions, marketerTransactions: combo.tiktok.marketerTransactions, pct: tiktokPct, branchPct: branchTiktokPct, marketerPct: marketerTiktokPct },
        shopee: { units: combo.shopee.units, branchUnits: combo.shopee.branchUnits, marketerUnits: combo.shopee.marketerUnits, transactions: combo.shopee.transactions, branchTransactions: combo.shopee.branchTransactions, marketerTransactions: combo.shopee.marketerTransactions, pct: shopeePct, branchPct: branchShopeePct, marketerPct: marketerShopeePct },
        online: { units: combo.online.units, branchUnits: combo.online.branchUnits, marketerUnits: combo.online.marketerUnits, transactions: combo.online.transactions, branchTransactions: combo.online.branchTransactions, marketerTransactions: combo.online.marketerTransactions, pct: onlinePct, branchPct: branchOnlinePct, marketerPct: marketerOnlinePct },
        isCombo: true,
      };
    });

    // Filter out combos with no activity (no sales, shipped, or returns) and combine with regular products
    const filteredCombos = comboProducts.filter((c) => c.totalSales > 0 || c.shippedUnits > 0 || c.returnUnits > 0);

    return [...regularProducts, ...filteredCombos];
  }, [products, stockInData, stockOutData, purchasesData, startDate, endDate]);

  // Summary stats - calculate Grand Total Sales with Branch/Marketer breakdown
  const summaryStats = useMemo(() => {
    // Calculate Grand Total Sales using Dashboard's method:
    // - StoreHub: use transaction_total grouped by invoice
    // - Others: use total_price
    const allOrdersInRange = purchasesData?.filter((p: any) => isInDateRange(p.date_order)) || [];

    let grandTotalSales = 0;
    let branchTotalSales = 0;
    let marketerTotalSales = 0;
    const storehubInvoiceTotals = new Map<string, number>();

    allOrdersInRange.forEach((o: any) => {
      const isBranch = !o.marketer_id;
      if (o.platform === "StoreHub") {
        // StoreHub: use transaction_total grouped by invoice (same as Dashboard)
        const invoiceNumber = o.storehub_invoice || o.id;
        if (o.transaction_total && !storehubInvoiceTotals.has(invoiceNumber)) {
          storehubInvoiceTotals.set(invoiceNumber, Number(o.transaction_total) || 0);
          // StoreHub is always Branch
          branchTotalSales += Number(o.transaction_total) || 0;
        } else if (!o.transaction_total) {
          // Fallback for old data without transaction_total
          const current = storehubInvoiceTotals.get(invoiceNumber) || 0;
          storehubInvoiceTotals.set(invoiceNumber, current + (Number(o.total_price) || 0));
          branchTotalSales += Number(o.total_price) || 0;
        }
      } else {
        // Non-StoreHub: use total_price
        grandTotalSales += Number(o.total_price) || 0;
        if (isBranch) {
          branchTotalSales += Number(o.total_price) || 0;
        } else {
          marketerTotalSales += Number(o.total_price) || 0;
        }
      }
    });

    // Add StoreHub totals to grand total
    grandTotalSales += Array.from(storehubInvoiceTotals.values()).reduce((sum, v) => sum + v, 0);

    // Calculate Shipped breakdown by Branch/Marketer
    const shippedOrders = purchasesData?.filter((p: any) => p.delivery_status === "Shipped" && isInDateRange(p.date_processed)) || [];
    const branchShipped = shippedOrders.filter((p: any) => !p.marketer_id).reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
    const marketerShipped = shippedOrders.filter((p: any) => p.marketer_id).reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
    const totalShipped = branchShipped + marketerShipped;

    // Calculate Return breakdown by Branch/Marketer
    const returnOrders = purchasesData?.filter((p: any) => p.delivery_status === "Return" && isInDateRange(p.date_return)) || [];
    const branchReturn = returnOrders.filter((p: any) => !p.marketer_id).reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
    const marketerReturn = returnOrders.filter((p: any) => p.marketer_id).reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
    const totalReturn = branchReturn + marketerReturn;

    // Platform breakdown with Branch/Marketer - calculate from shipped orders
    // StoreHub (Branch only - marketers don't use StoreHub)
    const storehubOrders = shippedOrders.filter((p: any) => p.platform === "StoreHub" && !p.marketer_id);
    const totalStorehub = storehubOrders.reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);

    // Tiktok - Branch uses "Tiktok HQ", Marketer uses jenis_platform "Tiktok"
    const branchTiktok = shippedOrders.filter((p: any) => p.platform === "Tiktok HQ" && !p.marketer_id).reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
    const marketerTiktok = shippedOrders.filter((p: any) => p.jenis_platform === "Tiktok" && p.marketer_id).reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
    const totalTiktok = branchTiktok + marketerTiktok;

    // Shopee - Branch uses "Shopee HQ", Marketer uses jenis_platform "Shopee"
    const branchShopee = shippedOrders.filter((p: any) => p.platform === "Shopee HQ" && !p.marketer_id).reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
    const marketerShopee = shippedOrders.filter((p: any) => p.jenis_platform === "Shopee" && p.marketer_id).reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
    const totalShopee = branchShopee + marketerShopee;

    // Online - Branch uses Facebook/Database/Google, Marketer uses jenis_platform not Tiktok/Shopee (like Facebook, etc)
    const branchOnline = shippedOrders.filter((p: any) =>
      !p.marketer_id && (p.platform === "Facebook" || p.platform === "Database" || p.platform === "Google")
    ).reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
    const marketerOnline = shippedOrders.filter((p: any) =>
      p.marketer_id && p.jenis_platform && p.jenis_platform !== "Tiktok" && p.jenis_platform !== "Shopee"
    ).reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
    const totalOnline = branchOnline + marketerOnline;

    // Stock In/Out (only Branch HQ)
    const totalStockIn = productTransactions.reduce((sum, p) => sum + p.stockIn, 0);
    const totalStockOut = productTransactions.reduce((sum, p) => sum + p.stockOut, 0);

    return {
      grandTotalSales,
      branchTotalSales,
      marketerTotalSales,
      totalStockIn,
      totalStockOut,
      totalShipped,
      branchShipped,
      marketerShipped,
      totalReturn,
      branchReturn,
      marketerReturn,
      totalStorehub,
      totalTiktok,
      branchTiktok,
      marketerTiktok,
      totalShopee,
      branchShopee,
      marketerShopee,
      totalOnline,
      branchOnline,
      marketerOnline,
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

      {/* Summary Stats Cards with Sum | Branch | Marketer breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-3">
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-yellow-600 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Total Sales</span>
            </div>
            <p className="text-xl font-bold">RM {summaryStats.grandTotalSales.toFixed(2)}</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <span className="text-blue-600">{summaryStats.branchTotalSales.toFixed(0)}</span>
              <span>|</span>
              <span className="text-purple-600">{summaryStats.marketerTotalSales.toFixed(0)}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="text-blue-600">Branch</span>
              <span>|</span>
              <span className="text-purple-600">Marketer</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Stock In</span>
            </div>
            <p className="text-xl font-bold">{summaryStats.totalStockIn}</p>
            <div className="text-xs text-muted-foreground mt-1">Branch only</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-medium">Stock Out</span>
            </div>
            <p className="text-xl font-bold">{summaryStats.totalStockOut}</p>
            <div className="text-xs text-muted-foreground mt-1">Branch only</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Truck className="w-4 h-4" />
              <span className="text-xs font-medium">Shipped</span>
            </div>
            <p className="text-xl font-bold">{summaryStats.totalShipped}</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <span className="text-blue-600">{summaryStats.branchShipped}</span>
              <span>|</span>
              <span className="text-purple-600">{summaryStats.marketerShipped}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="text-blue-600">Branch</span>
              <span>|</span>
              <span className="text-purple-600">Marketer</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <RotateCcw className="w-4 h-4" />
              <span className="text-xs font-medium">Return</span>
            </div>
            <p className="text-xl font-bold">{summaryStats.totalReturn}</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <span className="text-blue-600">{summaryStats.branchReturn}</span>
              <span>|</span>
              <span className="text-purple-600">{summaryStats.marketerReturn}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="text-blue-600">Branch</span>
              <span>|</span>
              <span className="text-purple-600">Marketer</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-teal-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-teal-600 mb-1">
              <Store className="w-4 h-4" />
              <span className="text-xs font-medium">StoreHub</span>
            </div>
            <p className="text-xl font-bold">{summaryStats.totalStorehub}</p>
            <div className="text-xs text-muted-foreground mt-1">Branch only</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-pink-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-pink-600 mb-1">
              <Play className="w-4 h-4" />
              <span className="text-xs font-medium">Tiktok</span>
            </div>
            <p className="text-xl font-bold">{summaryStats.totalTiktok}</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <span className="text-blue-600">{summaryStats.branchTiktok}</span>
              <span>|</span>
              <span className="text-purple-600">{summaryStats.marketerTiktok}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="text-blue-600">Branch</span>
              <span>|</span>
              <span className="text-purple-600">Marketer</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-400">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-orange-500 mb-1">
              <ShoppingBag className="w-4 h-4" />
              <span className="text-xs font-medium">Shopee</span>
            </div>
            <p className="text-xl font-bold">{summaryStats.totalShopee}</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <span className="text-blue-600">{summaryStats.branchShopee}</span>
              <span>|</span>
              <span className="text-purple-600">{summaryStats.marketerShopee}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="text-blue-600">Branch</span>
              <span>|</span>
              <span className="text-purple-600">Marketer</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-sky-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sky-600 mb-1">
              <Globe className="w-4 h-4" />
              <span className="text-xs font-medium">Online</span>
            </div>
            <p className="text-xl font-bold">{summaryStats.totalOnline}</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <span className="text-blue-600">{summaryStats.branchOnline}</span>
              <span>|</span>
              <span className="text-purple-600">{summaryStats.marketerOnline}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="text-blue-600">Branch</span>
              <span>|</span>
              <span className="text-purple-600">Marketer</span>
            </div>
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
                      <TableCell className="text-center">
                        <div className="font-semibold text-yellow-600">{product.totalSales.toFixed(2)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          <span className="text-blue-600">{product.branchSales.toFixed(0)}</span>
                          <span className="mx-0.5">|</span>
                          <span className="text-purple-600">{product.marketerSales.toFixed(0)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold text-emerald-600">{product.stockIn}</TableCell>
                      <TableCell className="text-center font-semibold text-red-600">{product.stockOut}</TableCell>
                      <TableCell className="text-center">
                        <div className="font-semibold text-blue-600">{product.shippedUnits}</div>
                        <div className="text-[10px] text-muted-foreground">
                          <span className="text-blue-600">{product.branchShippedUnits}</span>
                          <span className="mx-0.5">|</span>
                          <span className="text-purple-600">{product.marketerShippedUnits}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-semibold text-orange-600">{product.returnUnits}</div>
                        <div className="text-[10px] text-muted-foreground">
                          <span className="text-blue-600">{product.branchReturnUnits}</span>
                          <span className="mx-0.5">|</span>
                          <span className="text-purple-600">{product.marketerReturnUnits}</span>
                        </div>
                      </TableCell>
                      {/* StoreHub */}
                      <TableCell className="text-center bg-teal-50/50">{product.storehub.units}</TableCell>
                      <TableCell className="text-center bg-teal-50/50">{product.storehub.transactions}</TableCell>
                      <TableCell className="text-center bg-teal-50/50 text-xs">{formatPercent(product.storehub.pct)}</TableCell>
                      {/* Tiktok */}
                      <TableCell className="text-center bg-pink-50/50">
                        <div>{product.tiktok.units}</div>
                        <div className="text-[10px] text-muted-foreground">
                          <span className="text-blue-600">{product.tiktok.branchUnits}</span>
                          <span className="mx-0.5">|</span>
                          <span className="text-purple-600">{product.tiktok.marketerUnits}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center bg-pink-50/50">
                        <div>{product.tiktok.transactions}</div>
                        <div className="text-[10px] text-muted-foreground">
                          <span className="text-blue-600">{product.tiktok.branchTransactions}</span>
                          <span className="mx-0.5">|</span>
                          <span className="text-purple-600">{product.tiktok.marketerTransactions}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center bg-pink-50/50 text-xs">
                        <div>{formatPercent(product.tiktok.pct)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          <span className="text-blue-600">{formatPercent(product.tiktok.branchPct)}</span>
                          <span className="mx-0.5">|</span>
                          <span className="text-purple-600">{formatPercent(product.tiktok.marketerPct)}</span>
                        </div>
                      </TableCell>
                      {/* Shopee */}
                      <TableCell className="text-center bg-orange-50/50">
                        <div>{product.shopee.units}</div>
                        <div className="text-[10px] text-muted-foreground">
                          <span className="text-blue-600">{product.shopee.branchUnits}</span>
                          <span className="mx-0.5">|</span>
                          <span className="text-purple-600">{product.shopee.marketerUnits}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center bg-orange-50/50">
                        <div>{product.shopee.transactions}</div>
                        <div className="text-[10px] text-muted-foreground">
                          <span className="text-blue-600">{product.shopee.branchTransactions}</span>
                          <span className="mx-0.5">|</span>
                          <span className="text-purple-600">{product.shopee.marketerTransactions}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center bg-orange-50/50 text-xs">
                        <div>{formatPercent(product.shopee.pct)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          <span className="text-blue-600">{formatPercent(product.shopee.branchPct)}</span>
                          <span className="mx-0.5">|</span>
                          <span className="text-purple-600">{formatPercent(product.shopee.marketerPct)}</span>
                        </div>
                      </TableCell>
                      {/* Online */}
                      <TableCell className="text-center bg-sky-50/50">
                        <div>{product.online.units}</div>
                        <div className="text-[10px] text-muted-foreground">
                          <span className="text-blue-600">{product.online.branchUnits}</span>
                          <span className="mx-0.5">|</span>
                          <span className="text-purple-600">{product.online.marketerUnits}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center bg-sky-50/50">
                        <div>{product.online.transactions}</div>
                        <div className="text-[10px] text-muted-foreground">
                          <span className="text-blue-600">{product.online.branchTransactions}</span>
                          <span className="mx-0.5">|</span>
                          <span className="text-purple-600">{product.online.marketerTransactions}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center bg-sky-50/50 text-xs">
                        <div>{formatPercent(product.online.pct)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          <span className="text-blue-600">{formatPercent(product.online.branchPct)}</span>
                          <span className="mx-0.5">|</span>
                          <span className="text-purple-600">{formatPercent(product.online.marketerPct)}</span>
                        </div>
                      </TableCell>
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
                    <TableCell className="text-center">
                      <div className="text-yellow-600">{summaryStats.grandTotalSales.toFixed(2)}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        <span className="text-blue-600">{summaryStats.branchTotalSales.toFixed(0)}</span>
                        <span className="mx-0.5">|</span>
                        <span className="text-purple-600">{summaryStats.marketerTotalSales.toFixed(0)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-emerald-600">{summaryStats.totalStockIn}</TableCell>
                    <TableCell className="text-center text-red-600">{summaryStats.totalStockOut}</TableCell>
                    <TableCell className="text-center">
                      <div className="text-blue-600">{summaryStats.totalShipped}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        <span className="text-blue-600">{summaryStats.branchShipped}</span>
                        <span className="mx-0.5">|</span>
                        <span className="text-purple-600">{summaryStats.marketerShipped}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-orange-600">{summaryStats.totalReturn}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        <span className="text-blue-600">{summaryStats.branchReturn}</span>
                        <span className="mx-0.5">|</span>
                        <span className="text-purple-600">{summaryStats.marketerReturn}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center bg-teal-100/50">{summaryStats.totalStorehub}</TableCell>
                    <TableCell className="text-center bg-teal-100/50">
                      {productTransactions.reduce((sum, p) => sum + p.storehub.transactions, 0)}
                    </TableCell>
                    <TableCell className="text-center bg-teal-100/50">-</TableCell>
                    <TableCell className="text-center bg-pink-100/50">
                      <div>{summaryStats.totalTiktok}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        <span className="text-blue-600">{summaryStats.branchTiktok}</span>
                        <span className="mx-0.5">|</span>
                        <span className="text-purple-600">{summaryStats.marketerTiktok}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center bg-pink-100/50">
                      <div>{productTransactions.reduce((sum, p) => sum + p.tiktok.transactions, 0)}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        <span className="text-blue-600">{productTransactions.reduce((sum, p) => sum + p.tiktok.branchTransactions, 0)}</span>
                        <span className="mx-0.5">|</span>
                        <span className="text-purple-600">{productTransactions.reduce((sum, p) => sum + p.tiktok.marketerTransactions, 0)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center bg-pink-100/50">-</TableCell>
                    <TableCell className="text-center bg-orange-100/50">
                      <div>{summaryStats.totalShopee}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        <span className="text-blue-600">{summaryStats.branchShopee}</span>
                        <span className="mx-0.5">|</span>
                        <span className="text-purple-600">{summaryStats.marketerShopee}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center bg-orange-100/50">
                      <div>{productTransactions.reduce((sum, p) => sum + p.shopee.transactions, 0)}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        <span className="text-blue-600">{productTransactions.reduce((sum, p) => sum + p.shopee.branchTransactions, 0)}</span>
                        <span className="mx-0.5">|</span>
                        <span className="text-purple-600">{productTransactions.reduce((sum, p) => sum + p.shopee.marketerTransactions, 0)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center bg-orange-100/50">-</TableCell>
                    <TableCell className="text-center bg-sky-100/50">
                      <div>{summaryStats.totalOnline}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        <span className="text-blue-600">{summaryStats.branchOnline}</span>
                        <span className="mx-0.5">|</span>
                        <span className="text-purple-600">{summaryStats.marketerOnline}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center bg-sky-100/50">
                      <div>{productTransactions.reduce((sum, p) => sum + p.online.transactions, 0)}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        <span className="text-blue-600">{productTransactions.reduce((sum, p) => sum + p.online.branchTransactions, 0)}</span>
                        <span className="mx-0.5">|</span>
                        <span className="text-purple-600">{productTransactions.reduce((sum, p) => sum + p.online.marketerTransactions, 0)}</span>
                      </div>
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
