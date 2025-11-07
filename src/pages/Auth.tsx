import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginIdstaff, setLoginIdstaff] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [logoUrl, setLogoUrl] = useState("/logo.png");
  
  const { signIn } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    // Fetch logo from system settings (types will be regenerated)
    const fetchLogo = async () => {
      const { data } = await (supabase as any)
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "logo_url")
        .maybeSingle();

      if (data?.setting_value) {
        setLogoUrl(data.setting_value);
      }
    };

    fetchLogo();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(loginIdstaff, loginPassword);

    if (error) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
    }

    setIsLoading(false);
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img src={logoUrl} alt="OliveJardin Hub Logo" className="h-24 w-auto object-contain" />
          </div>
          <CardTitle className="text-3xl font-bold text-center">OliveJardin Hub</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="login-idstaff">ID STAFF</Label>
              <Input
                id="login-idstaff"
                type="text"
                placeholder="Enter your ID STAFF"
                value={loginIdstaff}
                onChange={(e) => setLoginIdstaff(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
