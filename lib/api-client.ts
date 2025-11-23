/**
 * API Client for Server Components
 * Helper functions to fetch data from API routes
 * 
 * Note: In Server Components, we need to forward cookies manually
 * to ensure authentication works properly.
 */

import { User, VideoHistory, Transaction } from "@/lib/types";
import { cookies, headers } from "next/headers";

/**
 * Get the base URL for API calls
 * In Server Components, we need absolute URLs for fetch()
 */
async function getApiBaseUrl(): Promise<string> {
  if (typeof window === "undefined") {
    // Server-side: construct absolute URL from headers or use env variable
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return process.env.NEXT_PUBLIC_APP_URL;
    }
    
    // Try to get URL from headers (works in Server Components)
    try {
      const headersList = await headers();
      const host = headersList.get("host");
      const protocol = headersList.get("x-forwarded-proto") || "http";
      
      if (host) {
        return `${protocol}://${host}`;
      }
    } catch (error) {
      // Headers might not be available in all contexts
      console.warn("[API Client] Could not get headers, using localhost fallback");
    }
    
    // Fallback to localhost for development
    return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  }
  // Client-side: use current origin
  return window.location.origin;
}

/**
 * Get fetch options with cookies for Server Components
 */
async function getFetchOptions(): Promise<RequestInit> {
  const cookieStore = await cookies();
  
  // Manually construct cookie header from all cookies
  const cookiePairs: string[] = [];
  cookieStore.getAll().forEach((cookie) => {
    cookiePairs.push(`${cookie.name}=${cookie.value}`);
  });
  const cookieHeader = cookiePairs.join("; ");
  
  return {
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader && { Cookie: cookieHeader }),
    },
    cache: "no-store",
  };
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const baseUrl = await getApiBaseUrl();
    const url = `${baseUrl}/api/user`;
    
    // Get fetch options with cookies for authentication
    const fetchOptions = await getFetchOptions();
    
    const response = await fetch(url, {
      method: "GET",
      ...fetchOptions,
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || "Failed to fetch user" };
    }

    const data = await response.json();
    return { success: true, user: data.user };
  } catch (error) {
    console.error("[API Client] Error fetching user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get user's video history
 */
export async function getUserVideos(options?: {
  status?: string | string[];
  limit?: number;
  order?: string;
  ascending?: boolean;
}): Promise<{ success: boolean; videos?: VideoHistory[]; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (options?.status) {
      const status = Array.isArray(options.status)
        ? options.status.join(",")
        : options.status;
      params.append("status", status);
    }
    if (options?.limit) {
      params.append("limit", options.limit.toString());
    }
    if (options?.order) {
      params.append("order", options.order);
    }
    if (options?.ascending !== undefined) {
      params.append("ascending", options.ascending.toString());
    }

    const baseUrl = await getApiBaseUrl();
    const url = `${baseUrl}/api/user/videos${params.toString() ? `?${params.toString()}` : ""}`;
    const fetchOptions = await getFetchOptions();
    
    const response = await fetch(url, {
      method: "GET",
      ...fetchOptions,
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || "Failed to fetch videos" };
    }

    const data = await response.json();
    return { success: true, videos: data.videos || [] };
  } catch (error) {
    console.error("[API Client] Error fetching videos:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get user's recent videos (completed or queued)
 */
export async function getRecentVideos(
  limit: number = 6
): Promise<{ success: boolean; videos?: VideoHistory[]; error?: string }> {
  try {
    const baseUrl = await getApiBaseUrl();
    const url = `${baseUrl}/api/user/videos/recent?limit=${limit}`;
    const fetchOptions = await getFetchOptions();
    
    const response = await fetch(url, {
      method: "GET",
      ...fetchOptions,
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || "Failed to fetch recent videos",
      };
    }

    const data = await response.json();
    return { success: true, videos: data.videos || [] };
  } catch (error) {
    console.error("[API Client] Error fetching recent videos:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get user's transactions
 */
export async function getUserTransactions(options?: {
  limit?: number;
  order?: string;
  ascending?: boolean;
}): Promise<{ success: boolean; transactions?: Transaction[]; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append("limit", options.limit.toString());
    }
    if (options?.order) {
      params.append("order", options.order);
    }
    if (options?.ascending !== undefined) {
      params.append("ascending", options.ascending.toString());
    }

    const baseUrl = await getApiBaseUrl();
    const url = `${baseUrl}/api/user/transactions${params.toString() ? `?${params.toString()}` : ""}`;
    const fetchOptions = await getFetchOptions();
    
    const response = await fetch(url, {
      method: "GET",
      ...fetchOptions,
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || "Failed to fetch transactions",
      };
    }

    const data = await response.json();
    return { success: true, transactions: data.transactions || [] };
  } catch (error) {
    console.error("[API Client] Error fetching transactions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

