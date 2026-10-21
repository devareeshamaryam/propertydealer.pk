import { getSiteSettings } from '@/lib/site-settings.server';
import { adsTxtLine } from '@/lib/ads';

/*
 * /ads.txt — tells ad buyers which ad networks may sell this site's ads.
 * AdSense warns ("Earnings at risk") and pays less without it. Written from
 * the publisher id in Settings → Ads, so changing it there is enough.
 */
export const revalidate = 3600;

export async function GET() {
  const s = await getSiteSettings();
  const body = s.adsClient ? `${adsTxtLine(s.adsClient)}\n` : '';
  return new Response(body, {
    status: s.adsClient ? 200 : 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
