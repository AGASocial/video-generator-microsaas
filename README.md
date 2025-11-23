# Sora Video Generator

A full-stack Next.js application for generating AI videos using text prompts and images. Built with Supabase authentication, Stripe payments, and a credit-based system.

## Features

- **AI Video Generation**: Create videos from text prompts and optional reference images
- **Multiple Models**: Choose from Sora 2, Sora 2 Pro, and Sora 2 Pro HD
- **Duration Options**: Generate videos in 4, 8, or 12-second durations
- **Credit System**: Pay-as-you-go model with credit packages
- **User Authentication**: Secure email/password authentication via Supabase
- **Video History**: Track and manage all your generated videos
- **Payment Processing**: Stripe Checkout integration for credit purchases
- **Responsive Design**: Clean, modern UI that works on all devices

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security)
- **Payments**: Stripe Checkout
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **TypeScript**: Full type safety throughout

## Prerequisites

- Node.js 18+ installed
- A Supabase project (connected via v0 integrations)
- A Stripe account (connected via v0 integrations)
- (Optional) n8n webhook URL for video processing

## Environment Variables

The following environment variables are automatically configured through v0 integrations:

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `POSTGRES_URL`

### Stripe
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` (for production webhook handling)

### Optional
- `N8N_WEBHOOK_URL` - Your n8n workflow webhook endpoint for video processing
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` - Redirect URL for development (optional)

## Getting Started

### 1. Database Setup

The project includes SQL scripts in the `/scripts` folder that need to be executed:

1. **Run the database scripts** from the v0 interface:
   - `scripts/001_create_tables.sql` - Creates users, video_history, and transactions tables with RLS policies
   - `scripts/002_create_user_trigger.sql` - Sets up automatic user profile creation on signup

2. **Create Supabase Storage Bucket** (optional, for image uploads):
   - Go to your Supabase project dashboard
   - Navigate to Storage
   - Create a public bucket named `video-images`
   - Set appropriate CORS policies if needed

### 2. Stripe Webhook Setup (Production)

For production, you need to set up a Stripe webhook:

1. Go to your Stripe Dashboard → Developers → Webhooks
2. Add an endpoint: `https://yourdomain.com/api/webhook/stripe`
3. Select event: `checkout.session.completed`
4. Copy the webhook signing secret
5. Add it as `STRIPE_WEBHOOK_SECRET` environment variable

### 3. n8n Workflow Setup (Optional)

The app is designed to integrate with an n8n workflow for actual video generation:

1. Create an n8n workflow that:
   - Receives webhook POST requests with video generation parameters
   - Processes the video generation (integrate with your AI video service)
   - Calls back to `/api/webhook/video-complete` with the result

2. Add your n8n webhook URL as `N8N_WEBHOOK_URL` environment variable

**Note**: Currently, the app includes a mock video URL for demo purposes. Replace this with your actual video generation logic.

### 4. Local Development

\`\`\`bash
# Install dependencies (if running locally)
npm install

# Start the development server
npm run dev
\`\`\`

Visit `http://localhost:3000`

## Project Structure

