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
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, Medal, Award } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

const MarketerTop10 = () => {
  const { userProfile } = useAuth();
  const userIdStaff = userProfile?.idstaff;

  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));

  // Fetch all orders grouped by marketer for the branch
  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ["marketer-top10", startDate, endDate, userProfile?.branch_id],
    queryFn: async () => {
      // Get all orders from marketers under the same branch
      let query = supabase
        .from("customer_purchases")
        .select(`
          marketer_id_staff,
          total_price,
          quantity,
          delivery_status,
          date_order
        `)
        .not("marketer_id_staff", "is", null);

      if (startDate) {
        query = query.gte("date_order", startDate);
      }
      if (endDate) {
        query = query.lte("date_order", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Aggregate by marketer
      const marketerData: Record<string, { sales: number; units: number; orders: number; returns: number }> = {};

      (data || []).forEach((order: any) => {
        const id = order.marketer_id_staff;
        if (!marketerData[id]) {
          marketerData[id] = { sales: 0, units: 0, orders: 0, returns: 0 };
        }
        marketerData[id].orders += 1;
        marketerData[id].units += order.quantity || 0;

        if (order.delivery_status === "Return" || order.delivery_status === "Failed") {
          marketerData[id].returns += 1;
        } else {
          marketerData[id].sales += Number(order.total_price) || 0;
        }
      });

      // Convert to array and sort by sales
      const leaderboardArray = Object.entries(marketerData)
        .map(([idStaff, data]) => ({
          idStaff,
          ...data,
          netSales: data.sales,
        }))
        .sort((a, b) => b.netSales - a.netSales)
        .slice(0, 10);

      return leaderboardArray;
    },
    enabled: true,
  });

  // Find current user's rank
  const myRank = useMemo(() => {
    const idx = leaderboard.findIndex((m: any) => m.idStaff === userIdStaff);
    return idx >= 0 ? idx + 1 : null;
  }, [leaderboard, userIdStaff]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-orange-500" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold">{rank}</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Top 10 Leaderboard</h1>
        <p className="text-muted-foreground mt-2">
          See how you rank against other marketers
        </p>
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

      {/* My Rank Card */}
      {myRank && (
        <Card className="bg-gradient-to-r from-primary/10 to-blue-500/10 border-primary">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              {getRankIcon(myRank)}
              <div>
                <p className="text-2xl font-bold">#{myRank}</p>
                <p className="text-muted-foreground">Your current rank</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xl font-bold">
                  RM {leaderboard.find((m: any) => m.idStaff === userIdStaff)?.netSales.toFixed(2) || "0.00"}
                </p>
                <p className="text-sm text-muted-foreground">Your sales</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Top 10 Marketers
          </CardTitle>
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
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Staff ID</TableHead>
                  <TableHead className="text-right">Sales (RM)</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Returns</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.length > 0 ? (
                  leaderboard.map((marketer: any, idx: number) => (
                    <TableRow
                      key={marketer.idStaff}
                      className={marketer.idStaff === userIdStaff ? "bg-primary/10" : ""}
                    >
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {getRankIcon(idx + 1)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{marketer.idStaff}</span>
                          {marketer.idStaff === userIdStaff && (
                            <Badge variant="outline" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {marketer.netSales.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">{marketer.orders}</TableCell>
                      <TableCell className="text-right">{marketer.units}</TableCell>
                      <TableCell className="text-right text-red-500">{marketer.returns}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No data available
                    </TableCell>
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

export default MarketerTop10;
