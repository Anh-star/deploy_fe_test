import { createClient } from "@supabase/supabase-js";

async function test(url, anonKey, label) {
  console.log(`\n--- Testing ${label} ---`);
  console.log('URL:', url);
  console.log('Key:', anonKey ? anonKey.substring(0, 20) + '...' : 'undefined');

  if (!url || !anonKey) {
    console.error('Error: URL or Anon Key is missing');
    return;
  }

  const supabase = createClient(url, anonKey);
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error('Error listing buckets:', error);
    } else {
      console.log('Success! Connection is working.');
      console.log('Buckets found:', data.map(b => b.name));
    }
  } catch (err) {
    console.error('Exception caught:', err);
  }
}

async function runAll() {
  // Test 1: From current .env
  await test(
    'https://jligfxgbaykptermpnsd.supabase.co',
    'sb_publishable_7zlSSwp-YlnI6-3lCgOFvw_1M7IXPYP',
    'Current .env Credentials'
  );

  // Test 2: From DEPLOY_GUIDE.md (Old)
  await test(
    'https://gkpyrnunhqfzhbtjtuqp.supabase.co',
    'sb_publishable_nh1bzDvVQGEu82InSikNgA_sxTp2oBX',
    'Old DEPLOY_GUIDE.md Credentials'
  );
}

runAll();
