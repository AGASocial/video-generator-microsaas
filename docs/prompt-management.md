# Prompt Management System

This document explains how to use and manage the prompt system for video generation.

## Overview

The prompt management system consists of two main features:

1. **Prefix Prompts**: A default prefix that is automatically prepended to all user prompts to ensure consistent, high-quality results
2. **Predefined Prompts**: Template prompts that users can select from to help them create better videos

## Database Tables

### `prompt_settings`
Stores the default prefix prompt that gets added to all user prompts.

**Columns:**
- `id` (uuid): Primary key
- `prefix_prompt` (text): The prefix text to prepend to user prompts
- `is_active` (boolean): Whether this setting is currently active
- `description` (text): Optional description of the prompt
- `created_at` (timestamp): When the setting was created
- `updated_at` (timestamp): When the setting was last updated

**Important:** Only one prompt setting should be active at a time. When you create a new one, deactivate the old one.

### `predefined_prompts`
Stores template prompts that users can select from.

**Columns:**
- `id` (uuid): Primary key
- `title` (text): Display name for the prompt
- `prompt` (text): The actual prompt text
- `category` (text): Optional category (e.g., "nature", "urban", "food")
- `description` (text): Optional description shown to users
- `is_active` (boolean): Whether this prompt is available to users
- `display_order` (integer): Order in which prompts appear (lower numbers first)
- `created_at` (timestamp): When the prompt was created
- `updated_at` (timestamp): When the prompt was last updated

## How It Works

### Prefix Prompt Flow

1. User enters a prompt in the form (e.g., "A cat playing in a garden")
2. The system fetches the active prefix prompt from the database
3. The prefix is prepended to the user's prompt:
   ```
   [Prefix Prompt]
   
   [User Prompt]
   ```
4. The combined prompt is sent to OpenAI's Sora API
5. The original user prompt (without prefix) is stored in `video_history` for reference

### Predefined Prompts Flow

1. User opens the video generation form
2. System fetches all active predefined prompts
3. User can:
   - Select a template from the dropdown (which fills the prompt field)
   - Modify the template prompt
   - Write their own custom prompt
4. Selected template prompts are still enhanced with the prefix prompt

## Managing Prompts

### Updating the Prefix Prompt

To update the default prefix prompt, run this SQL in your Supabase SQL editor:

```sql
-- Deactivate the current active prompt
UPDATE public.prompt_settings
SET is_active = false
WHERE is_active = true;

-- Insert a new active prefix prompt
INSERT INTO public.prompt_settings (prefix_prompt, is_active, description)
VALUES (
  'Your new prefix prompt text here. This will be prepended to all user prompts.',
  true,
  'Description of what this prompt does'
);
```

**Example prefix prompts:**

```sql
-- High-quality cinematic focus
INSERT INTO public.prompt_settings (prefix_prompt, is_active, description)
VALUES (
  'Create a high-quality, cinematic video with smooth motion, professional lighting, and excellent composition. The video should be visually stunning and engaging.',
  true,
  'Default prefix prompt for all video generations'
);

-- More detailed technical instructions
INSERT INTO public.prompt_settings (prefix_prompt, is_active, description)
VALUES (
  'Generate a professional video with: smooth camera movements, natural lighting, high detail, cinematic composition, and realistic physics. Ensure the video is visually appealing and maintains consistency throughout.',
  true,
  'Technical-focused prefix prompt'
);
```

### Managing Predefined Prompts

#### Adding a New Predefined Prompt

```sql
INSERT INTO public.predefined_prompts (
  title,
  prompt,
  category,
  description,
  is_active,
  display_order
)
VALUES (
  'My New Template',
  'The actual prompt text that users will see',
  'category-name',
  'A helpful description for users',
  true,
  10  -- Higher number = appears later in list
);
```

#### Updating an Existing Prompt

```sql
UPDATE public.predefined_prompts
SET
  title = 'Updated Title',
  prompt = 'Updated prompt text',
  description = 'Updated description',
  display_order = 5
WHERE id = 'prompt-uuid-here';
```

#### Deactivating a Prompt

```sql
UPDATE public.predefined_prompts
SET is_active = false
WHERE id = 'prompt-uuid-here';
```

#### Reordering Prompts

```sql
-- Set display order for multiple prompts
UPDATE public.predefined_prompts
SET display_order = 1
WHERE title = 'Nature Scene';

UPDATE public.predefined_prompts
SET display_order = 2
WHERE title = 'City Life';
```

## Best Practices

### Prefix Prompts

1. **Keep it concise**: Long prefixes can reduce the impact of user prompts
2. **Focus on quality**: Emphasize technical quality (lighting, composition, motion)
3. **Be specific**: Use concrete terms like "smooth motion" rather than vague ones
4. **Test changes**: Update the prefix and test with a few generations before deploying widely
5. **Version control**: Consider keeping old prompts with `is_active = false` for rollback

### Predefined Prompts

1. **Keep them generic**: Prompts should be adaptable to different contexts
2. **Use clear titles**: Users should understand what they're selecting
3. **Provide descriptions**: Help users understand when to use each template
4. **Organize by category**: Use categories to group related prompts
5. **Regular updates**: Review and update prompts based on user feedback and results
6. **Balance variety**: Offer diverse options across different use cases

### Example Predefined Prompts by Category

**Nature:**
- "A serene landscape with mountains in the background, a calm lake in the foreground, gentle breeze moving through trees, golden hour lighting"

**Urban:**
- "Busy city street with people walking, cars passing by, modern architecture, vibrant urban atmosphere, daytime"

**Abstract:**
- "Colorful abstract patterns flowing and morphing, smooth transitions between shapes, vibrant colors, artistic composition"

**Commercial:**
- "Professional product presentation with smooth camera movement, studio lighting, clean background, highlighting product details"

## Troubleshooting

### Prefix prompt not being applied

1. Check that there's an active prompt setting:
   ```sql
   SELECT * FROM public.prompt_settings WHERE is_active = true;
   ```

2. Check the API logs for errors fetching the prefix

3. Verify RLS policies allow authenticated users to read

### Predefined prompts not showing

1. Check that prompts are active:
   ```sql
   SELECT * FROM public.predefined_prompts WHERE is_active = true ORDER BY display_order;
   ```

2. Check browser console for API errors

3. Verify the `/api/prompts` endpoint is accessible

### Users seeing old prompts

- Clear browser cache
- Check that old prompts have `is_active = false`
- Verify the API is fetching fresh data (check response headers)

## API Endpoints

### GET `/api/prompts`

Returns all active predefined prompts.

**Response:**
```json
{
  "success": true,
  "prompts": [
    {
      "id": "uuid",
      "title": "Nature Scene",
      "prompt": "...",
      "category": "nature",
      "description": "...",
      "is_active": true,
      "display_order": 1
    }
  ]
}
```

## Future Enhancements

Consider adding:
- Admin UI for managing prompts
- A/B testing different prefix prompts
- User feedback on prompt effectiveness
- Analytics on which predefined prompts are most used
- Prompt suggestions based on user input

