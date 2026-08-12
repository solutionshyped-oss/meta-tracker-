export default function handler(request, response) {
  const url = new URL(request.url);

  const trackingId =
    crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);

  const data = {
    tracking_id: trackingId,
    timestamp: new Date().toISOString(),
    fbclid: url.searchParams.get("fbclid"),
    utm_source: url.searchParams.get("utm_source"),
    utm_medium: url.searchParams.get("utm_medium"),
    utm_campaign: url.searchParams.get("utm_campaign"),
    utm_content: url.searchParams.get("utm_content"),
    utm_term: url.searchParams.get("utm_term")
  };

  console.log("META TRACKER CLICK:", data);

  const telegramUrl =
    process.env.TELEGRAM_URL || "https://t.me/";

  const redirectUrl = new URL(telegramUrl);

  redirectUrl.searchParams.set("tracking_id", trackingId);

  return response.redirect(302, redirectUrl.toString());
}
