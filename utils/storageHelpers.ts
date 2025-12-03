/**
 * Storage Helper Utilities
 * Handles image URL formatting and validation for Supabase storage
 */

import { supabase } from '../services/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://drshtkrhszeaxpmectex.supabase.co';
const STORAGE_BUCKET = 'post-images';

/**
 * Ensure image URL is properly formatted for Supabase storage
 * Handles both old and new URL formats
 */
export function formatStorageUrl(imageUrl: string | null | undefined): string | undefined {
  if (!imageUrl) return undefined;
  
  // If it's already a full URL, return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // If it's a path, construct the full URL
  const cleanPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
  
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${cleanPath}`;
}

/**
 * Get public URL from storage path
 */
export function getPublicUrl(path: string): string {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);
  
  return data.publicUrl;
}

/**
 * Verify if a storage bucket exists and is accessible
 */
export async function verifyStorageBucket(bucketName: string = STORAGE_BUCKET): Promise<{
  exists: boolean;
  isPublic: boolean;
  error?: string;
}> {
  try {
    // Try to list buckets
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('[verifyStorageBucket] Error listing buckets:', error);
      return { exists: false, isPublic: false, error: error.message };
    }
    
    const bucket = buckets?.find(b => b.name === bucketName);
    
    if (!bucket) {
      console.warn(`[verifyStorageBucket] Bucket '${bucketName}' not found`);
      return { exists: false, isPublic: false, error: 'Bucket not found' };
    }
    
    console.log(`[verifyStorageBucket] Bucket '${bucketName}' found:`, {
      public: bucket.public,
      created_at: bucket.created_at,
      updated_at: bucket.updated_at,
    });
    
    return { exists: true, isPublic: bucket.public || false };
  } catch (error) {
    console.error('[verifyStorageBucket] Unexpected error:', error);
    return { 
      exists: false, 
      isPublic: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Test if an image URL is accessible
 */
export async function testImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('[testImageUrl] Failed to fetch:', url, error);
    return false;
  }
}
