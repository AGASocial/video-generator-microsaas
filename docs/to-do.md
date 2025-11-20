# To-Do List

## Video Storage & Download Implementation

### Current Status
- ⚠️ **Videos are NOT downloaded or stored**
- ⚠️ Only video URL is stored in database (`video_history.video_url`)
- ⚠️ Videos remain on external service (OpenAI servers)
- ⚠️ Risk: Videos could be deleted from external service
- ✅ Storage bucket exists for images (`video-images`) but not for videos

### Problem
When a video is complete:
1. OpenAI/webhook provides a `videoUrl` (external URL)
2. We store only the URL in database
3. Video stays on OpenAI's servers
4. **If OpenAI deletes the video, it's lost forever**

### Solution: Download & Store Videos

**Option 1: Supabase Storage (Recommended)**
- Download video from external URL
- Upload to Supabase Storage bucket
- Store Supabase URL in database
- Videos are permanently stored and accessible

**Option 2: S3/Cloud Storage**
- Download video from external URL
- Upload to S3 bucket
- Store S3 URL in database
- More scalable for large files

### Implementation Steps

1. **Create Supabase Storage Bucket for Videos**
   ```sql
   -- Create storage bucket for videos
   insert into storage.buckets (id, name, public)
   values ('videos', 'videos', true)
   on conflict (id) do nothing;
   
   -- Set up storage policies
   create policy "Allow authenticated users to upload videos"
   on storage.objects for insert
   to authenticated
   with check (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);
   
   create policy "Allow public access to videos"
   on storage.objects for select
   to public
   using (bucket_id = 'videos');
   ```

2. **Update Webhook Endpoint** (`app/api/webhook/video-complete/route.ts`)
   - Download video from `videoUrl` (external URL)
   - Upload to Supabase Storage
   - Store Supabase Storage URL in database
   - Delete or keep original URL as backup

3. **Update Background Polling** (`app/api/generate/route.ts`)
   - When polling detects video is ready
   - Download video from OpenAI URL
   - Upload to Supabase Storage
   - Update database with Supabase URL

4. **Add Video Download Function**
   ```typescript
   async function downloadAndStoreVideo(
     videoId: string,
     externalUrl: string,
     userId: string
   ) {
     // 1. Download video from external URL
     const response = await fetch(externalUrl);
     const videoBlob = await response.blob();
     
     // 2. Upload to Supabase Storage
     const supabase = await createClient();
     const fileName = `${userId}/${videoId}.mp4`;
     
     const { data, error } = await supabase.storage
       .from('videos')
       .upload(fileName, videoBlob, {
         contentType: 'video/mp4',
         upsert: false
       });
     
     if (error) throw error;
     
     // 3. Get public URL
     const { data: urlData } = supabase.storage
       .from('videos')
       .getPublicUrl(fileName);
     
     // 4. Update database with Supabase URL
     await supabase
       .from('video_history')
       .update({ video_url: urlData.publicUrl })
       .eq('id', videoId);
     
     return urlData.publicUrl;
   }
   ```

### Storage Location Options

**Supabase Storage:**
- ✅ Easy integration (already using Supabase)
- ✅ Built-in CDN
- ✅ Automatic backups
- ⚠️ Storage limits on free tier
- ✅ Good for MVP/small scale

**AWS S3:**
- ✅ Highly scalable
- ✅ Cost-effective for large volumes
- ✅ Better for production at scale
- ⚠️ Requires AWS setup

**Current: External URLs Only**
- ❌ No permanent storage
- ❌ Risk of video loss
- ❌ Dependent on external service

### File Naming Convention

```
videos/
  {user_id}/
    {video_id}.mp4
```

Example: `videos/abc123/video-uuid-456.mp4`

### Benefits of Storing Videos

