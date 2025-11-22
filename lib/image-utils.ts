/**
 * Image processing utilities for cropping and resizing
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Get image dimensions from a file
 */
export function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.width,
        height: img.height,
      });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Detect if image is landscape (width > height)
 */
export function isLandscape(dimensions: ImageDimensions): boolean {
  return dimensions.width > dimensions.height;
}

/**
 * Crop and resize image to target dimensions
 * @param imageSrc - Source image data URL
 * @param pixelCrop - Crop area in pixels
 * @param targetDimensions - Target dimensions as "WIDTHxHEIGHT" string (e.g., "1280x720")
 */
export async function cropAndResizeImage(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  targetDimensions: string
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Parse target dimensions
  const [targetWidth, targetHeight] = targetDimensions.split('x').map(Number);
  
  if (!targetWidth || !targetHeight) {
    throw new Error(`Invalid target dimensions: ${targetDimensions}`);
  }
  
  console.log(`[cropAndResizeImage] Target dimensions: ${targetWidth}x${targetHeight}`);
  console.log(`[cropAndResizeImage] Crop area: x=${pixelCrop.x}, y=${pixelCrop.y}, w=${pixelCrop.width}, h=${pixelCrop.height}`);
  console.log(`[cropAndResizeImage] Source image dimensions: ${image.width}x${image.height}`);
  
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // Draw the cropped image, scaled to target size
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );
  
  console.log(`[cropAndResizeImage] Canvas dimensions set to: ${canvas.width}x${canvas.height}`);

  // Convert canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      },
      'image/jpeg',
      0.95 // Quality
    );
  });
}

/**
 * Create an Image object from a source string
 */
function createImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Convert blob to File
 */
export function blobToFile(blob: Blob, fileName: string, mimeType: string): File {
  return new File([blob], fileName, { type: mimeType });
}

