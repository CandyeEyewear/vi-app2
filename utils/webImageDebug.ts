/**
 * Web Image Debugging Utilities
 * Helpers for debugging image loading issues on mobile web
 */

import { Platform } from 'react-native';

/**
 * Test if an image URL is accessible (web only)
 */
export async function testImageAccessibility(url: string): Promise<{
  accessible: boolean;
  status?: number;
  error?: string;
  corsAllowed?: boolean;
}> {
  if (Platform.OS !== 'web') {
    return { accessible: false, error: 'Not running on web' };
  }

  try {
    // First try a HEAD request
    const response = await fetch(url, { 
      method: 'HEAD',
      mode: 'no-cors' // This won't give us status, but will tell us if blocked
    });

    // Try again with cors mode to get actual status
    const corsResponse = await fetch(url, { 
      method: 'HEAD',
      mode: 'cors'
    }).catch(() => null);

    return {
      accessible: true,
      status: corsResponse?.status,
      corsAllowed: corsResponse !== null,
    };
  } catch (error) {
    console.error('[testImageAccessibility] Error:', error);
    return {
      accessible: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Log detailed image info for debugging
 */
export function logImageDebugInfo(imageUrl: string | undefined, context: string) {
  if (!imageUrl) {
    console.warn(`[${context}] No image URL provided`);
    return;
  }

  console.group(`[${context}] Image Debug Info`);
  console.log('URL:', imageUrl);
  console.log('URL Length:', imageUrl.length);
  console.log('Protocol:', imageUrl.startsWith('https://') ? 'HTTPS ✅' : imageUrl.startsWith('http://') ? 'HTTP ⚠️' : 'Invalid ❌');
  console.log('Domain:', new URL(imageUrl).hostname);
  console.log('Path:', new URL(imageUrl).pathname);
  
  // Check if it looks like a Supabase URL
  const isSupabaseUrl = imageUrl.includes('supabase.co/storage/v1/object/public/');
  console.log('Supabase URL:', isSupabaseUrl ? '✅' : '❌');
  
  if (isSupabaseUrl) {
    const parts = imageUrl.split('/storage/v1/object/public/');
    if (parts[1]) {
      const [bucket, ...pathParts] = parts[1].split('/');
      console.log('Bucket:', bucket);
      console.log('File Path:', pathParts.join('/'));
    }
  }
  
  console.log('\n🔍 To test this URL:');
  console.log(`1. Open in new tab: ${imageUrl}`);
  console.log(`2. Run in console: fetch('${imageUrl}').then(r => console.log('Status:', r.status))`);
  console.groupEnd();
}

/**
 * Check browser cache status (web only)
 */
export function checkBrowserCache() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  console.group('[Browser Cache Info]');
  console.log('User Agent:', navigator.userAgent);
  console.log('Online:', navigator.onLine);
  
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    navigator.storage.estimate().then((estimate) => {
      const usedMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(2);
      const quotaMB = ((estimate.quota || 0) / (1024 * 1024)).toFixed(2);
      console.log(`Storage Used: ${usedMB} MB / ${quotaMB} MB`);
    });
  }
  
  console.log('\n💡 To clear cache:');
  console.log('Chrome: Settings → Privacy → Clear browsing data');
  console.log('Safari: Settings → Safari → Clear History and Website Data');
  console.groupEnd();
}

/**
 * Test Supabase storage accessibility
 */
export async function testSupabaseStorage(
  supabaseUrl: string = 'https://drshtkrhszeaxpmectex.supabase.co',
  bucket: string = 'post-images'
) {
  if (Platform.OS !== 'web') {
    console.warn('testSupabaseStorage only works on web');
    return;
  }

  console.group('[Supabase Storage Test]');
  console.log('Supabase URL:', supabaseUrl);
  console.log('Bucket:', bucket);
  
  try {
    // Test bucket accessibility
    const bucketUrl = `${supabaseUrl}/storage/v1/bucket/${bucket}`;
    console.log('\nTesting bucket endpoint:', bucketUrl);
    
    const response = await fetch(bucketUrl);
    console.log('Bucket Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Bucket Data:', data);
      console.log('Is Public:', data.public || false);
      
      if (!data.public) {
        console.warn('⚠️  Bucket is PRIVATE! This is likely the issue.');
        console.log('Fix: Go to Supabase Dashboard → Storage → post-images → Configuration');
        console.log('     Enable "Public bucket" and save.');
      } else {
        console.log('✅ Bucket is public');
      }
    } else {
      console.error('❌ Could not access bucket info');
      console.error('Response:', await response.text());
    }
  } catch (error) {
    console.error('❌ Error testing storage:', error);
  }
  
  console.groupEnd();
}

/**
 * Run complete diagnostics (call this from browser console)
 */
export async function runImageDiagnostics(imageUrl?: string) {
  console.log('\n🔧 Running Image Diagnostics for Mobile Web\n');
  
  checkBrowserCache();
  
  console.log('\n');
  await testSupabaseStorage();
  
  if (imageUrl) {
    console.log('\n');
    logImageDebugInfo(imageUrl, 'Diagnostics');
    
    console.log('\n');
    const result = await testImageAccessibility(imageUrl);
    console.log('Accessibility Test:', result);
  }
  
  console.log('\n✅ Diagnostics complete!');
  console.log('\nTo test a specific image:');
  console.log('runImageDiagnostics("https://your-image-url-here.jpg")');
}

// Export for use in browser console (web only)
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  (window as any).imageDebug = {
    test: testImageAccessibility,
    log: logImageDebugInfo,
    checkCache: checkBrowserCache,
    testStorage: testSupabaseStorage,
    runDiagnostics: runImageDiagnostics,
  };
  
  console.log('💡 Image debugging tools available in console:');
  console.log('  window.imageDebug.runDiagnostics()');
  console.log('  window.imageDebug.test(imageUrl)');
  console.log('  window.imageDebug.testStorage()');
}
