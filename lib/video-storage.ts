/**
 * Video Storage Utility
 * Handles downloading videos from external sources and storing them in Supabase Storage
 */

import { createClient } from "@/lib/supabase/server";

export interface DownloadAndStoreResult {
  success: boolean;
  supabaseUrl?: string;
  error?: string;
}

/**
 * Downloads a video from an external URL and stores it in Supabase Storage
 * @param videoId - The UUID of the video entry in the database
 * @param externalUrl - The external URL to download the video from
 * @param userId - The UUID of the user who owns the video
 * @returns The public Supabase Storage URL of the stored video
 */
export async function downloadAndStoreVideo(
  videoId: string,
  externalUrl: string,
  userId: string
): Promise<DownloadAndStoreResult> {
  try {
    const supabase = await createClient();

    // 1. Download video from external URL
    console.log(`[Video Storage] Downloading video from: ${externalUrl}`);
    const response = await fetch(externalUrl, {
      headers: {
        // If it's an OpenAI URL, we need to add auth header
        ...(externalUrl.includes('api.openai.com') && process.env.OPENAI_API_KEY
          ? { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
          : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
    }

    const videoBlob = await response.blob();
    const videoArrayBuffer = await videoBlob.arrayBuffer();
    const videoBuffer = Buffer.from(videoArrayBuffer);

    // 2. Upload to Supabase Storage
    // File naming: {user_id}/{video_id}.mp4
    const fileName = `${userId}/${videoId}.mp4`;
    
    console.log(`[Video Storage] Uploading video to Supabase Storage: ${fileName}`);
    
    const { data, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(fileName, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true, // Allow overwriting if file exists
      });

    if (uploadError) {
      console.error('[Video Storage] Upload error:', uploadError);
      throw uploadError;
    }

    // 3. Get public URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(fileName);

    console.log(`[Video Storage] Video stored successfully: ${urlData.publicUrl}`);

    // 4. Update database with Supabase URL and set status to completed
    const { error: updateError } = await supabase
      .from('video_history')
      .update({ 
        video_url: urlData.publicUrl,
        status: 'completed'
      })
      .eq('id', videoId);

    if (updateError) {
      console.error('[Video Storage] Database update error:', updateError);
      throw updateError;
    }

    return {
      success: true,
      supabaseUrl: urlData.publicUrl,
    };
  } catch (error) {
    console.error('[Video Storage] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Downloads video from OpenAI using the Sora video ID
 * @param videoId - The UUID of the video entry in the database
 * @param soraVideoId - The OpenAI Sora video ID
 * @param userId - The UUID of the user who owns the video
 */
export async function downloadAndStoreVideoFromOpenAI(
  videoId: string,
  soraVideoId: string,
  userId: string
): Promise<DownloadAndStoreResult> {
  // Construct OpenAI content URL
  const openaiContentUrl = `https://api.openai.com/v1/videos/${soraVideoId}/content`;
  
  return downloadAndStoreVideo(videoId, openaiContentUrl, userId);
}

