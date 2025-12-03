/**
 * Storage Verification Script
 * Run this to check if the storage bucket is properly configured
 * Usage: npx ts-node scripts/verify-storage.ts
 */

import { verifyStorageBucket, testImageUrl } from '../utils/storageHelpers';

async function runVerification() {
  console.log('🔍 Verifying Supabase Storage Configuration...\n');
  
  // Check post-images bucket
  const result = await verifyStorageBucket('post-images');
  
  console.log('📦 Bucket: post-images');
  console.log(`  ✓ Exists: ${result.exists ? '✅ Yes' : '❌ No'}`);
  console.log(`  ✓ Public: ${result.isPublic ? '✅ Yes' : '❌ No'}`);
  
  if (result.error) {
    console.log(`  ⚠️  Error: ${result.error}`);
  }
  
  if (!result.exists) {
    console.log('\n❌ The "post-images" bucket does not exist!');
    console.log('   Please create it in your Supabase dashboard:');
    console.log('   1. Go to Storage in Supabase dashboard');
    console.log('   2. Create a new bucket named "post-images"');
    console.log('   3. Make it PUBLIC');
    return;
  }
  
  if (!result.isPublic) {
    console.log('\n⚠️  The "post-images" bucket is PRIVATE!');
    console.log('   Please make it public in your Supabase dashboard:');
    console.log('   1. Go to Storage > post-images');
    console.log('   2. Click on the settings/configuration');
    console.log('   3. Enable "Public bucket"');
    return;
  }
  
  console.log('\n✅ Storage bucket is properly configured!');
  console.log('\nIf images are still not loading, check:');
  console.log('  1. Are images actually being uploaded? Check the storage bucket in Supabase');
  console.log('  2. Are the image URLs being saved to the database?');
  console.log('  3. Check browser console for any CORS or network errors');
}

// Run verification
runVerification().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
