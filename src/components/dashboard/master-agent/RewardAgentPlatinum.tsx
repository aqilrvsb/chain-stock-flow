import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Users, Award, Target, TrendingUp } from "lucide-react";

const RewardAgentPlatinum = () => {
  const { user } = useAuth();
  const currentDate = new Date();
  const [periodFilter, setPeriodFilter] = useState<"monthly" | "yearly">("monthly");
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());

  const { data: rewardData, isLoading } = useQuery({
    queryKey: ["reward-agent-platinum-ma-progress", user?.id, periodFilter, selectedMonth, selectedYear],
    queryFn: async () => {
      const month = periodFilter === "monthly" ? parseInt(selectedMonth) : 0;
      const year = parseInt(selectedYear);

      // Get active rewards for platinum agents
      const { data: rewards } = await supabase
        .from("rewards_config")
        .select("*")
        .eq("role_subrole", "platinum")
        .eq("month", month)
        .eq("year", year)
        .eq("is_active", true)
        .order("month", { ascending: false });

      // Get only THIS master agent's platinum agents via relationships table
      const { data: relationships } = await supabase
        .from("master_agent_relationships")
        .select(`
          agent_id,
          agent:profiles!master_agent_relationships_agent_id_fkey(
            id,
            full_name,
            email,
            idstaff,
            sub_role
          )
        `)
        .eq("master_agent_id", user?.id);

      // Filter for platinum agents only
      const agents = relationships
        ?.map(rel => rel.agent)
        .filter(agent => agent?.sub_role === 'platinum') || [];

      if (!agents) return { agents: [], rewards: rewards || [] };

      // Get transactions for each agent
      const startDate = periodFilter === "yearly"
        ? new Date(year, 0, 1)
        : new Date(year, month - 1, 1);
      const endDate = periodFilter === "yearly"
        ? new Date(year, 11, 31, 23, 59, 59)
        : new Date(year, month, 0, 23, 59, 59);

      const progressData = await Promise.all(
        agents.map(async (agent) => {
          // Get completed purchases only from agent_purchases table
          const { data: transactions } = await supabase
            .from("agent_purchases")
            .select("quantity")
            .eq("agent_id", agent.id)
            .eq("status", "completed")
            .gte("created_at", startDate.toISOString())
            .lte("created_at", endDate.toISOString());

          const totalQuantity = transactions?.reduce((sum, tx) => sum + tx.quantity, 0) || 0;

          // Find matching rewards and calculate achievement
          const rewardProgress = rewards?.map(reward => {
            const percentAchieve = reward.min_quantity > 0
              ? Math.min((totalQuantity / reward.min_quantity) * 100, 100)
              : 0;
            const isAchieved = totalQuantity >= reward.min_quantity;

            return {
              ...reward,
              totalQuantity,
              percentAchieve: Math.round(percentAchieve),
              isAchieved,
            };
          }) || [];

          return {
            agent,
            rewardProgress,
            totalQuantity,
          };
        })
      );

      return { agents: progressData, rewards: rewards || [] };
    },
    enabled: !!user?.id,
  });

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // Calculate summary stats
  const allUsers = rewardData?.agents.length || 0;
  const achievedCount = rewardData?.agents.filter(a =>
    a.rewardProgress.some(rp => rp.isAchieved)
  ).length || 0;
  const notAchievedCount = allUsers - achievedCount;
  const totalTargetQuantity = rewardData?.rewards.reduce((sum, r) => sum + r.min_quantity, 0) || 0;
  const totalQuantity = rewardData?.agents.reduce((sum, a) => sum + a.totalQuantity, 0) || 0;

  const summaryStats = [
    { title: "All Users", value: allUsers, icon: Users, color: "text-blue-600" },
    { title: "Achieved", value: achievedCount, icon: Award, color: "text-green-600" },
    { title: "Not Achieved", value: notAchievedCount, icon: Target, color: "text-orange-600" },
    { title: "Total Target Quantity", value: totalTargetQuantity, icon: TrendingUp, color: "text-purple-600" },
    { title: "Total Quantity", value: totalQuantity, icon: TrendingUp, color: "text-cyan-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          Reward Agent (Platinum) Progress
        </h1>
        <p className="text-muted-foreground mt-2">
          Track your Platinum agents' performance towards reward targets
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {summaryStats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-2">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter by Period</CardTitle>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Period Type</Label>
              <RadioGroup value={periodFilter} onValueChange={(value: any) => setPeriodFilter(value)} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monthly" id="agent-platinum-ma-filter-monthly" />
                  <Label htmlFor="agent-platinum-ma-filter-monthly" className="font-normal cursor-pointer">Monthly</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yearly" id="agent-platinum-ma-filter-yearly" />
                  <Label htmlFor="agent-platinum-ma-filter-yearly" className="font-normal cursor-pointer">Yearly</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {periodFilter === "monthly" && (
                <div className="space-y-2">
                  <Label htmlFor="month">Month</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthNames.map((name, index) => (
                        <SelectItem key={index + 1} value={(index + 1).toString()}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading progress data...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {periodFilter === "monthly" && <TableHead>Month</TableHead>}
                  <TableHead>Year</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Target Quantity</TableHead>
                  <TableHead>Total Quantity</TableHead>
                  <TableHead>Percent Achieve</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rewardData?.agents.flatMap((a) =>
                  a.rewardProgress.length > 0 ? (
                    a.rewardProgress.map((rp, idx) => (
                      <TableRow key={`${a.agent.id}-${idx}`}>
                        {periodFilter === "monthly" && <TableCell>{monthNames[parseInt(selectedMonth) - 1]}</TableCell>}
                        <TableCell>{selectedYear}</TableCell>
                        <TableCell>{a.agent.idstaff || a.agent.full_name || a.agent.email}</TableCell>
                        <TableCell>{rp.min_quantity}</TableCell>
                        <TableCell className="font-bold">{rp.totalQuantity}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-full max-w-[100px] bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${rp.percentAchieve}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{rp.percentAchieve}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rp.isAchieved ? "default" : "secondary"}>
                            {rp.isAchieved ? "Achieved" : "Not Achieved"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow key={a.agent.id}>
                      {periodFilter === "monthly" && <TableCell>{monthNames[parseInt(selectedMonth) - 1]}</TableCell>}
                      <TableCell>{selectedYear}</TableCell>
                      <TableCell>{a.agent.idstaff || a.agent.full_name || a.agent.email}</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>{a.totalQuantity}</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>
                        <Badge variant="secondary">No Target</Badge>
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RewardAgentPlatinum;
