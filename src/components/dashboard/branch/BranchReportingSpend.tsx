import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  Users,
  TrendingUp,
  Target,
  RotateCcw,
  BarChart3,
  Percent,
  Loader2,
  Facebook,
  Video,
  ShoppingBag,
  Database,
  Globe,
  ClipboardList,
  Phone,
  Play,
  Store,
} from "lucide-react";

interface AggregatedSpend {
  product: string;
  platform: string;
  jenisClosing: string;
  totalSpend: number;
  totalSales: number;
  totalLeads: number;
  leadsClose: number;
  leadsNotClose: number;
  kpk: string;
  roas: string;
  closingRate: string;
}

const BranchReportingSpend = () => {
  const { user } = useAuth();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Fetch branch spends (only branch's own, not marketer spends)
  const { data: spends = [], isLoading: spendsLoading } = useQuery({
    queryKey: ["branch-reporting-spends", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spends")
        .select("*")
        .eq("branch_id", user?.id)
        .is("marketer_id_staff", null) // Only branch's own spends
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch prospects for this branch
  const { data: prospects = [], isLoading: prospectsLoading } = useQuery({
    queryKey: ["branch-reporting-prospects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .eq("created_by", user?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch orders (customer purchases where seller is this branch and no marketer)
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["branch-reporting-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_purchases")
        .select("*")
        .eq("seller_id", user?.id)
        .is("marketer_id", null); // Only branch's own sales, not marketer sales
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Filter spends based on date range
  const filteredSpends = useMemo(() => {
    return spends.filter((spend: any) => {
      const spendDate = spend.tarikh_spend;
      const matchesStartDate = !startDate || (spendDate && spendDate >= startDate);
      const matchesEndDate = !endDate || (spendDate && spendDate <= endDate);
      return matchesStartDate && matchesEndDate;
    });
  }, [spends, startDate, endDate]);

  // Filter prospects based on same date range
  const filteredProspects = useMemo(() => {
    return prospects.filter((prospect: any) => {
      const prospectDate = prospect.tarikh_phone_number;
      const matchesStartDate = !startDate || (prospectDate && prospectDate >= startDate);
      const matchesEndDate = !endDate || (prospectDate && prospectDate <= endDate);
      return matchesStartDate && matchesEndDate;
    });
  }, [prospects, startDate, endDate]);

  // Filter orders based on date range
  const filteredOrders = useMemo(() => {
    return orders.filter((order: any) => {
      const orderDate = order.date_order;
      const matchesStartDate = !startDate || (orderDate && orderDate >= startDate);
      const matchesEndDate = !endDate || (orderDate && orderDate <= endDate);
      return matchesStartDate && matchesEndDate;
    });
  }, [orders, startDate, endDate]);

  // Platform stats with closing breakdown
  const platformStats = useMemo(() => {
    const platforms = ["Facebook", "Tiktok", "Shopee", "Database", "Google"];
    const platformIcons: Record<string, { icon: React.ReactNode; color: string; bgColor: string; headerColor: string }> = {
      Facebook: { icon: <Facebook className="w-5 h-5" />, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800", headerColor: "bg-blue-100 dark:bg-blue-900/50" },
      Tiktok: { icon: <Video className="w-5 h-5" />, color: "text-pink-600 dark:text-pink-400", bgColor: "bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800", headerColor: "bg-pink-100 dark:bg-pink-900/50" },
      Shopee: { icon: <ShoppingBag className="w-5 h-5" />, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800", headerColor: "bg-orange-100 dark:bg-orange-900/50" },
      Database: { icon: <Database className="w-5 h-5" />, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800", headerColor: "bg-purple-100 dark:bg-purple-900/50" },
      Google: { icon: <Globe className="w-5 h-5" />, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800", headerColor: "bg-green-100 dark:bg-green-900/50" },
    };

    return platforms.map((platform) => {
      const platformSpends = filteredSpends.filter((s: any) => s.jenis_platform?.toLowerCase() === platform.toLowerCase());
      const totalSpend = platformSpends.reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0);

      // Match orders by platform field
      const platformOrders = filteredOrders.filter((o: any) => o.platform === platform || o.jenis_platform === platform);
      const totalSales = platformOrders.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);

      const closingBreakdown = {
        website: platformSpends.filter((s: any) => s.jenis_closing === "Website").reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0),
        whatsappBot: platformSpends.filter((s: any) => s.jenis_closing === "WhatsappBot").reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0),
        manual: platformSpends.filter((s: any) => s.jenis_closing === "Manual").reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0),
        call: platformSpends.filter((s: any) => s.jenis_closing === "Call").reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0),
        live: platformSpends.filter((s: any) => s.jenis_closing === "Live").reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0),
        shop: platformSpends.filter((s: any) => s.jenis_closing === "Shop").reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0),
      };

      const closingPct = {
        websitePct: totalSpend > 0 ? (closingBreakdown.website / totalSpend) * 100 : 0,
        whatsappBotPct: totalSpend > 0 ? (closingBreakdown.whatsappBot / totalSpend) * 100 : 0,
        manualPct: totalSpend > 0 ? (closingBreakdown.manual / totalSpend) * 100 : 0,
        callPct: totalSpend > 0 ? (closingBreakdown.call / totalSpend) * 100 : 0,
        livePct: totalSpend > 0 ? (closingBreakdown.live / totalSpend) * 100 : 0,
        shopPct: totalSpend > 0 ? (closingBreakdown.shop / totalSpend) * 100 : 0,
      };

      return {
        platform,
        totalSpend,
        totalSales,
        closingBreakdown,
        closingPct,
        ...platformIcons[platform],
      };
    });
  }, [filteredSpends, filteredOrders]);

  // Closing stats
  const closingStats = useMemo(() => {
    const totalSpend = filteredSpends.reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0);
    return {
      website: filteredSpends.filter((s: any) => s.jenis_closing === "Website").reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0),
      whatsappBot: filteredSpends.filter((s: any) => s.jenis_closing === "WhatsappBot").reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0),
      manual: filteredSpends.filter((s: any) => s.jenis_closing === "Manual").reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0),
      call: filteredSpends.filter((s: any) => s.jenis_closing === "Call").reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0),
      live: filteredSpends.filter((s: any) => s.jenis_closing === "Live").reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0),
      shop: filteredSpends.filter((s: any) => s.jenis_closing === "Shop").reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0),
      totalSpend,
    };
  }, [filteredSpends]);

  // Aggregated data by product + platform + jenis closing
  const aggregatedData = useMemo(() => {
    const dataMap = new Map<string, AggregatedSpend>();

    filteredSpends.forEach((spend: any) => {
      const platform = spend.jenis_platform || "Unknown";
      const jenisClosing = spend.jenis_closing || "Unknown";
      const key = `${spend.product}|${platform}|${jenisClosing}`;

      const existing = dataMap.get(key);
      if (existing) {
        existing.totalSpend += Number(spend.total_spend) || 0;
      } else {
        dataMap.set(key, {
          product: spend.product,
          platform: platform,
          jenisClosing: jenisClosing,
          totalSpend: Number(spend.total_spend) || 0,
          totalSales: 0,
          totalLeads: 0,
          leadsClose: 0,
          leadsNotClose: 0,
          kpk: "0.00",
          roas: "0.00",
          closingRate: "0.00",
        });
      }
    });

    // Distribute sales and leads proportionally
    dataMap.forEach((value) => {
      const totalPlatformSpend = Array.from(dataMap.values())
        .filter((d) => d.product === value.product && d.platform === value.platform)
        .reduce((sum, d) => sum + d.totalSpend, 0);

      const platformOrders = filteredOrders.filter((o: any) => {
        const productMatch = (o.produk || o.storehub_product || "").toLowerCase().includes(value.product.toLowerCase()) ||
                            value.product.toLowerCase().includes((o.produk || o.storehub_product || "").toLowerCase());
        const platformMatch = o.platform === value.platform || o.jenis_platform === value.platform;
        return productMatch && platformMatch;
      });
      const totalPlatformSales = platformOrders.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);

      const spendRatio = totalPlatformSpend > 0 ? value.totalSpend / totalPlatformSpend : 0;
      value.totalSales = totalPlatformSales * spendRatio;

      const matchingProspects = filteredProspects.filter((p: any) => p.niche === value.product);
      const productTotalSpend = Array.from(dataMap.values())
        .filter((d) => d.product === value.product)
        .reduce((sum, d) => sum + d.totalSpend, 0);

      const productSpendRatio = productTotalSpend > 0 ? value.totalSpend / productTotalSpend : 0;
      const distributedLeads = Math.round(matchingProspects.length * productSpendRatio);
      const distributedLeadsClose = Math.round(matchingProspects.filter((p: any) => p.status_closed === "closed").length * productSpendRatio);

      value.totalLeads = distributedLeads;
      value.leadsClose = distributedLeadsClose;
      value.leadsNotClose = distributedLeads - distributedLeadsClose;

      value.kpk = value.totalLeads > 0 ? (value.totalSpend / value.totalLeads).toFixed(2) : "0.00";
      value.roas = value.totalSpend > 0 ? (value.totalSales / value.totalSpend).toFixed(2) : "0.00";
      value.closingRate = value.totalLeads > 0 ? ((value.leadsClose / value.totalLeads) * 100).toFixed(2) : "0.00";
    });

    return Array.from(dataMap.values())
      .filter((d) => d.totalSpend > 0)
      .sort((a, b) => {
        if (a.product !== b.product) return a.product.localeCompare(b.product);
        if (a.platform !== b.platform) return a.platform.localeCompare(b.platform);
        return a.jenisClosing.localeCompare(b.jenisClosing);
      });
  }, [filteredSpends, filteredOrders, filteredProspects]);

  // Overall stats
  const stats = useMemo(() => {
    const totalSpend = filteredSpends.reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0);
    const totalLeads = filteredProspects.length;
    const overallKPK = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : "0.00";
    const leadsClose = filteredProspects.filter((p: any) => p.status_closed === "closed").length;
    const leadsTidakClose = filteredProspects.filter((p: any) => !p.status_closed || p.status_closed !== "closed").length;
    const totalClosedPrice = filteredProspects
      .filter((p: any) => p.status_closed === "closed")
      .reduce((sum: number, p: any) => sum + (Number(p.price_closed) || 0), 0);
    const roas = totalSpend > 0 ? (totalClosedPrice / totalSpend).toFixed(2) : "0.00";
    const closingRate = totalLeads > 0 ? ((leadsClose / totalLeads) * 100).toFixed(2) : "0.00";

    return { totalSpend, totalLeads, overallKPK, leadsClose, leadsTidakClose, roas, closingRate };
  }, [filteredSpends, filteredProspects]);

  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  const isLoading = spendsLoading || prospectsLoading || ordersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Reporting Spend</h1>
          <p className="text-muted-foreground">Branch marketing spend report by product</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span className="text-xs uppercase font-medium">Total Spend</span>
          </div>
          <p className="text-xl font-bold text-foreground">RM {stats.totalSpend.toFixed(2)}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs uppercase font-medium">Total Leads</span>
          </div>
          <p className="text-xl font-bold text-foreground">{stats.totalLeads}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            <span className="text-xs uppercase font-medium">Overall KPK</span>
          </div>
          <p className="text-xl font-bold text-foreground">RM {stats.overallKPK}</p>
        </div>

        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-1">
            <Target className="w-4 h-4" />
            <span className="text-xs uppercase font-medium">Leads Close</span>
          </div>
          <p className="text-xl font-bold text-green-700 dark:text-green-400">{stats.leadsClose}</p>
        </div>

        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-1">
            <Target className="w-4 h-4" />
            <span className="text-xs uppercase font-medium">Leads Tidak Close</span>
          </div>
          <p className="text-xl font-bold text-red-700 dark:text-red-400">{stats.leadsTidakClose}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            <span className="text-xs uppercase font-medium">ROAS</span>
          </div>
          <p className="text-xl font-bold text-foreground">{stats.roas}x</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Percent className="w-4 h-4 text-indigo-500" />
            <span className="text-xs uppercase font-medium">Closing Rate</span>
          </div>
          <p className="text-xl font-bold text-foreground">{stats.closingRate}%</p>
        </div>
      </div>

      {/* Jenis Closing Summary */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Spend By Jenis Closing</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 mb-1">
              <Globe className="w-4 h-4" />
              <span className="text-xs uppercase font-medium">Website</span>
            </div>
            <p className="text-xl font-bold text-violet-700 dark:text-violet-300">RM {closingStats.website.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{closingStats.totalSpend > 0 ? ((closingStats.website / closingStats.totalSpend) * 100).toFixed(1) : 0}%</p>
          </div>
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
              <Phone className="w-4 h-4" />
              <span className="text-xs uppercase font-medium">WA Bot</span>
            </div>
            <p className="text-xl font-bold text-green-700 dark:text-green-300">RM {closingStats.whatsappBot.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{closingStats.totalSpend > 0 ? ((closingStats.whatsappBot / closingStats.totalSpend) * 100).toFixed(1) : 0}%</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-1">
              <ClipboardList className="w-4 h-4" />
              <span className="text-xs uppercase font-medium">Manual</span>
            </div>
            <p className="text-xl font-bold text-slate-700 dark:text-slate-300">RM {closingStats.manual.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{closingStats.totalSpend > 0 ? ((closingStats.manual / closingStats.totalSpend) * 100).toFixed(1) : 0}%</p>
          </div>
          <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 mb-1">
              <Phone className="w-4 h-4" />
              <span className="text-xs uppercase font-medium">Call</span>
            </div>
            <p className="text-xl font-bold text-sky-700 dark:text-sky-300">RM {closingStats.call.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{closingStats.totalSpend > 0 ? ((closingStats.call / closingStats.totalSpend) * 100).toFixed(1) : 0}%</p>
          </div>
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-1">
              <Play className="w-4 h-4" />
              <span className="text-xs uppercase font-medium">Live</span>
            </div>
            <p className="text-xl font-bold text-rose-700 dark:text-rose-300">RM {closingStats.live.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{closingStats.totalSpend > 0 ? ((closingStats.live / closingStats.totalSpend) * 100).toFixed(1) : 0}%</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
              <Store className="w-4 h-4" />
              <span className="text-xs uppercase font-medium">Shop</span>
            </div>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-300">RM {closingStats.shop.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{closingStats.totalSpend > 0 ? ((closingStats.shop / closingStats.totalSpend) * 100).toFixed(1) : 0}%</p>
          </div>
        </div>
      </div>

      {/* Spend By Platform */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Spend By Platform</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {platformStats.map((platform) => (
            <div key={platform.platform} className={`border rounded-lg overflow-hidden ${platform.bgColor}`}>
              {/* Header */}
              <div className={`p-4 ${platform.headerColor}`}>
                <div className={`flex items-center gap-2 mb-2 ${platform.color}`}>
                  {platform.icon}
                  <span className="text-sm font-semibold uppercase">{platform.platform}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Spend:</span>
                    <span className={`text-sm font-bold ${platform.color}`}>RM {platform.totalSpend.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Sales:</span>
                    <span className="text-sm font-bold text-foreground">RM {platform.totalSales.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              {/* Closing Breakdown */}
              <div className="p-3 space-y-2 bg-white/50 dark:bg-black/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Jenis Closing</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-violet-600 dark:text-violet-400">Website</span>
                  <span className="text-xs font-medium">
                    RM {platform.closingBreakdown.website.toFixed(0)} <span className="text-muted-foreground">({platform.closingPct.websitePct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-green-600 dark:text-green-400">WA Bot</span>
                  <span className="text-xs font-medium">
                    RM {platform.closingBreakdown.whatsappBot.toFixed(0)} <span className="text-muted-foreground">({platform.closingPct.whatsappBotPct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Manual</span>
                  <span className="text-xs font-medium">
                    RM {platform.closingBreakdown.manual.toFixed(0)} <span className="text-muted-foreground">({platform.closingPct.manualPct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-sky-600 dark:text-sky-400">Call</span>
                  <span className="text-xs font-medium">
                    RM {platform.closingBreakdown.call.toFixed(0)} <span className="text-muted-foreground">({platform.closingPct.callPct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-rose-600 dark:text-rose-400">Live</span>
                  <span className="text-xs font-medium">
                    RM {platform.closingBreakdown.live.toFixed(0)} <span className="text-muted-foreground">({platform.closingPct.livePct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-amber-600 dark:text-amber-400">Shop</span>
                  <span className="text-xs font-medium">
                    RM {platform.closingBreakdown.shop.toFixed(0)} <span className="text-muted-foreground">({platform.closingPct.shopPct.toFixed(0)}%)</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-muted-foreground mb-1">Start Date</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-background" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-muted-foreground mb-1">End Date</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-background" />
          </div>
          <Button variant="outline" onClick={resetFilters}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Table - Aggregated by Product + Platform + Jenis Closing */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">No</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Jenis Closing</TableHead>
              <TableHead className="text-right">Total Spend</TableHead>
              <TableHead className="text-right">Total Sales</TableHead>
              <TableHead className="text-right">Total Leads</TableHead>
              <TableHead className="text-right">KPK</TableHead>
              <TableHead className="text-right">Leads Close</TableHead>
              <TableHead className="text-right">Leads X Close</TableHead>
              <TableHead className="text-right">ROAS</TableHead>
              <TableHead className="text-right">Closing Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aggregatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  No spend data
                </TableCell>
              </TableRow>
            ) : (
              aggregatedData.map((data, idx) => (
                <TableRow key={`${data.product}-${data.platform}-${data.jenisClosing}`} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{data.product}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        data.platform === "Facebook"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          : data.platform === "Tiktok"
                          ? "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400"
                          : data.platform === "Shopee"
                          ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                          : data.platform === "Database"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                          : data.platform === "Google"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                      }`}
                    >
                      {data.platform}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        data.jenisClosing === "Website"
                          ? "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400"
                          : data.jenisClosing === "WhatsappBot"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : data.jenisClosing === "Manual"
                          ? "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400"
                          : data.jenisClosing === "Call"
                          ? "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400"
                          : data.jenisClosing === "Live"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
                          : data.jenisClosing === "Shop"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                      }`}
                    >
                      {data.jenisClosing === "WhatsappBot" ? "WA Bot" : data.jenisClosing}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">RM {data.totalSpend.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium text-green-600">RM {data.totalSales.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{data.totalLeads}</TableCell>
                  <TableCell className="text-right">RM {data.kpk}</TableCell>
                  <TableCell className="text-right text-green-600">{data.leadsClose}</TableCell>
                  <TableCell className="text-right text-red-600">{data.leadsNotClose}</TableCell>
                  <TableCell className="text-right">{data.roas}x</TableCell>
                  <TableCell className="text-right">{data.closingRate}%</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default BranchReportingSpend;
