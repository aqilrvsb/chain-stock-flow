import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Calendar, DollarSign, Users, ShoppingCart, Package, Store, Play, ShoppingBag, Facebook, Database, Globe, Boxes } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

const BranchDashboardView = () => {
  const { user, userProfile } = useAuth();
  const userName = userProfile?.idstaff || "Branch";

  // Date filter state - default to current month
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));

  // Fetch branch's customer_purchases (Branch orders)
  const { data: branchOrders = [], isLoading: branchOrdersLoading } = useQuery({
    queryKey: ["branch-orders", user?.id, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("customer_purchases")
        .select("*, customers(name, phone)")
        .eq("seller_id", user?.id)
        .is("marketer_id", null);

      // Add date filter in Supabase query for efficiency
      if (startDate) {
        query = query.gte("date_order", startDate);
      }
      if (endDate) {
        query = query.lte("date_order", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch marketers under this branch
  const { data: marketers = [], isLoading: marketersLoading } = useQuery({
    queryKey: ["branch-marketers", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, idstaff, full_name")
        .eq("branch_id", user?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch marketer orders (customer_purchases where marketer_id IS NOT NULL)
  const { data: marketerOrders = [], isLoading: marketerOrdersLoading } = useQuery({
    queryKey: ["branch-marketer-orders", user?.id, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("customer_purchases")
        .select("*, customers(name, phone)")
        .eq("seller_id", user?.id)
        .not("marketer_id", "is", null);

      // Add date filter in Supabase query for efficiency
      if (startDate) {
        query = query.gte("date_order", startDate);
      }
      if (endDate) {
        query = query.lte("date_order", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Date filtering is now done in Supabase query
  const filteredBranchOrders = branchOrders;
  const filteredMarketerOrders = marketerOrders;

  // Calculate stats
  const stats = useMemo(() => {
    // Calculate Branch Sales properly - group StoreHub by invoice using transaction_total
    const calculateBranchSales = () => {
      const invoiceTotals = new Map<string, number>();

      filteredBranchOrders.forEach((o: any) => {
        if (o.platform === "StoreHub") {
          // StoreHub: use transaction_total grouped by invoice
          const invoiceNumber = o.storehub_invoice || o.id;
          if (o.transaction_total && !invoiceTotals.has(invoiceNumber)) {
            invoiceTotals.set(invoiceNumber, Number(o.transaction_total) || 0);
          } else if (!o.transaction_total) {
            const current = invoiceTotals.get(invoiceNumber) || 0;
            invoiceTotals.set(invoiceNumber, current + (Number(o.total_price) || 0));
          }
        } else {
          // Non-StoreHub: use total_price
          invoiceTotals.set(o.id, Number(o.total_price) || 0);
        }
      });

      return Array.from(invoiceTotals.values()).reduce((sum, v) => sum + v, 0);
    };

    // Total Sales (Branch + Marketer)
    const branchSales = calculateBranchSales();
    const marketerSales = filteredMarketerOrders.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const totalSales = branchSales + marketerSales;

    // Total Units (Branch + Marketer) - count all orders by date_order (includes Pending, Shipped, Return)
    const branchUnits = filteredBranchOrders
      .reduce((sum: number, o: any) => sum + (Number(o.quantity) || 0), 0);
    const marketerUnits = filteredMarketerOrders
      .reduce((sum: number, o: any) => sum + (Number(o.quantity) || 0), 0);
    const totalUnits = branchUnits + marketerUnits;

    // Total Marketer count
    const totalMarketer = marketers.length;

    // Ninja COD and Cash - separate for Branch (HQ) and Marketer with pending counts
    const branchCODOrders = filteredBranchOrders.filter((o: any) => o.payment_method === "COD");
    const branchCashOrders = filteredBranchOrders.filter((o: any) => o.payment_method === "Cash");
    const marketerCODOrders = filteredMarketerOrders.filter((o: any) => o.payment_method === "COD");
    const marketerCashOrders = filteredMarketerOrders.filter((o: any) => o.payment_method === "Cash");

    const branchNinjaCOD = branchCODOrders.length;
    const branchNinjaCash = branchCashOrders.length;
    const marketerNinjaCOD = marketerCODOrders.length;
    const marketerNinjaCash = marketerCashOrders.length;

    // Pending status counts
    const branchNinjaCODPending = branchCODOrders.filter((o: any) => o.delivery_status === "Pending").length;
    const branchNinjaCashPending = branchCashOrders.filter((o: any) => o.delivery_status === "Pending").length;
    const marketerNinjaCODPending = marketerCODOrders.filter((o: any) => o.delivery_status === "Pending").length;
    const marketerNinjaCashPending = marketerCashOrders.filter((o: any) => o.delivery_status === "Pending").length;

    // Total Ninja COD and Cash (combined)
    const totalNinjaCOD = branchNinjaCOD + marketerNinjaCOD;
    const totalNinjaCash = branchNinjaCash + marketerNinjaCash;
    const totalNinjaCODPending = branchNinjaCODPending + marketerNinjaCODPending;
    const totalNinjaCashPending = branchNinjaCashPending + marketerNinjaCashPending;

    // Branch Sales by Platform
    // StoreHub uses transaction_total (grouped by invoice), others use total_price
    const branchByPlatform = (platform: string) => {
      const orders = filteredBranchOrders.filter((o: any) => o.platform === platform);
      const units = orders.reduce((sum: number, o: any) => sum + (Number(o.quantity) || 0), 0);

      // For StoreHub, group by invoice and use transaction_total
      if (platform === "StoreHub") {
        const invoiceTotals = new Map<string, number>();
        orders.forEach((o: any) => {
          const invoiceNumber = o.storehub_invoice || o.id;
          if (o.transaction_total && !invoiceTotals.has(invoiceNumber)) {
            invoiceTotals.set(invoiceNumber, Number(o.transaction_total) || 0);
          } else if (!o.transaction_total) {
            // Fallback for old data without transaction_total
            const current = invoiceTotals.get(invoiceNumber) || 0;
            invoiceTotals.set(invoiceNumber, current + (Number(o.total_price) || 0));
          }
        });
        const sales = Array.from(invoiceTotals.values()).reduce((sum, v) => sum + v, 0);
        const customerIds = new Set(orders.map((o: any) => o.customer_id));
        return { sales, customers: customerIds.size, units };
      }

      const sales = orders.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
      const customerIds = new Set(orders.map((o: any) => o.customer_id));
      return { sales, customers: customerIds.size, units };
    };

    const branchStorehub = branchByPlatform("StoreHub");
    const branchTiktok = branchByPlatform("Tiktok HQ");
    const branchShopee = branchByPlatform("Shopee HQ");

    // Online = Facebook + Database + Google combined
    const branchFacebook = branchByPlatform("Facebook");
    const branchDatabase = branchByPlatform("Database");
    const branchGoogle = branchByPlatform("Google");
    const branchOnline = {
      sales: branchFacebook.sales + branchDatabase.sales + branchGoogle.sales,
      customers: branchFacebook.customers + branchDatabase.customers + branchGoogle.customers,
      units: branchFacebook.units + branchDatabase.units + branchGoogle.units,
    };

    // Total Branch Customers
    const branchCustomerIds = new Set(filteredBranchOrders.map((o: any) => o.customer_id));
    const totalBranchCustomers = branchCustomerIds.size;

    // Marketer Sales by Platform (jenis_platform)
    const marketerByPlatform = (platform: string) => {
      const orders = filteredMarketerOrders.filter((o: any) => o.jenis_platform === platform);
      const sales = orders.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
      const units = orders.reduce((sum: number, o: any) => sum + (Number(o.quantity) || 0), 0);
      const customerIds = new Set(orders.map((o: any) => o.customer_id));
      return { sales, customers: customerIds.size, units };
    };

    const marketerFB = marketerByPlatform("Facebook");
    const marketerDatabase = marketerByPlatform("Database");
    const marketerShopee = marketerByPlatform("Shopee");
    const marketerTiktok = marketerByPlatform("Tiktok");

    // Total Marketer Customers
    const marketerCustomerIds = new Set(filteredMarketerOrders.map((o: any) => o.customer_id));
    const totalMarketerCustomers = marketerCustomerIds.size;

    // Calculate percentages
    const branchStorehubPct = branchSales > 0 ? (branchStorehub.sales / branchSales) * 100 : 0;
    const branchTiktokPct = branchSales > 0 ? (branchTiktok.sales / branchSales) * 100 : 0;
    const branchShopeePct = branchSales > 0 ? (branchShopee.sales / branchSales) * 100 : 0;
    const branchOnlinePct = branchSales > 0 ? (branchOnline.sales / branchSales) * 100 : 0;

    const marketerFBPct = marketerSales > 0 ? (marketerFB.sales / marketerSales) * 100 : 0;
    const marketerDatabasePct = marketerSales > 0 ? (marketerDatabase.sales / marketerSales) * 100 : 0;
    const marketerShopeePct = marketerSales > 0 ? (marketerShopee.sales / marketerSales) * 100 : 0;
    const marketerTiktokPct = marketerSales > 0 ? (marketerTiktok.sales / marketerSales) * 100 : 0;

    return {
      totalSales,
      branchSales,
      marketerSales,
      totalUnits,
      branchUnits,
      marketerUnits,
      totalMarketer,
      totalNinjaCOD,
      totalNinjaCash,
      totalNinjaCODPending,
      totalNinjaCashPending,
      branchNinjaCOD,
      branchNinjaCash,
      branchNinjaCODPending,
      branchNinjaCashPending,
      marketerNinjaCOD,
      marketerNinjaCash,
      marketerNinjaCODPending,
      marketerNinjaCashPending,
      totalBranchCustomers,
      branchStorehub: { ...branchStorehub, pct: branchStorehubPct },
      branchTiktok: { ...branchTiktok, pct: branchTiktokPct },
      branchShopee: { ...branchShopee, pct: branchShopeePct },
      branchOnline: { ...branchOnline, pct: branchOnlinePct },
      totalMarketerCustomers,
      marketerFB: { ...marketerFB, pct: marketerFBPct },
      marketerDatabase: { ...marketerDatabase, pct: marketerDatabasePct },
      marketerShopee: { ...marketerShopee, pct: marketerShopeePct },
      marketerTiktok: { ...marketerTiktok, pct: marketerTiktokPct },
    };
  }, [filteredBranchOrders, filteredMarketerOrders, marketers]);

  const formatCurrency = (value: number) => {
    return `RM ${value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const isLoading = branchOrdersLoading || marketersLoading || marketerOrdersLoading;

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
        <h1 className="text-2xl font-bold text-primary">
          Welcome back, {userName}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Your branch performance dashboard
        </p>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-5 h-5" />
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

      {/* Main Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Sales */}
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm font-medium">TOTAL SALES</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(stats.totalSales)}</p>
            <p className="text-xs text-muted-foreground mt-1">Branch + Marketer</p>
          </CardContent>
        </Card>

        {/* Total Units */}
        <Card className="border-l-4 border-l-cyan-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-cyan-600 mb-2">
              <Boxes className="w-5 h-5" />
              <span className="text-sm font-medium">TOTAL UNITS</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalUnits.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Branch + Marketer</p>
          </CardContent>
        </Card>

        {/* Total Marketer */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Users className="w-5 h-5" />
              <span className="text-sm font-medium">TOTAL MARKETER</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalMarketer}</p>
            <p className="text-xs text-muted-foreground mt-1">Active marketers</p>
          </CardContent>
        </Card>

        {/* Ninja COD */}
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-orange-600 mb-2">
              <Package className="w-5 h-5" />
              <span className="text-sm font-medium">NINJA COD</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalNinjaCOD}</p>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-yellow-600 font-medium">{stats.totalNinjaCODPending} pending</span>
            </p>
          </CardContent>
        </Card>

        {/* Ninja Cash */}
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
              <ShoppingCart className="w-5 h-5" />
              <span className="text-sm font-medium">NINJA CASH</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalNinjaCash}</p>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-yellow-600 font-medium">{stats.totalNinjaCashPending} pending</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Branch Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold">Sales Branch</h2>
          <span className="text-sm text-muted-foreground">({formatCurrency(stats.branchSales)})</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
          {/* Total Customer Branch */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <Users className="w-5 h-5" />
                <span className="text-sm font-medium">TOTAL CUSTOMER</span>
              </div>
              <p className="text-2xl font-bold">{stats.totalBranchCustomers}</p>
              <p className="text-xs text-muted-foreground mt-1">Branch customers</p>
            </CardContent>
          </Card>

          {/* Branch Ninja COD */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-orange-600 mb-2">
                <Package className="w-5 h-5" />
                <span className="text-sm font-medium">NINJA COD</span>
              </div>
              <p className="text-2xl font-bold">{stats.branchNinjaCOD}</p>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-yellow-600 font-medium">{stats.branchNinjaCODPending} pending</span>
              </p>
            </CardContent>
          </Card>

          {/* Branch Ninja Cash */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <ShoppingCart className="w-5 h-5" />
                <span className="text-sm font-medium">NINJA CASH</span>
              </div>
              <p className="text-2xl font-bold">{stats.branchNinjaCash}</p>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-yellow-600 font-medium">{stats.branchNinjaCashPending} pending</span>
              </p>
            </CardContent>
          </Card>

          {/* Sales Storehub */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-teal-600 mb-2">
                <Store className="w-5 h-5" />
                <span className="text-sm font-medium">STOREHUB</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(stats.branchStorehub.sales)}</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground">{stats.branchStorehub.customers}</span> customers | <span className="text-cyan-600 font-medium">{stats.branchStorehub.units}</span> units
                </p>
                <p className="text-xs text-muted-foreground">{formatPercent(stats.branchStorehub.pct)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Sales Tiktok */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-pink-600 mb-2">
                <Play className="w-5 h-5" />
                <span className="text-sm font-medium">TIKTOK</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(stats.branchTiktok.sales)}</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground">{stats.branchTiktok.customers}</span> customers | <span className="text-cyan-600 font-medium">{stats.branchTiktok.units}</span> units
                </p>
                <p className="text-xs text-muted-foreground">{formatPercent(stats.branchTiktok.pct)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Sales Shopee */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-orange-600 mb-2">
                <ShoppingBag className="w-5 h-5" />
                <span className="text-sm font-medium">SHOPEE</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(stats.branchShopee.sales)}</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground">{stats.branchShopee.customers}</span> customers | <span className="text-cyan-600 font-medium">{stats.branchShopee.units}</span> units
                </p>
                <p className="text-xs text-muted-foreground">{formatPercent(stats.branchShopee.pct)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Sales Online */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sky-600 mb-2">
                <Globe className="w-5 h-5" />
                <span className="text-sm font-medium">ONLINE</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(stats.branchOnline.sales)}</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground">{stats.branchOnline.customers}</span> customers | <span className="text-cyan-600 font-medium">{stats.branchOnline.units}</span> units
                </p>
                <p className="text-xs text-muted-foreground">{formatPercent(stats.branchOnline.pct)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sales Marketer Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Sales Marketer</h2>
          <span className="text-sm text-muted-foreground">({formatCurrency(stats.marketerSales)})</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
          {/* Total Customer Marketer */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <Users className="w-5 h-5" />
                <span className="text-sm font-medium">TOTAL CUSTOMER</span>
              </div>
              <p className="text-2xl font-bold">{stats.totalMarketerCustomers}</p>
              <p className="text-xs text-muted-foreground mt-1">Marketer customers</p>
            </CardContent>
          </Card>

          {/* Marketer Ninja COD */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-orange-600 mb-2">
                <Package className="w-5 h-5" />
                <span className="text-sm font-medium">NINJA COD</span>
              </div>
              <p className="text-2xl font-bold">{stats.marketerNinjaCOD}</p>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-yellow-600 font-medium">{stats.marketerNinjaCODPending} pending</span>
              </p>
            </CardContent>
          </Card>

          {/* Marketer Ninja Cash */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <ShoppingCart className="w-5 h-5" />
                <span className="text-sm font-medium">NINJA CASH</span>
              </div>
              <p className="text-2xl font-bold">{stats.marketerNinjaCash}</p>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-yellow-600 font-medium">{stats.marketerNinjaCashPending} pending</span>
              </p>
            </CardContent>
          </Card>

          {/* Sales FB */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <Facebook className="w-5 h-5" />
                <span className="text-sm font-medium">FACEBOOK</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(stats.marketerFB.sales)}</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground">{stats.marketerFB.customers}</span> customers | <span className="text-cyan-600 font-medium">{stats.marketerFB.units}</span> units
                </p>
                <p className="text-xs text-muted-foreground">{formatPercent(stats.marketerFB.pct)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Sales Database */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <Database className="w-5 h-5" />
                <span className="text-sm font-medium">DATABASE</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(stats.marketerDatabase.sales)}</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground">{stats.marketerDatabase.customers}</span> customers | <span className="text-cyan-600 font-medium">{stats.marketerDatabase.units}</span> units
                </p>
                <p className="text-xs text-muted-foreground">{formatPercent(stats.marketerDatabase.pct)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Sales Shopee */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-orange-600 mb-2">
                <ShoppingBag className="w-5 h-5" />
                <span className="text-sm font-medium">SHOPEE</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(stats.marketerShopee.sales)}</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground">{stats.marketerShopee.customers}</span> customers | <span className="text-cyan-600 font-medium">{stats.marketerShopee.units}</span> units
                </p>
                <p className="text-xs text-muted-foreground">{formatPercent(stats.marketerShopee.pct)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Sales Tiktok */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-pink-600 mb-2">
                <Play className="w-5 h-5" />
                <span className="text-sm font-medium">TIKTOK</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(stats.marketerTiktok.sales)}</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground">{stats.marketerTiktok.customers}</span> customers | <span className="text-cyan-600 font-medium">{stats.marketerTiktok.units}</span> units
                </p>
                <p className="text-xs text-muted-foreground">{formatPercent(stats.marketerTiktok.pct)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BranchDashboardView;