- ✅ Permanent storage (videos won't be lost)
- ✅ Independent of external service
- ✅ Better performance (CDN delivery)
- ✅ User ownership (videos belong to your platform)
- ✅ Compliance (data retention policies)

### Considerations

1. **Storage Costs**
   - Videos are large files (8 seconds = ~5-10MB)
   - Calculate storage needs: users × videos × size
   - Consider cleanup policies for old videos

2. **Download Time**
   - Large files take time to download
   - Consider async processing (queue system)
   - Show "Processing video storage..." status

3. **Error Handling**
   - What if download fails?
   - What if upload fails?
   - Keep original URL as fallback
   - Retry mechanism

4. **Storage Limits**
   - Supabase free tier: 1GB
   - Monitor storage usage
   - Implement cleanup for old videos

### Priority
🔴 **HIGH** - Videos should be stored permanently, not just referenced

---

## Video Generation Webhook Implementation

### Current Status
- ✅ Webhook endpoint exists at `/api/webhook/video-complete`
- ✅ Endpoint accepts: `videoId`, `videoUrl`, `status`
- ⚠️ Currently using polling system (background + frontend)
- 🔄 Need to switch to webhook-based approach

### Webhook Endpoint Details

**URL:** `POST /api/webhook/video-complete`

**Request Body:**
```json
{
  "videoId": "uuid-of-video-entry",
  "videoUrl": "https://...",
  "status": "completed" // or "failed"
}
```

**Response:**
```json
{
  "success": true
}
```

### Implementation Steps

1. **Configure OpenAI/Video Service to Call Webhook**
   - Set webhook URL: `https://yourdomain.com/api/webhook/video-complete`
   - Ensure service passes `videoId` (from initial request)
   - Ensure service passes `videoUrl` when video is ready
   - Ensure service passes `status` ("completed" or "failed")

2. **Update Video Generation API** (`app/api/generate/route.ts`)
   - Remove or disable background polling function
   - When creating video entry, ensure `videoId` is passed to OpenAI service
   - OpenAI service should include `videoId` in webhook callback
   - Keep frontend polling as fallback (or remove if webhook is reliable)

3. **Add Webhook Security** (Optional but Recommended)
   - Add webhook signature verification
   - Add API key or secret token validation
   - Add rate limiting to prevent abuse

4. **Update Frontend** (`components/video-generator-form.tsx`)
   - Keep polling as fallback mechanism
   - Or remove polling if webhook is 100% reliable
   - Show "Waiting for video..." message while processing

### Benefits of Webhook Approach

- ✅ More efficient (no constant polling)
- ✅ Faster updates (immediate notification when ready)
- ✅ Less server load (no background polling)
- ✅ Better scalability
- ✅ Real-time updates

### Current Polling System (To Be Replaced)

**Background Polling:**
- Polls OpenAI API every 5 seconds
- Runs server-side in background
- Updates database when video is ready

**Frontend Polling:**
- Polls `/api/video/status` every 3 seconds
- Shows updates to user in real-time
- Can be kept as fallback

### Webhook Security Considerations

1. **Add Webhook Secret/Token**
   ```typescript
   // In webhook endpoint
   const webhookSecret = request.headers.get("x-webhook-secret");
   if (webhookSecret !== process.env.VIDEO_WEBHOOK_SECRET) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   }
   ```

2. **Add Request Validation**
   - Validate `videoId` exists in database
   - Validate `videoUrl` is a valid URL
   - Validate `status` is valid ("completed" or "failed")

3. **Add Rate Limiting**
   - Prevent webhook spam
   - Use middleware or API gateway

### Testing Checklist

- [ ] Configure OpenAI service with webhook URL
- [ ] Test webhook receives callbacks
- [ ] Verify video status updates in database
- [ ] Verify frontend shows updated video
- [ ] Test error handling (failed videos)
- [ ] Test webhook security (unauthorized requests)
- [ ] Remove/disable polling system
- [ ] Monitor webhook reliability

### Notes

- The webhook endpoint already exists and is functional
- Current polling system works but is less efficient
- Webhook approach is preferred for production
- Keep polling as fallback during transition period

