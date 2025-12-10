import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, DollarSign, TrendingUp, Wallet, Calculator } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

const MarketerPNL = () => {
  const { userProfile } = useAuth();
  const userIdStaff = userProfile?.idstaff;
  const branchId = userProfile?.branch_id;

  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));

  // Fetch orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["marketer-pnl-orders", userIdStaff, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("customer_purchases")
        .select("*")
        .eq("marketer_id_staff", userIdStaff);

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
    enabled: !!userIdStaff,
  });

  // Fetch spends
  const { data: spends = [], isLoading: spendsLoading } = useQuery({
    queryKey: ["marketer-pnl-spends", userIdStaff, startDate, endDate],
    queryFn: async () => {
      let query = supabase.from("spends").select("*").eq("marketer_id_staff", userIdStaff);

      if (startDate) {
        query = query.gte("tarikh_spend", startDate);
      }
      if (endDate) {
        query = query.lte("tarikh_spend", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!userIdStaff,
  });

  // Fetch PNL config
  const { data: pnlConfig = [] } = useQuery({
    queryKey: ["pnl-config", branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pnl_config")
        .select("*")
        .eq("branch_id", branchId)
        .eq("role", "marketer")
        .order("min_sales", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!branchId,
  });

  // Calculate PNL
  const pnl = useMemo(() => {
    // Total sales (excluding returns)
    const validOrders = orders.filter(
      (o: any) => o.delivery_status !== "Return" && o.delivery_status !== "Failed"
    );
    const grossSales = validOrders.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);

    // Returns
    const returns = orders
      .filter((o: any) => o.delivery_status === "Return" || o.delivery_status === "Failed")
      .reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);

    // Net sales
    const netSales = grossSales;

    // Total spend
    const totalSpend = spends.reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0);

    // ROAS
    const roas = totalSpend > 0 ? netSales / totalSpend : 0;

    // Find matching PNL tier
    let commissionPercent = 0;
    let bonusAmount = 0;

    for (const tier of pnlConfig) {
      const minSales = Number(tier.min_sales) || 0;
      const maxSales = tier.max_sales ? Number(tier.max_sales) : Infinity;
      const roasMin = Number(tier.roas_min) || 0;
      const roasMax = Number(tier.roas_max) || 99;

      if (netSales >= minSales && netSales <= maxSales && roas >= roasMin && roas <= roasMax) {
        commissionPercent = Number(tier.commission_percent) || 0;
        bonusAmount = Number(tier.bonus_amount) || 0;
        break;
      }
    }

    // Calculate earnings
    const commission = (netSales * commissionPercent) / 100;
    const totalEarnings = commission + bonusAmount;

    // Profit (Sales - Spend - Commission)
    const profit = netSales - totalSpend;

    return {
      grossSales,
      returns,
      netSales,
      totalSpend,
      roas: roas.toFixed(2),
      commissionPercent,
      bonusAmount,
      commission,
      totalEarnings,
      profit,
    };
  }, [orders, spends, pnlConfig]);

  const isLoading = ordersLoading || spendsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">PNL (Profit & Loss)</h1>
        <p className="text-muted-foreground mt-2">Your earnings breakdown</p>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
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
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Sales Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-6 h-6 text-green-500" />
                  <div>
                    <p className="text-lg font-bold">RM {pnl.grossSales.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Gross Sales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-6 h-6 text-red-500" />
                  <div>
                    <p className="text-lg font-bold">RM {pnl.returns.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Returns</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-6 h-6 text-blue-500" />
                  <div>
                    <p className="text-lg font-bold">RM {pnl.netSales.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Net Sales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-purple-500" />
                  <div>
                    <p className="text-lg font-bold">{pnl.roas}</p>
                    <p className="text-xs text-muted-foreground">ROAS</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Spend & Profit */}
          <Card>
            <CardHeader>
              <CardTitle>Spend & Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Spend</p>
                  <p className="text-2xl font-bold text-red-600">RM {pnl.totalSpend.toFixed(2)}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Profit (Sales - Spend)</p>
                  <p className={`text-2xl font-bold ${pnl.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    RM {pnl.profit.toFixed(2)}
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Profit Margin</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {pnl.netSales > 0 ? ((pnl.profit / pnl.netSales) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Earnings */}
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-green-600" />
                Your Earnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Commission Rate</p>
                  <p className="text-3xl font-bold text-green-600">{pnl.commissionPercent}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Based on your ROAS tier</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Commission Amount</p>
                  <p className="text-3xl font-bold text-green-600">RM {pnl.commission.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{pnl.commissionPercent}% of Net Sales</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bonus</p>
                  <p className="text-3xl font-bold text-green-600">RM {pnl.bonusAmount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Fixed bonus amount</p>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Earnings</p>
                    <p className="text-xs text-muted-foreground">(Commission + Bonus)</p>
                  </div>
                  <p className="text-4xl font-bold text-green-700">RM {pnl.totalEarnings.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PNL Config Info */}
          {pnlConfig.length === 0 && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="p-4">
                <p className="text-sm text-yellow-800">
                  PNL commission tiers have not been configured by your branch manager yet.
                  Contact your branch for setup.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default MarketerPNL;
