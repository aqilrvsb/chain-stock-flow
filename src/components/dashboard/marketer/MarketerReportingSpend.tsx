import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, DollarSign, TrendingUp, BarChart3 } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval, eachDayOfInterval } from "date-fns";

const MarketerReportingSpend = () => {
  const { userProfile } = useAuth();
  const userIdStaff = userProfile?.idstaff;

  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));

  // Fetch orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["marketer-orders-report", userIdStaff, startDate, endDate],
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
    queryKey: ["marketer-spends-report", userIdStaff, startDate, endDate],
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

  // Calculate daily data
  const dailyData = useMemo(() => {
    if (!startDate || !endDate) return [];

    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const days = eachDayOfInterval({ start, end });

    return days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");

      // Orders for this day
      const dayOrders = orders.filter((o: any) => o.date_order === dateStr);
      const sales = dayOrders.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
      const units = dayOrders.reduce((sum: number, o: any) => sum + (o.quantity || 0), 0);

      // Spends for this day
      const daySpends = spends.filter((s: any) => s.tarikh_spend === dateStr);
      const spend = daySpends.reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0);

      // ROAS
      const roas = spend > 0 ? sales / spend : 0;

      return {
        date: dateStr,
        displayDate: format(day, "dd/MM"),
        sales,
        spend,
        units,
        orders: dayOrders.length,
        roas,
      };
    });
  }, [orders, spends, startDate, endDate]);

  // Totals
  const totals = useMemo(() => {
    return dailyData.reduce(
      (acc, day) => ({
        sales: acc.sales + day.sales,
        spend: acc.spend + day.spend,
        units: acc.units + day.units,
        orders: acc.orders + day.orders,
      }),
      { sales: 0, spend: 0, units: 0, orders: 0 }
    );
  }, [dailyData]);

  const overallRoas = totals.spend > 0 ? (totals.sales / totals.spend).toFixed(2) : "0.00";

  const isLoading = ordersLoading || spendsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reporting Spend</h1>
        <p className="text-muted-foreground mt-2">Daily sales vs spend analysis</p>
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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-500" />
              <div>
                <p className="text-lg font-bold">RM {totals.sales.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total Sales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-red-500" />
              <div>
                <p className="text-lg font-bold">RM {totals.spend.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total Spend</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-blue-500" />
              <div>
                <p className="text-lg font-bold">{overallRoas}</p>
                <p className="text-xs text-muted-foreground">Overall ROAS</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-purple-500" />
              <div>
                <p className="text-lg font-bold">{totals.orders}</p>
                <p className="text-xs text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-orange-500" />
              <div>
                <p className="text-lg font-bold">{totals.units}</p>
                <p className="text-xs text-muted-foreground">Total Units</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Sales (RM)</TableHead>
                  <TableHead className="text-right">Spend (RM)</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyData.length > 0 ? (
                  dailyData.map((day) => (
                    <TableRow key={day.date}>
                      <TableCell>{day.displayDate}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {day.sales.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-medium">
                        {day.spend.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            day.roas >= 2
                              ? "text-green-600 font-bold"
                              : day.roas >= 1
                              ? "text-yellow-600"
                              : "text-red-600"
                          }
                        >
                          {day.roas.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{day.orders}</TableCell>
                      <TableCell className="text-right">{day.units}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No data for selected period
                    </TableCell>
                  </TableRow>
                )}
                {/* Totals Row */}
                {dailyData.length > 0 && (
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right text-green-600">
                      {totals.sales.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {totals.spend.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{overallRoas}</TableCell>
                    <TableCell className="text-right">{totals.orders}</TableCell>
                    <TableCell className="text-right">{totals.units}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketerReportingSpend;
