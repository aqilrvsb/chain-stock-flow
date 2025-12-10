import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, DollarSign, RotateCcw, TrendingUp, Users, Target, Percent, Package, Facebook, ShoppingBag } from "lucide-react";
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

  // Calculate stats
  const stats = useMemo(() => {
    const totalSales = filteredOrders.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const totalReturn = filteredOrders.filter((o: any) => o.delivery_status === "Return" || o.delivery_status === "Failed").length;
    const totalSpend = filteredSpends.reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0);
    const roas = totalSpend > 0 ? (totalSales / totalSpend).toFixed(2) : "0.00";

    // Sales by platform
    const salesFB = filteredOrders
      .filter((o: any) => o.jenis_platform === "Facebook")
      .reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesShopee = filteredOrders
      .filter((o: any) => o.jenis_platform === "Shopee")
      .reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesTiktok = filteredOrders
      .filter((o: any) => o.jenis_platform === "Tiktok")
      .reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesDatabase = filteredOrders
      .filter((o: any) => o.jenis_platform === "Database")
      .reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesGoogle = filteredOrders
      .filter((o: any) => o.jenis_platform === "Google")
      .reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);

    // Sales by customer type
    const salesNP = filteredOrders
      .filter((o: any) => o.jenis_customer === "NP")
      .reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesEP = filteredOrders
      .filter((o: any) => o.jenis_customer === "EP")
      .reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
    const salesEC = filteredOrders
      .filter((o: any) => o.jenis_customer === "EC")
      .reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);

    // Leads stats
    const totalLead = prospects.length;

    // Units and orders
    const totalUnits = filteredOrders.reduce((sum: number, o: any) => sum + (o.quantity || 0), 0);
    const totalOrders = filteredOrders.length;

    // Average KPK (cost per lead)
    const avgKPK = totalLead > 0 ? (totalSpend / totalLead).toFixed(2) : "0.00";

    // Closing rate
    const closedOrders = filteredOrders.length;
    const closingRate = totalLead > 0 ? ((closedOrders / totalLead) * 100).toFixed(1) : "0.0";

    return {
      totalSales,
      totalReturn,
      totalSpend,
      roas,
      salesFB,
      salesShopee,
      salesTiktok,
      salesDatabase,
      salesGoogle,
      salesNP,
      salesEP,
      salesEC,
      totalLead,
      totalUnits,
      totalOrders,
      avgKPK,
      closingRate,
    };
  }, [filteredOrders, filteredSpends, prospects]);

  const isLoading = ordersLoading || spendsLoading || prospectsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* Main Stats - 4 columns */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-xl font-bold">RM {stats.totalSales.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total Sales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-xl font-bold">{stats.totalReturn}</p>
                <p className="text-xs text-muted-foreground">Total Return</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-xl font-bold">RM {stats.totalSpend.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total Spend</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-xl font-bold">{stats.roas}</p>
                <p className="text-xs text-muted-foreground">ROAS</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales by Platform - 5 columns */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Facebook className="w-6 h-6 text-blue-600" />
              <div>
                <p className="text-lg font-bold">RM {stats.salesFB.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Sales FB</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-purple-500" />
              <div>
                <p className="text-lg font-bold">RM {stats.salesDatabase.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Sales Database</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-6 h-6 text-orange-500" />
              <div>
                <p className="text-lg font-bold">RM {stats.salesShopee.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Sales Shopee</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-black" />
              <div>
                <p className="text-lg font-bold">RM {stats.salesTiktok.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Sales TikTok</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-green-500" />
              <div>
                <p className="text-lg font-bold">RM {stats.salesGoogle.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Sales Google</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales by Customer Type & Leads - 3+4 columns */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-500" />
              <div>
                <p className="text-lg font-bold">RM {stats.salesNP.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Sales NP</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-green-500" />
              <div>
                <p className="text-lg font-bold">RM {stats.salesEP.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Sales EP</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-purple-500" />
              <div>
                <p className="text-lg font-bold">RM {stats.salesEC.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Sales EC</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6 text-orange-500" />
              <div>
                <p className="text-lg font-bold">{stats.totalLead}</p>
                <p className="text-xs text-muted-foreground">Total Lead</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-red-500" />
              <div>
                <p className="text-lg font-bold">RM {stats.avgKPK}</p>
                <p className="text-xs text-muted-foreground">Avg KPK</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Percent className="w-6 h-6 text-green-500" />
              <div>
                <p className="text-lg font-bold">{stats.closingRate}%</p>
                <p className="text-xs text-muted-foreground">Closing Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-blue-500" />
              <div>
                <p className="text-lg font-bold">{stats.totalOrders}</p>
                <p className="text-xs text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MarketerStats;
