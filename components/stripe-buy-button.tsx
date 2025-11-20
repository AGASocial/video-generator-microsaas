"use client";

import { useEffect, useRef } from "react";

interface StripeBuyButtonProps {
  buyButtonId: string;
  publishableKey: string;
}

export function StripeBuyButton({ buyButtonId, publishableKey }: StripeBuyButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    // Load Stripe Buy Button script only once
    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/buy-button.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup on unmount
      const existingScript = document.querySelector(
        'script[src="https://js.stripe.com/v3/buy-button.js"]'
      );
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  return (
    <div ref={containerRef}>
      <stripe-buy-button
        buy-button-id={buyButtonId}
        publishable-key={publishableKey}
      />
    </div>
  );
}

// Extend Window interface for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "stripe-buy-button": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "buy-button-id": string;
          "publishable-key": string;
        },
        HTMLElement
      >;
    }
  }
}

