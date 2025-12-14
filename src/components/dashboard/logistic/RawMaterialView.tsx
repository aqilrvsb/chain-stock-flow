import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Calendar } from "lucide-react";
import { format } from "date-fns";

const RawMaterialView = () => {
  const today = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data: rawMaterials, isLoading } = useQuery({
    queryKey: ["raw-material-stock", startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("raw_material_stock")
        .select(`
          *,
          product:products(name, sku)
        `)
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

  const totalRecords = rawMaterials?.length || 0;
  const totalQuantity = rawMaterials?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const stats = [
    { title: "Total Records", value: totalRecords, icon: Calendar, color: "text-blue-600" },
    { title: "Total Units", value: totalQuantity, icon: Package, color: "text-green-600" },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Raw Material Stock
          </h1>
          <p className="text-muted-foreground mt-2">
            View raw material inventory (read-only)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4 sm:p-6">
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
          <CardTitle>Filter by Date</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4">
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
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading raw material records...</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rawMaterials?.map((item) => {
                  const itemDate = item.date ? new Date(item.date) : null;
                  const isValidDate = itemDate && !isNaN(itemDate.getTime());

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        {isValidDate ? format(itemDate, "dd-MM-yyyy") : "-"}
                      </TableCell>
                      <TableCell>{item.product?.name}</TableCell>
                      <TableCell>{item.product?.sku}</TableCell>
                      <TableCell className="font-bold">{item.quantity}</TableCell>
                      <TableCell>{item.description || "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RawMaterialView;
