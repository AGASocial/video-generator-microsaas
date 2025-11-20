"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export function PaymentSuccessHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const success = searchParams.get("success");
    
    if (success === "true") {
      toast({
        title: "Payment successful!",
        description: "Your credits have been added to your account.",
      });
      
      // Clean up the URL by removing the success parameter
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("success");
      router.replace(newUrl.pathname + newUrl.search);
    }
  }, [searchParams, router, toast]);

  return null;
}

