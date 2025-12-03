// CameraServerDiscovery.js - Auto-discover camera server using network scanning

/**
 * Try to get public URL from local server (if on same network)
 */
async function tryGetPublicUrl() {
  const localUrls = [
    'http://192.168.68.134:5000',
    'http://192.168.1.19:5000',
    'http://10.193.174.156:5000'
  ];
  
  for (const baseUrl of localUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`${baseUrl}/get_public_url`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          console.log('📡 Got public URL from server:', data.url);
          return data.url;
        }
      }
    } catch (err) {
      // Continue to next URL
    }
  }
  
  return null;
}

/**
 * Generate list of IPs to scan across common network ranges
 */
function generateIPsToScan() {
  const urls = [];
  
  // Common IP addresses to check in each subnet
  const commonLastOctets = [1, 2, 5, 10, 19, 20, 50, 100, 134, 150, 156, 200, 254];
  
  // Common subnet prefixes
  const subnets = [
    '192.168.68',  // Current network
    '192.168.1',   // Most common home router
    '192.168.0',   // Second most common
    '192.168.43',  // Android hotspot
    '172.20.10',   // iOS hotspot
    '10.0.0',      // Corporate/Apple
    '10.0.1',      // Corporate variation
    '10.193.174',  // Previous network
    '172.27.223',  // Mobile carrier
    '192.168.137', // Windows hotspot
  ];
  
  // Generate URLs for each combination
  for (const subnet of subnets) {
    for (const lastOctet of commonLastOctets) {
      urls.push(`http://${subnet}.${lastOctet}:5000`);
    }
  }
  
  return urls;
}

/**
 * Attempts to discover the camera server using multiple methods
 * Returns the first working URL or null if none work
 */
export async function discoverCameraServer(timeout = 2000) {
  console.log('🔍 Auto-discovering camera server...');
  
  // Step 1: Try to get public URL from local server (if on same network)
  const publicUrl = await tryGetPublicUrl();
  if (publicUrl) {
    const found = await tryUrl(publicUrl, timeout);
    if (found) {
      console.log('✅ Using public URL:', publicUrl);
      return found;
    }
  }
  
  // Step 2: Try hostname (mDNS) - works if network supports it
  const hostnameUrls = [
    'http://rpi5desktop.local:5000',
    'http://RPi5Desktop.local:5000',
  ];
  
  for (const url of hostnameUrls) {
    const found = await tryUrl(url, timeout);
    if (found) return found;
  }
  
  // Step 3: Scan common IPs across multiple subnets
  const allUrls = generateIPsToScan();
  console.log(`🔎 Scanning ${allUrls.length} IPs across common networks...`);
  
  // Scan in parallel batches for speed (10 at a time)
  const batchSize = 10;
  for (let i = 0; i < allUrls.length; i += batchSize) {
    const batch = allUrls.slice(i, i + batchSize);
    const promises = batch.map(url => tryUrl(url, timeout));
    const results = await Promise.all(promises);
    
    const found = results.find(result => result !== null);
    if (found) return found;
  }
  
  console.log('⚠️ No camera server found on network');
  return null;
}

/**
 * Try a single URL
 */
async function tryUrl(url, timeout) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${url}/status`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'online') {
        console.log('✅ Found camera server at:', url);
        return url;
      }
    }
  } catch (err) {
    // Silent fail - expected for most IPs
  }
  
  return null;
}

/**
 * Store the last working server URL in AsyncStorage
 */
export async function saveLastWorkingUrl(url) {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem('camera_server_url', url);
  } catch (err) {
    console.log('Failed to save URL:', err);
  }
}

/**
 * Retrieve the last working server URL
 */
export async function getLastWorkingUrl() {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return await AsyncStorage.getItem('camera_server_url');
  } catch (err) {
    console.log('Failed to get saved URL:', err);
    return null;
  }
}
