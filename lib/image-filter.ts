import sharp from 'sharp';


export interface ImageFilterResult {
  isAllowed: boolean;
  reason?: string;
  fileSize?: number;
  dimensions?: { width: number; height: number };
  format?: string;
}

export async function filterImage(
  buffer: Buffer,
  isGuest: boolean,
  // fileName?: string,
): Promise<ImageFilterResult> {
  try {
    // Check file size (3MB limit for guests, higher for logged-in users)
    const fileSize = buffer.length;
    const maxSize = isGuest ? 3 * 1024 * 1024 : 10 * 1024 * 1024; // 3MB for guests, 10MB for users

    if (fileSize > maxSize) {
      return {
        isAllowed: false,
        reason: `Image size too large. Maximum size is ${maxSize / (1024 * 1024)}MB`,
        fileSize,
      };
    }

    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    const { width, height, format } = metadata;

    // Check image dimensions (reasonable limits)
    if (!width || !height || width > 4096 || height > 4096) {
      return {
        isAllowed: false,
        reason: 'Image dimensions too large. Maximum allowed is 4096x4096 pixels',
        dimensions: { width: width || 0, height: height || 0 },
        format: format || 'unknown',
      };
    }

    // For guests, compress image to lower quality
    let processedBuffer = buffer;
    if (isGuest) {
      processedBuffer = await sharp(buffer)
        .resize(1024, 1024, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 70 })
        .toBuffer();
    }

    // Check for inappropriate content using OpenAI Vision API
    const moderationResult = await checkImageModeration(processedBuffer);

    if (!moderationResult.isAllowed) {
      return {
        isAllowed: false,
        reason: moderationResult.reason,
        fileSize,
        dimensions: { width, height },
        format: format || 'unknown',
      };
    }

    return {
      isAllowed: true,
      fileSize: processedBuffer.length,
      dimensions: { width, height },
      format: format || 'unknown',
    };
  } catch (error) {
    console.error('Image filtering error:', error);
    return {
      isAllowed: false,
      reason: 'Failed to process image. Please try a different image.',
    };
  }
}

async function checkImageModeration(buffer: Buffer): Promise<{ isAllowed: boolean; reason?: string }> {
  // Skip moderation if OpenAI API key is not available
  if (!process.env.OPENAI_API_KEY) {
    console.warn('Skipping image moderation - no OpenAI API key');
    return { isAllowed: false, reason: 'Content moderation service unavailable' };
  }

  try {
    // Convert buffer to base64 for OpenAI API
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // model: 'gpt-4-vision-preview',
        // max_tokens: 100,
        model: 'gpt-4o', // Updated to current model
        max_tokens: 50,
        temperature: 0.1, // Lower temperature for consistent responses
        messages: [
          {
            role: 'system',
            content: 'You are a content moderator. Analyze images for inappropriate content including nudity, sexual content, violence, hate speech, weapons, drugs, or other NSFW material. Respond with ONLY "ALLOWED" if the image is completely appropriate for all ages, or "BLOCKED" if it contains any inappropriate content. Be very conservative - if in doubt, block it.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Is this image appropriate for a general audience of all ages?',
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`OpenAI API error: ${response.status}`);
      return { isAllowed: false, reason: 'Content moderation service error' };
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content?.trim() || '';

    if (content === 'ALLOWED') {
      return { isAllowed: true };
    } else if (content === 'BLOCKED') {
      return {
        isAllowed: false,
        reason: 'Image contains inappropriate content'
      };
    } else {
      // Default to block if unsure
      return {
        isAllowed: false,
        reason: 'Image could not be verified as appropriate'
      };
    }
  } catch (error) {
    console.error('OpenAI moderation error:', error);
    // Default to block if moderation service fails for safety
    return { isAllowed: false, reason: 'Content moderation failed' };
  }
}

export async function getUserImageLimit(userId?: string): Promise<{ maxImages: number; maxDailyUploads: number }> {
  // Guest users: 1 image per chat, 1 per day
  if (!userId || userId.startsWith('guest-')) {
    return { maxImages: 1, maxDailyUploads: 1 };
  }

  // Logged-in users: 2 images per chat, 2 per day
  return { maxImages: 2, maxDailyUploads: 2 };
}
