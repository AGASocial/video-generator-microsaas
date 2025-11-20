export interface User {
  id: string;
  email: string;
  credits: number;
  created_at: string;
}

export interface VideoHistory {
  id: string;
  user_id: string;
  prompt: string;
  image_url: string | null;
  video_url: string | null;
  duration: number;
  model: string;
  status: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  credits_purchased: number;
  stripe_session_id: string | null;
  status: string;
  created_at: string;
}

export interface VideoGenerationRequest {
  prompt: string;
  imageUrl?: string;
  duration: number;
  model: string;
}
