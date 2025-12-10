import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Calendar,
  DollarSign,
  RotateCcw,
  Wallet,
  BarChart3,
  Facebook,
  Database,
  ShoppingBag,
  Play,
  Search as SearchIcon,
  Users,
  UserPlus,
  UserCheck,
  Phone,
  Target,
  Percent,
  ClipboardList,
  Globe,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { useState, useMemo } from "react";

const MarketerStats = () => {
  const { userProfile } = useAuth();
  const userIdStaff = userProfile?.idstaff;

  // Date filter - default to current month
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));

  // Fetch orders for this marketer
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["marketer-orders", userIdStaff],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_purchases")
        .select("*")
        .eq("marketer_id_staff", userIdStaff)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userIdStaff,
  });

  // Fetch spends for this marketer
  const { data: spends = [], isLoading: spendsLoading } = useQuery({
    queryKey: ["marketer-spends", userIdStaff],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spends")
        .select("*")
        .eq("marketer_id_staff", userIdStaff);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userIdStaff,
  });

  // Fetch prospects for this marketer
  const { data: prospects = [], isLoading: prospectsLoading } = useQuery({
    queryKey: ["marketer-prospects", userIdStaff],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .eq("marketer_id_staff", userIdStaff);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userIdStaff,
  });

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    return orders.filter((order: any) => {
      const orderDate = order.date_order || order.created_at?.split("T")[0];
      if (!orderDate) return false;
      try {
        const date = parseISO(orderDate);
        return isWithinInterval(date, {
          start: parseISO(startDate),
          end: parseISO(endDate),
        });
      } catch {
        return false;
      }
    });
  }, [orders, startDate, endDate]);

  // Filter spends by date range
  const filteredSpends = useMemo(() => {
    return spends.filter((spend: any) => {
      if (!spend.tarikh_spend) return false;
      try {
        const date = parseISO(spend.tarikh_spend);
        return isWithinInterval(date, {
          start: parseISO(startDate),
          end: parseISO(endDate),
        });
      } catch {
        return false;
      }
    });
  }, [spends, startDate, endDate]);

  // Filter prospects by date range
  const filteredProspects = useMemo(() => {
    return prospects.filter((prospect: any) => {
      if (!prospect.tarikh_phone_number) return false;
      try {
        const date = parseISO(prospect.tarikh_phone_number);
        return isWithinInterval(date, {
          start: parseISO(startDate),
          end: parseISO(endDate),
        });
      } catch {
        return false;
      }
    });
  }, [prospects, startDate, endDate]);

  // Calculate stats
  const stats = useMemo(() => {
    // Total Sales
    const totalSales = filteredOrders.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);

    // Return (only orders with delivery_status = 'Return')
    const returnOrders = filteredOrders.filter((o: any) => o.delivery_status === "Return");
    const totalReturn = returnOrders.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);

    // Total Spend
    const totalSpend = filteredSpends.reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0);

    // ROAS (Return on Ad Spend) = Total Sales / Total Spend
    const roas = totalSpend > 0 ? totalSales / totalSpend : 0;

    // Sales by Platform
    const salesFB = filteredOrders.filter((o: any) => o.jenis_platform === "Facebook").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesDatabase = filteredOrders.filter((o: any) => o.jenis_platform === "Database").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesShopee = filteredOrders.filter((o: any) => o.jenis_platform === "Shopee").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesTiktok = filteredOrders.filter((o: any) => o.jenis_platform === "Tiktok").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesGoogle = filteredOrders.filter((o: any) => o.jenis_platform === "Google").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);

    // Closing breakdown per platform (with percentages)
    const getClosingByPlatform = (platform: string, platformTotal: number) => {
      const platformOrders = filteredOrders.filter((o: any) => o.jenis_platform === platform);
      const manual = platformOrders.filter((o: any) => o.jenis_closing === "Manual").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
      const waBot = platformOrders.filter((o: any) => o.jenis_closing === "WhatsappBot").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
      const website = platformOrders.filter((o: any) => o.jenis_closing === "Website").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
      const call = platformOrders.filter((o: any) => o.jenis_closing === "Call").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
      const live = platformOrders.filter((o: any) => o.jenis_closing === "Live").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
      const shop = platformOrders.filter((o: any) => o.jenis_closing === "Shop").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
      return {
        manual, manualPct: platformTotal > 0 ? (manual / platformTotal) * 100 : 0,
        waBot, waBotPct: platformTotal > 0 ? (waBot / platformTotal) * 100 : 0,
        website, websitePct: platformTotal > 0 ? (website / platformTotal) * 100 : 0,
        call, callPct: platformTotal > 0 ? (call / platformTotal) * 100 : 0,
        live, livePct: platformTotal > 0 ? (live / platformTotal) * 100 : 0,
        shop, shopPct: platformTotal > 0 ? (shop / platformTotal) * 100 : 0,
      };
    };

    // Customer type breakdown per platform (with percentages)
    const getCustomerByPlatform = (platform: string, platformTotal: number) => {
      const platformOrders = filteredOrders.filter((o: any) => o.jenis_platform === platform);
      const np = platformOrders.filter((o: any) => o.jenis_customer === "NP").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
      const ep = platformOrders.filter((o: any) => o.jenis_customer === "EP").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
      const ec = platformOrders.filter((o: any) => o.jenis_customer === "EC").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
      return {
        np, npPct: platformTotal > 0 ? (np / platformTotal) * 100 : 0,
        ep, epPct: platformTotal > 0 ? (ep / platformTotal) * 100 : 0,
        ec, ecPct: platformTotal > 0 ? (ec / platformTotal) * 100 : 0,
      };
    };

    const closingFB = getClosingByPlatform("Facebook", salesFB);
    const closingDatabase = getClosingByPlatform("Database", salesDatabase);
    const closingShopee = getClosingByPlatform("Shopee", salesShopee);
    const closingTiktok = getClosingByPlatform("Tiktok", salesTiktok);
    const closingGoogle = getClosingByPlatform("Google", salesGoogle);

    const customerFB = getCustomerByPlatform("Facebook", salesFB);
    const customerDatabase = getCustomerByPlatform("Database", salesDatabase);
    const customerShopee = getCustomerByPlatform("Shopee", salesShopee);
    const customerTiktok = getCustomerByPlatform("Tiktok", salesTiktok);
    const customerGoogle = getCustomerByPlatform("Google", salesGoogle);

    // Sales by Customer Type
    const salesNP = filteredOrders.filter((o: any) => o.jenis_customer === "NP").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesEP = filteredOrders.filter((o: any) => o.jenis_customer === "EP").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesEC = filteredOrders.filter((o: any) => o.jenis_customer === "EC").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);

    // Sales by Jenis Closing
    const salesManual = filteredOrders.filter((o: any) => o.jenis_closing === "Manual").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesWhatsappBot = filteredOrders.filter((o: any) => o.jenis_closing === "WhatsappBot").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesWebsite = filteredOrders.filter((o: any) => o.jenis_closing === "Website").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesCall = filteredOrders.filter((o: any) => o.jenis_closing === "Call").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesLive = filteredOrders.filter((o: any) => o.jenis_closing === "Live").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesShop = filteredOrders.filter((o: any) => o.jenis_closing === "Shop").reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);

    // Total Lead
    const totalLead = filteredProspects.length;
    const totalLeadNP = filteredProspects.filter((p: any) => p.jenis_prospek === "NP").length;
    const totalLeadEP = filteredProspects.filter((p: any) => p.jenis_prospek === "EP").length;

    // Closed leads (prospects with status_closed not empty)
    const closedLeads = filteredProspects.filter((p: any) => p.status_closed && p.status_closed.trim() !== "").length;

    // Average KPK (Kos Per Lead) = Total Spend / Total Lead
    const averageKPK = totalLead > 0 ? totalSpend / totalLead : 0;

    // Closing Rate Lead = Closed Leads / Total Lead * 100
    const closingRate = totalLead > 0 ? (closedLeads / totalLead) * 100 : 0;

    // Calculate percentages (based on total sales as reference)
    const returnPercent = totalSales > 0 ? (totalReturn / totalSales) * 100 : 0;
    const fbPercent = totalSales > 0 ? (salesFB / totalSales) * 100 : 0;
    const dbPercent = totalSales > 0 ? (salesDatabase / totalSales) * 100 : 0;
    const shopeePercent = totalSales > 0 ? (salesShopee / totalSales) * 100 : 0;
    const tiktokPercent = totalSales > 0 ? (salesTiktok / totalSales) * 100 : 0;
    const googlePercent = totalSales > 0 ? (salesGoogle / totalSales) * 100 : 0;
    const npPercent = totalSales > 0 ? (salesNP / totalSales) * 100 : 0;
    const epPercent = totalSales > 0 ? (salesEP / totalSales) * 100 : 0;
    const ecPercent = totalSales > 0 ? (salesEC / totalSales) * 100 : 0;
    const manualPercent = totalSales > 0 ? (salesManual / totalSales) * 100 : 0;
    const whatsappBotPercent = totalSales > 0 ? (salesWhatsappBot / totalSales) * 100 : 0;
    const websitePercent = totalSales > 0 ? (salesWebsite / totalSales) * 100 : 0;
    const callPercent = totalSales > 0 ? (salesCall / totalSales) * 100 : 0;
    const livePercent = totalSales > 0 ? (salesLive / totalSales) * 100 : 0;
    const shopPercent = totalSales > 0 ? (salesShop / totalSales) * 100 : 0;

    return {
      totalSales,
      totalReturn,
      returnPercent,
      totalSpend,
      roas,
      salesFB,
      fbPercent,
      salesDatabase,
      dbPercent,
      salesShopee,
      shopeePercent,
      salesTiktok,
      tiktokPercent,
      salesGoogle,
      googlePercent,
      closingFB,
      closingDatabase,
      closingShopee,
      closingTiktok,
      closingGoogle,
      customerFB,
      customerDatabase,
      customerShopee,
      customerTiktok,
      customerGoogle,
      salesNP,
      npPercent,
      salesEP,
      epPercent,
      salesEC,
      ecPercent,
      salesManual,
      manualPercent,
      salesWhatsappBot,
      whatsappBotPercent,
      salesWebsite,
      websitePercent,
      salesCall,
      callPercent,
      salesLive,
      livePercent,
      salesShop,
      shopPercent,
      totalLead,
      totalLeadNP,
      totalLeadEP,
      averageKPK,
      closingRate,
    };
  }, [filteredOrders, filteredSpends, filteredProspects]);

  const formatCurrency = (value: number) => {
    return `RM ${value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const isLoading = ordersLoading || spendsLoading || prospectsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">
          Welcome back, {userProfile?.full_name || "Marketer"}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Your performance dashboard
        </p>
      </div>

      {/* Date Filter */}
      <div className="bg-card rounded-lg border p-4">
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
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="bg-card rounded-lg border p-4 border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 text-green-500 mb-2">
            <DollarSign className="w-5 h-5" />
            <span className="text-sm font-medium">TOTAL SALES</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalSales)}</p>
          <p className="text-xs text-muted-foreground mt-1">100%</p>
        </div>

        {/* Return */}
        <div className="bg-card rounded-lg border p-4 border-l-4 border-l-red-500">
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <RotateCcw className="w-5 h-5" />
            <span className="text-sm font-medium">RETURN</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalReturn)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatPercent(stats.returnPercent)}</p>
        </div>

        {/* Total Spend */}
        <div className="bg-card rounded-lg border p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-2 text-amber-500 mb-2">
            <Wallet className="w-5 h-5" />
            <span className="text-sm font-medium">TOTAL SPEND</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalSpend)}</p>
          <p className="text-xs text-muted-foreground mt-1">Ad Budget</p>
        </div>

        {/* ROAS */}
        <div className="bg-card rounded-lg border p-4 border-l-4 border-l-primary">
          <div className="flex items-center gap-2 text-primary mb-2">
            <BarChart3 className="w-5 h-5" />
            <span className="text-sm font-medium">ROAS</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.roas.toFixed(2)}x</p>
          <p className="text-xs text-muted-foreground mt-1">Return on Ad Spend</p>
        </div>
      </div>

      {/* Platform Sales Row with Closing Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Sales FB */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Facebook className="w-5 h-5" />
            <span className="text-sm font-medium">SALES FB</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.salesFB)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatPercent(stats.fbPercent)}</p>
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            <p className="text-xs"><span className="text-slate-600">Manual:</span> {formatCurrency(stats.closingFB.manual)} <span className="text-muted-foreground">({formatPercent(stats.closingFB.manualPct)})</span></p>
            <p className="text-xs"><span className="text-green-600">WA Bot:</span> {formatCurrency(stats.closingFB.waBot)} <span className="text-muted-foreground">({formatPercent(stats.closingFB.waBotPct)})</span></p>
            <p className="text-xs"><span className="text-violet-600">Website:</span> {formatCurrency(stats.closingFB.website)} <span className="text-muted-foreground">({formatPercent(stats.closingFB.websitePct)})</span></p>
            <p className="text-xs"><span className="text-sky-600">Call:</span> {formatCurrency(stats.closingFB.call)} <span className="text-muted-foreground">({formatPercent(stats.closingFB.callPct)})</span></p>
          </div>
          <div className="mt-2 pt-2 border-t border-border space-y-1">
            <p className="text-xs"><span className="text-cyan-600">NP:</span> {formatCurrency(stats.customerFB.np)} <span className="text-muted-foreground">({formatPercent(stats.customerFB.npPct)})</span></p>
            <p className="text-xs"><span className="text-emerald-600">EP:</span> {formatCurrency(stats.customerFB.ep)} <span className="text-muted-foreground">({formatPercent(stats.customerFB.epPct)})</span></p>
            <p className="text-xs"><span className="text-amber-600">EC:</span> {formatCurrency(stats.customerFB.ec)} <span className="text-muted-foreground">({formatPercent(stats.customerFB.ecPct)})</span></p>
          </div>
        </div>

        {/* Sales Database */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <Database className="w-5 h-5" />
            <span className="text-sm font-medium">SALES DATABASE</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.salesDatabase)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatPercent(stats.dbPercent)}</p>
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            <p className="text-xs"><span className="text-slate-600">Manual:</span> {formatCurrency(stats.closingDatabase.manual)} <span className="text-muted-foreground">({formatPercent(stats.closingDatabase.manualPct)})</span></p>
            <p className="text-xs"><span className="text-green-600">WA Bot:</span> {formatCurrency(stats.closingDatabase.waBot)} <span className="text-muted-foreground">({formatPercent(stats.closingDatabase.waBotPct)})</span></p>
            <p className="text-xs"><span className="text-violet-600">Website:</span> {formatCurrency(stats.closingDatabase.website)} <span className="text-muted-foreground">({formatPercent(stats.closingDatabase.websitePct)})</span></p>
            <p className="text-xs"><span className="text-sky-600">Call:</span> {formatCurrency(stats.closingDatabase.call)} <span className="text-muted-foreground">({formatPercent(stats.closingDatabase.callPct)})</span></p>
          </div>
          <div className="mt-2 pt-2 border-t border-border space-y-1">
            <p className="text-xs"><span className="text-cyan-600">NP:</span> {formatCurrency(stats.customerDatabase.np)} <span className="text-muted-foreground">({formatPercent(stats.customerDatabase.npPct)})</span></p>
            <p className="text-xs"><span className="text-emerald-600">EP:</span> {formatCurrency(stats.customerDatabase.ep)} <span className="text-muted-foreground">({formatPercent(stats.customerDatabase.epPct)})</span></p>
            <p className="text-xs"><span className="text-amber-600">EC:</span> {formatCurrency(stats.customerDatabase.ec)} <span className="text-muted-foreground">({formatPercent(stats.customerDatabase.ecPct)})</span></p>
          </div>
        </div>

        {/* Sales Shopee */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-orange-600 mb-2">
            <ShoppingBag className="w-5 h-5" />
            <span className="text-sm font-medium">SALES SHOPEE</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.salesShopee)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatPercent(stats.shopeePercent)}</p>
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            <p className="text-xs"><span className="text-slate-600">Manual:</span> {formatCurrency(stats.closingShopee.manual)} <span className="text-muted-foreground">({formatPercent(stats.closingShopee.manualPct)})</span></p>
            <p className="text-xs"><span className="text-green-600">WA Bot:</span> {formatCurrency(stats.closingShopee.waBot)} <span className="text-muted-foreground">({formatPercent(stats.closingShopee.waBotPct)})</span></p>
            <p className="text-xs"><span className="text-violet-600">Website:</span> {formatCurrency(stats.closingShopee.website)} <span className="text-muted-foreground">({formatPercent(stats.closingShopee.websitePct)})</span></p>
            <p className="text-xs"><span className="text-sky-600">Call:</span> {formatCurrency(stats.closingShopee.call)} <span className="text-muted-foreground">({formatPercent(stats.closingShopee.callPct)})</span></p>
            <p className="text-xs"><span className="text-rose-600">Live:</span> {formatCurrency(stats.closingShopee.live)} <span className="text-muted-foreground">({formatPercent(stats.closingShopee.livePct)})</span></p>
            <p className="text-xs"><span className="text-orange-500">Shop:</span> {formatCurrency(stats.closingShopee.shop)} <span className="text-muted-foreground">({formatPercent(stats.closingShopee.shopPct)})</span></p>
          </div>
          <div className="mt-2 pt-2 border-t border-border space-y-1">
            <p className="text-xs"><span className="text-cyan-600">NP:</span> {formatCurrency(stats.customerShopee.np)} <span className="text-muted-foreground">({formatPercent(stats.customerShopee.npPct)})</span></p>
            <p className="text-xs"><span className="text-emerald-600">EP:</span> {formatCurrency(stats.customerShopee.ep)} <span className="text-muted-foreground">({formatPercent(stats.customerShopee.epPct)})</span></p>
            <p className="text-xs"><span className="text-amber-600">EC:</span> {formatCurrency(stats.customerShopee.ec)} <span className="text-muted-foreground">({formatPercent(stats.customerShopee.ecPct)})</span></p>
          </div>
        </div>

        {/* Sales TikTok */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-pink-600 mb-2">
            <Play className="w-5 h-5" />
            <span className="text-sm font-medium">SALES TIKTOK</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.salesTiktok)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatPercent(stats.tiktokPercent)}</p>
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            <p className="text-xs"><span className="text-slate-600">Manual:</span> {formatCurrency(stats.closingTiktok.manual)} <span className="text-muted-foreground">({formatPercent(stats.closingTiktok.manualPct)})</span></p>
            <p className="text-xs"><span className="text-green-600">WA Bot:</span> {formatCurrency(stats.closingTiktok.waBot)} <span className="text-muted-foreground">({formatPercent(stats.closingTiktok.waBotPct)})</span></p>
            <p className="text-xs"><span className="text-violet-600">Website:</span> {formatCurrency(stats.closingTiktok.website)} <span className="text-muted-foreground">({formatPercent(stats.closingTiktok.websitePct)})</span></p>
            <p className="text-xs"><span className="text-sky-600">Call:</span> {formatCurrency(stats.closingTiktok.call)} <span className="text-muted-foreground">({formatPercent(stats.closingTiktok.callPct)})</span></p>
            <p className="text-xs"><span className="text-rose-600">Live:</span> {formatCurrency(stats.closingTiktok.live)} <span className="text-muted-foreground">({formatPercent(stats.closingTiktok.livePct)})</span></p>
            <p className="text-xs"><span className="text-orange-500">Shop:</span> {formatCurrency(stats.closingTiktok.shop)} <span className="text-muted-foreground">({formatPercent(stats.closingTiktok.shopPct)})</span></p>
          </div>
          <div className="mt-2 pt-2 border-t border-border space-y-1">
            <p className="text-xs"><span className="text-cyan-600">NP:</span> {formatCurrency(stats.customerTiktok.np)} <span className="text-muted-foreground">({formatPercent(stats.customerTiktok.npPct)})</span></p>
            <p className="text-xs"><span className="text-emerald-600">EP:</span> {formatCurrency(stats.customerTiktok.ep)} <span className="text-muted-foreground">({formatPercent(stats.customerTiktok.epPct)})</span></p>
            <p className="text-xs"><span className="text-amber-600">EC:</span> {formatCurrency(stats.customerTiktok.ec)} <span className="text-muted-foreground">({formatPercent(stats.customerTiktok.ecPct)})</span></p>
          </div>
        </div>

        {/* Sales Google */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <SearchIcon className="w-5 h-5" />
            <span className="text-sm font-medium">SALES GOOGLE</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.salesGoogle)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatPercent(stats.googlePercent)}</p>
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            <p className="text-xs"><span className="text-slate-600">Manual:</span> {formatCurrency(stats.closingGoogle.manual)} <span className="text-muted-foreground">({formatPercent(stats.closingGoogle.manualPct)})</span></p>
            <p className="text-xs"><span className="text-green-600">WA Bot:</span> {formatCurrency(stats.closingGoogle.waBot)} <span className="text-muted-foreground">({formatPercent(stats.closingGoogle.waBotPct)})</span></p>
            <p className="text-xs"><span className="text-violet-600">Website:</span> {formatCurrency(stats.closingGoogle.website)} <span className="text-muted-foreground">({formatPercent(stats.closingGoogle.websitePct)})</span></p>
            <p className="text-xs"><span className="text-sky-600">Call:</span> {formatCurrency(stats.closingGoogle.call)} <span className="text-muted-foreground">({formatPercent(stats.closingGoogle.callPct)})</span></p>
          </div>
          <div className="mt-2 pt-2 border-t border-border space-y-1">
            <p className="text-xs"><span className="text-cyan-600">NP:</span> {formatCurrency(stats.customerGoogle.np)} <span className="text-muted-foreground">({formatPercent(stats.customerGoogle.npPct)})</span></p>
            <p className="text-xs"><span className="text-emerald-600">EP:</span> {formatCurrency(stats.customerGoogle.ep)} <span className="text-muted-foreground">({formatPercent(stats.customerGoogle.epPct)})</span></p>
            <p className="text-xs"><span className="text-amber-600">EC:</span> {formatCurrency(stats.customerGoogle.ec)} <span className="text-muted-foreground">({formatPercent(stats.customerGoogle.ecPct)})</span></p>
          </div>
        </div>
      </div>

      {/* Closing Summary Row (All Platforms) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {/* Closing Manual */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-slate-600 mb-2">
            <ClipboardList className="w-5 h-5" />
            <span className="text-sm font-medium">CLOSING MANUAL</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.salesManual)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatPercent(stats.manualPercent)}</p>
        </div>

        {/* Closing WA Bot */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <Phone className="w-5 h-5" />
            <span className="text-sm font-medium">CLOSING WA BOT</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.salesWhatsappBot)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatPercent(stats.whatsappBotPercent)}</p>
        </div>

        {/* Closing Website */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-violet-600 mb-2">
            <Globe className="w-5 h-5" />
            <span className="text-sm font-medium">CLOSING WEBSITE</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.salesWebsite)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatPercent(stats.websitePercent)}</p>
        </div>

        {/* Closing Call */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sky-600 mb-2">
            <Phone className="w-5 h-5" />
            <span className="text-sm font-medium">CLOSING CALL</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.salesCall)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatPercent(stats.callPercent)}</p>
        </div>

        {/* Closing Live */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-rose-600 mb-2">
            <Play className="w-5 h-5" />
            <span className="text-sm font-medium">CLOSING LIVE</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.salesLive)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatPercent(stats.livePercent)}</p>
        </div>

        {/* Closing Shop */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-orange-500 mb-2">
            <ShoppingBag className="w-5 h-5" />
            <span className="text-sm font-medium">CLOSING SHOP</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.salesShop)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatPercent(stats.shopPercent)}</p>
        </div>
      </div>

      {/* Customer Type Sales Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Sales NP */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-cyan-600 mb-2">
            <UserPlus className="w-5 h-5" />
            <span className="text-sm font-medium">SALES NP</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.salesNP)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatPercent(stats.npPercent)} - New Prospect</p>
        </div>

        {/* Sales EP */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <Users className="w-5 h-5" />
            <span className="text-sm font-medium">SALES EP</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.salesEP)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatPercent(stats.epPercent)} - Existing Prospect</p>
        </div>

        {/* Sales EC */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <UserCheck className="w-5 h-5" />
            <span className="text-sm font-medium">SALES EC</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.salesEC)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatPercent(stats.ecPercent)} - Existing Customer</p>
        </div>
      </div>

      {/* Lead Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Lead */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <Phone className="w-5 h-5" />
            <span className="text-sm font-medium">TOTAL LEAD</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalLead}</p>
          <p className="text-xs text-muted-foreground mt-1">Prospects in period</p>
        </div>

        {/* Total Lead NP */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <UserPlus className="w-5 h-5" />
            <span className="text-sm font-medium">LEAD NP</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalLeadNP}</p>
          <p className="text-xs text-muted-foreground mt-1">New Prospect</p>
        </div>

        {/* Total Lead EP */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <UserCheck className="w-5 h-5" />
            <span className="text-sm font-medium">LEAD EP</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalLeadEP}</p>
          <p className="text-xs text-muted-foreground mt-1">Existing Prospect</p>
        </div>

        {/* Average KPK */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-teal-600 mb-2">
            <Target className="w-5 h-5" />
            <span className="text-sm font-medium">AVERAGE KPK</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.averageKPK)}</p>
          <p className="text-xs text-muted-foreground mt-1">Kos Per Lead</p>
        </div>

        {/* Closing Rate Lead */}
        <div className="bg-primary rounded-lg border p-4">
          <div className="flex items-center gap-2 text-white/80 mb-2">
            <Percent className="w-5 h-5" />
            <span className="text-sm font-medium">CLOSING RATE</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatPercent(stats.closingRate)}</p>
          <p className="text-xs text-white/60 mt-1">Lead Conversion</p>
        </div>
      </div>
    </div>
  );
};

export default MarketerStats;
