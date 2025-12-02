/**
 * Realtime Connection Test Script
 * Run this to verify Supabase Realtime is working
 * 
 * Usage (in React Native):
 * 1. Import this file in your app entry point
 * 2. Call testRealtimeConnection() on mount
 * 3. Check console for results
 */

import { supabase } from './services/supabase';

export async function testRealtimeConnection() {
  console.log('\n=== SUPABASE REALTIME CONNECTION TEST ===\n');
  
  // Test 1: Basic channel subscription
  console.log('Test 1: Creating test channel...');
  const testChannel = supabase.channel('test-connection');
  
  let subscriptionStatus = 'PENDING';
  
  testChannel
    .subscribe((status) => {
      subscriptionStatus = status;
      console.log(`✓ Channel subscription status: ${status}`);
      
      if (status === 'SUBSCRIBED') {
        console.log('✅ Test 1 PASSED: Basic channel subscription works!');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        console.error('❌ Test 1 FAILED: Channel subscription failed');
        console.error('   Possible causes:');
        console.error('   - Realtime not enabled in Supabase dashboard');
        console.error('   - Network/firewall blocking WebSocket');
        console.error('   - Invalid Supabase credentials');
      }
    });
  
  // Wait for subscription
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test 2: Presence channel
  if (subscriptionStatus === 'SUBSCRIBED') {
    console.log('\nTest 2: Testing presence tracking...');
    
    const presenceChannel = supabase.channel('test-presence', {
      config: {
        presence: {
          key: 'test-user-123',
        },
      },
    });
    
    let presenceWorks = false;
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        console.log('✓ Presence state synced:', state);
        presenceWorks = true;
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log(`✓ Presence joined: ${key}`, newPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✓ Presence channel subscribed');
          
          // Track test presence
          await presenceChannel.track({
            user_id: 'test-user-123',
            user_name: 'Test User',
            online: true,
            typing: false,
            timestamp: new Date().toISOString(),
          });
          
          console.log('✓ Presence tracked');
        }
      });
    
    // Wait for presence sync
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (presenceWorks) {
      console.log('✅ Test 2 PASSED: Presence tracking works!');
    } else {
      console.error('❌ Test 2 FAILED: Presence tracking not working');
      console.error('   Possible causes:');
      console.error('   - Presence not supported on your Supabase plan');
      console.error('   - Realtime Broadcast/Presence not enabled');
    }
    
    // Cleanup
    presenceChannel.unsubscribe();
  }
  
  // Test 3: Multiple channels (like in messages screen)
  console.log('\nTest 3: Testing multiple presence channels...');
  
  const channels: any[] = [];
  const conversationIds = ['conv-1', 'conv-2', 'conv-3'];
  
  conversationIds.forEach((convId) => {
    const channel = supabase.channel(`presence:${convId}`, {
      config: {
        presence: {
          key: 'test-user',
        },
      },
    });
    
    channel
      .on('presence', { event: 'sync' }, () => {
        console.log(`✓ Channel ${convId} synced`);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✓ Channel ${convId} subscribed`);
          await channel.track({
            user_id: 'test-user',
            online: false,
          });
        }
      });
    
    channels.push(channel);
  });
  
  // Wait for all channels
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log(`✅ Test 3 COMPLETED: Created ${channels.length} channels`);
  
  // Cleanup
  channels.forEach(channel => {
    channel.unsubscribe();
    supabase.removeChannel(channel);
  });
  testChannel.unsubscribe();
  supabase.removeChannel(testChannel);
  
  console.log('\n=== TEST COMPLETED ===');
  console.log('Check the results above to diagnose issues.\n');
}

// Test helper: Check current user session
export async function checkUserSession() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    console.log('✓ User authenticated:', session.user.email);
    console.log('  User ID:', session.user.id);
    return session.user;
  } else {
    console.error('✗ No user session found');
    console.error('  Make sure user is logged in before testing presence');
    return null;
  }
}

// Quick test you can run from console
export async function quickPresenceTest() {
  console.log('Quick Presence Test...');
  
  const user = await checkUserSession();
  if (!user) return;
  
  const channel = supabase.channel('quick-test', {
    config: { presence: { key: user.id } },
  });
  
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      console.log('Presence state:', state);
      console.log('Number of users present:', Object.keys(state).length);
    })
    .subscribe(async (status) => {
      console.log('Status:', status);
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: user.id,
          online: true,
          timestamp: Date.now(),
        });
        console.log('✓ Tracked presence');
      }
    });
  
  // Auto cleanup after 10 seconds
  setTimeout(() => {
    channel.unsubscribe();
    console.log('✓ Test complete');
  }, 10000);
}

export default {
  testRealtimeConnection,
  checkUserSession,
  quickPresenceTest,
};
