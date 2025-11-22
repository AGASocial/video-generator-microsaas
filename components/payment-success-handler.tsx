"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export function PaymentSuccessHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [hasShownToast, setHasShownToast] = useState(false);
  const [initialCredits, setInitialCredits] = useState<number | null>(null);

  useEffect(() => {
    const success = searchParams.get("success");
    
    if (success === "true" && !hasShownToast) {
      setHasShownToast(true);
      
      // Get initial credits from the page
      const creditsElement = document.querySelector('[data-credits]');
      if (creditsElement) {
        const credits = parseInt(creditsElement.textContent || '0', 10);
        setInitialCredits(credits);
      }
      
      toast({
        title: "Payment successful!",
        description: "Processing your credits...",
      });
      
      // Try to get session ID from URL if available
      const sessionId = new URLSearchParams(window.location.search).get("session_id");
      if (sessionId) {
        console.log("[PaymentSuccess] Session ID:", sessionId);
        // Verify session status
        fetch(`/api/checkout/verify-session?sessionId=${sessionId}`)
          .then(res => res.json())
          .then(data => {
            console.log("[PaymentSuccess] Session status:", data);
            if (data.webhook_should_fire) {
              console.log("[PaymentSuccess] ✅ Webhook should have fired - payment is paid and complete");
            } else {
              console.warn("[PaymentSuccess] ⚠️ Webhook may not fire - payment status:", data.payment_status, "session status:", data.status);
            }
          })
          .catch(err => console.error("[PaymentSuccess] Error verifying session:", err));
      }
      
      // Poll for credit updates (webhook might take a moment)
      let attempts = 0;
      const maxAttempts = 10;
      const pollInterval = setInterval(async () => {
        attempts++;
        
        try {
          // Fetch current credits
          const response = await fetch('/api/user/credits');
          if (response.ok) {
            const data = await response.json();
            const currentCredits = data.credits || 0;
            
            // If credits have increased, webhook processed successfully
            if (initialCredits !== null && currentCredits > initialCredits) {
              clearInterval(pollInterval);
              router.refresh();
              toast({
                title: "Credits added!",
                description: `Your account now has ${currentCredits} credits.`,
              });
              
              // Clean up the URL
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.delete("success");
              router.replace(newUrl.pathname + newUrl.search);
              return;
            }
          }
        } catch (error) {
          console.error("Error polling credits:", error);
        }
        
        // If max attempts reached, just refresh
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          router.refresh();
          toast({
            title: "Payment processed",
            description: "Please refresh if credits haven't updated.",
          });
          
          // Clean up the URL
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete("success");
          router.replace(newUrl.pathname + newUrl.search);
        }
      }, 1000); // Poll every second
      
      // Cleanup on unmount
      return () => clearInterval(pollInterval);
    }
  }, [searchParams, router, toast, hasShownToast, initialCredits]);

  return null;
}

