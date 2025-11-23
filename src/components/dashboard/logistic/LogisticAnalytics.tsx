import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, CheckCircle, XCircle, AlertTriangle, Loader, PackageCheck } from "lucide-react";
import { format } from "date-fns";

const LogisticAnalytics = () => {
  const today = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  // Fetch ALL raw material stock (no date filter)
  const { data: allRawMaterials } = useQuery({
    queryKey: ["all-raw-material-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_material_stock")
        .select("quantity");
      if (error) throw error;
      return data;
    },
  });

  // Fetch ALL processed stock (no date filter)
  const { data: allProcessedStock } = useQuery({
    queryKey: ["all-processed-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processed_stock")
        .select("quantity, status");
      if (error) throw error;
      return data;
    },
  });

  // Fetch processed stock WITH date filter
  const { data: processedStock } = useQuery({
    queryKey: ["processed-stock", startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("processed_stock")
        .select("quantity, status")
        .order("date", { ascending: false });

      if (startDate) {
        query = query.gte("date", startDate);
      }
      if (endDate) {
        query = query.lte("date", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Calculate totals WITHOUT date filter
  const totalRawMaterial = allRawMaterials?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const totalAllSuccess = allProcessedStock?.filter(item => item.status === 'success')
    .reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalAllReject = allProcessedStock?.filter(item => item.status === 'reject')
    .reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalAllDamage = allProcessedStock?.filter(item => item.status === 'damage')
    .reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalAllLost = allProcessedStock?.filter(item => item.status === 'lost')
    .reduce((sum, item) => sum + item.quantity, 0) || 0;

  const totalProcessed = totalAllSuccess + totalAllReject + totalAllDamage + totalAllLost;
  const totalPending = totalRawMaterial - totalProcessed;

  // Calculate totals WITH date filter
  const totalSuccess = processedStock?.filter(item => item.status === 'success')
    .reduce((sum, item) => sum + item.quantity, 0) || 0;

  const totalReject = processedStock?.filter(item => item.status === 'reject')
    .reduce((sum, item) => sum + item.quantity, 0) || 0;

  const totalDamage = processedStock?.filter(item => item.status === 'damage')
    .reduce((sum, item) => sum + item.quantity, 0) || 0;

  const totalLost = processedStock?.filter(item => item.status === 'lost')
    .reduce((sum, item) => sum + item.quantity, 0) || 0;

  const stats = [
    {
      title: "Total Raw Material",
      value: totalRawMaterial,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      noFilter: true,
    },
    {
      title: "Total Processed",
      value: totalProcessed,
      icon: PackageCheck,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      noFilter: true,
    },
    {
      title: "Total Pending",
      value: totalPending,
      icon: Loader,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      noFilter: true,
    },
    {
      title: "Total Success Packaging",
      value: totalSuccess,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      noFilter: false,
    },
    {
      title: "Total Reject Packaging",
      value: totalReject,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      noFilter: false,
    },
    {
      title: "Total Damage Packaging",
      value: totalDamage,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      noFilter: false,
    },
    {
      title: "Total Lost Packaging",
      value: totalLost,
      icon: XCircle,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      noFilter: false,
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Date Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Date</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default LogisticAnalytics;
