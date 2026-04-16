const INDEXNOW_API_KEY = process.env.NEXT_PUBLIC_INDEXNOW_KEY || '8837ca2e8f774e069922248ec058f3ae';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://propertydealer.pk';

/**
 * Utility to proactively notify search engines of new or updated content via IndexNow.
 * Supported by Bing, Yandex, Seznam.cz, etc.
 * 
 * @param urls Array of URLs to submit (full paths)
 */
export async function submitToIndexNow(urls: string[]) {
  if (!urls || urls.length === 0) return;

  const endpoint = 'https://api.indexnow.org/IndexNow';
  const host = new URL(BASE_URL).hostname;

  const data = {
    host: host,
    key: INDEXNOW_API_KEY,
    keyLocation: `${BASE_URL}/${INDEXNOW_API_KEY}.txt`,
    urlList: urls,
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      console.log('✅ IndexNow submission successful:', urls);
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ IndexNow submission failed:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('💥 IndexNow submission error:', error);
    return false;
  }
}

/**
 * Utility to notify search engines about a single property update.
 * 
 * @param slug Property slug
 */
export async function indexProperty(slug: string) {
  return submitToIndexNow([`${BASE_URL}/properties/${slug}`]);
}

/**
 * Utility to notify search engines about a new blog post.
 * 
 * @param slug Blog slug
 */
export async function indexBlog(slug: string) {
  return submitToIndexNow([`${BASE_URL}/blog/${slug}`]);
}