\`\`\`
├── app/
│   ├── api/
│   │   ├── generate/          # Video generation endpoint
│   │   └── webhook/
│   │       ├── stripe/        # Stripe payment webhooks
│   │       └── video-complete/ # n8n callback endpoint
│   ├── auth/
│   │   ├── login/             # Login page
│   │   ├── sign-up/           # Registration page
│   │   └── sign-up-success/   # Email confirmation page
│   ├── credits/               # Credits and pricing page
│   ├── generate/              # Video generation page
│   ├── profile/               # User profile and video history
│   └── page.tsx               # Landing page
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── checkout.tsx           # Stripe checkout component
│   ├── credit-packages.tsx    # Credit package cards
│   ├── navigation.tsx         # Main navigation
│   └── video-generator-form.tsx # Video generation form
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Browser Supabase client
│   │   ├── server.ts          # Server Supabase client
│   │   └── middleware.ts      # Session management
│   ├── products.ts            # Credit package definitions
│   ├── stripe.ts              # Stripe instance
│   └── types.ts               # TypeScript types
├── scripts/
│   ├── 001_create_tables.sql  # Database schema
│   └── 002_create_user_trigger.sql # User auto-creation trigger
└── middleware.ts              # Next.js middleware for auth
\`\`\`

## Database Schema

### users
- `id` (uuid, primary key) - References auth.users
- `email` (text) - User email
- `credits` (integer) - Available credits
- `created_at` (timestamp) - Account creation date

### video_history
- `id` (uuid, primary key)
- `user_id` (uuid) - References users
- `prompt` (text) - Video generation prompt
- `image_url` (text, nullable) - Reference image URL
- `video_url` (text, nullable) - Generated video URL
- `duration` (integer) - Video duration in seconds
- `model` (string) - AI model used
- `status` (string) - Generation status
- `created_at` (timestamp)

### transactions
- `id` (uuid, primary key)
- `user_id` (uuid) - References users
- `amount` (integer) - Amount in cents
- `credits_purchased` (integer) - Number of credits
- `stripe_session_id` (text, nullable)
- `status` (string) - Transaction status
- `created_at` (timestamp)

## Pricing & Cost Analysis

### OpenAI Sora Pricing (Base Costs)

| Model | Output Resolution | Price per Second |
|-------|------------------|------------------|
| sora-2 | Portrait: 720x1280<br>Landscape: 1280x720 | $0.10 |
| sora-2-pro | Portrait: 720x1280<br>Landscape: 1280x720 | $0.30 |

### Our Pricing Structure (2x Markup)

We charge a **2x markup** on OpenAI's base costs. Pricing is based on **12-second videos** to cover all durations (4s, 8s, and 12s).

**Cost Calculation (12 seconds):**
- **sora-2**: $0.10 × 12 seconds = $1.20 (OpenAI cost) × 2 = **$2.40 per video**
- **sora-2-pro**: $0.30 × 12 seconds = $3.60 (OpenAI cost) × 2 = **$7.20 per video**

### Credit System

**Credit Value**: 1 credit = $2.40

| Model | Credits per Video | Price | Covers All Durations |
|-------|------------------|-------|---------------------|
| sora-2 | 1 credit | $2.40 | 4s, 8s, or 12s |
| sora-2-pro | 3 credits | $7.20 | 4s, 8s, or 12s |

**Note**: All videos cost the same number of credits regardless of duration (4s, 8s, or 12s), as pricing is based on the maximum 12-second duration.

## Credit Packages

- **Starter Pack**: $10.99 - 6 credits (~6 sora-2 videos or 2 sora-2-pro videos)
- **Creator Pack**: $21.99 - 12 credits (~12 sora-2 videos or 4 sora-2-pro videos) - **Best Value**
- **Pro Pack**: $45.99 - 25 credits (~25 sora-2 videos or 8 sora-2-pro videos)
- **Enterprise Pack**: $109.99 - 62 credits (~62 sora-2 videos or 20 sora-2-pro videos)

## Security

- **Row Level Security (RLS)**: All database tables use RLS policies
- **Authentication Required**: Protected routes require valid Supabase session
- **Server-side Validation**: Credit checks and price validation on the server
- **Stripe Integration**: Secure payment processing with webhook verification

## API Routes

### POST `/api/generate`
Generate a new video from a prompt and optional image.

**Body** (FormData):
- `prompt` (string, required)
- `duration` (number, required) - 4, 8, or 12
- `model` (string, required) - sora-2, sora-2-pro, or sora-2-pro-HD
- `image` (File, optional)

**Response**:
\`\`\`json
{
  "success": true,
  "videoId": "uuid",
  "message": "Video generation started",
  "videoUrl": "https://..."
}
\`\`\`

### POST `/api/webhook/video-complete`
Callback endpoint for n8n to update video status.

**Body**:
\`\`\`json
{
  "videoId": "uuid",
  "videoUrl": "https://...",
  "status": "completed"
}
\`\`\`

### POST `/api/webhook/stripe`
Stripe webhook handler for payment processing.

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Connect your Supabase and Stripe integrations
4. Deploy

Vercel will automatically set up all environment variables through the connected integrations.

## Customization

### Change Credit Pricing

Edit `lib/products.ts` to modify credit packages:

\`\`\`typescript
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "starter-pack",
    name: "Starter Pack",
    priceInCents: 999,  // $9.99
    credits: 20,
  },
  // Add more packages...
];
\`\`\`

Sora Costs
Portrait: 720x1280 Landscape: 1280x720
sora-2		  $0.10 / second
sora-2-pro	$0.30 / second
### Modify Credit Costs

Credit costs are defined in `lib/products.ts`:

\`\`\`typescript
export const CREDIT_COSTS = {
  "sora-2": 1,        // 1 credit = $2.40 (covers 4s, 8s, or 12s)
  "sora-2-pro": 3,    // 3 credits = $7.20 (covers 4s, 8s, or 12s)
  "sora-2-pro-HD": 3, // Same as pro
} as const;
\`\`\`

To change pricing, update both `CREDIT_COSTS` and `CREDIT_PACKAGES` in `lib/products.ts`.

### Integrate Real Video Generation

Replace the mock video generation in `app/api/generate/route.ts` with your actual video generation service integration.

## Troubleshooting

### Users Not Created After Signup
- Ensure the database trigger script has been executed
- Check Supabase logs for trigger errors
- Verify RLS policies are correctly set

### Stripe Payments Not Working
- Verify webhook secret is correctly set
- Check Stripe dashboard for webhook delivery status
- Ensure user ID is included in checkout session metadata

### Video Generation Failing
- Check that user has sufficient credits
- Verify n8n webhook URL is correct
- Check API logs for errors

## License

MIT

## Support

For issues or questions, please open an issue on the GitHub repository.
