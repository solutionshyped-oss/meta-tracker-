export default async function handler(request, response) {
  try {
    const url = new URL(
      request.url,
      `https://${request.headers.host}`
    );

    // Create tracking ID
    const trackingId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) +
          Math.random().toString(36).slice(2);

    // Collect Meta / UTM data
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

    const redisUrl = process.env.KV_REST_API_URL;
    const redisToken = process.env.KV_REST_API_TOKEN;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    // Your Telegram channel ID
    const channelId = "-1001986231339";

    if (!redisUrl || !redisToken || !botToken) {
      console.error("Missing environment variables");

      return response.status(500).json({
        success: false,
        error: "Tracker configuration is incomplete"
      });
    }

    console.log("META TRACKER CLICK:", data);

    // --------------------------------------------------
    // CREATE TELEGRAM INVITE
    // --------------------------------------------------

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: channelId,
          name: `trk_${trackingId.slice(0, 20)}`,
          creates_join_request: false
        })
      }
    );

    const telegramResult = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramResult.ok) {
      console.error("Telegram invite error:", telegramResult);

      return response.status(500).json({
        success: false,
        error: "Failed to create Telegram invite"
      });
    }

    const inviteLink = telegramResult.result.invite_link;

    console.log("TELEGRAM INVITE CREATED:", inviteLink);

    // --------------------------------------------------
    // EXTRACT INVITE CODE
    // --------------------------------------------------

    let inviteCode = "";

    if (inviteLink.includes("/+")) {
      inviteCode = inviteLink.split("/+")[1];
    } else if (inviteLink.includes("/joinchat/")) {
      inviteCode = inviteLink.split("/joinchat/")[1];
    }

    if (!inviteCode) {
      console.error("Could not extract invite code:", inviteLink);

      return response.status(500).json({
        success: false,
        error: "Could not extract Telegram invite code"
      });
    }

    console.log("INVITE CODE:", inviteCode);

    // --------------------------------------------------
    // SAVE CLICK DATA
    // --------------------------------------------------

    const clickResponse = await fetch(
      `${redisUrl}/set/click:${encodeURIComponent(trackingId)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      }
    );

    if (!clickResponse.ok) {
      console.error(
        "Redis click error:",
        await clickResponse.text()
      );

      return response.status(500).json({
        success: false,
        error: "Failed to save click"
      });
    }

    // --------------------------------------------------
    // IMPORTANT:
    // SAVE USING INVITE CODE
    // --------------------------------------------------

    const inviteKey =
      `invite_code:${encodeURIComponent(inviteCode)}`;

    const inviteResponse = await fetch(
      `${redisUrl}/set/${inviteKey}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json"
        },
        body: trackingId
      }
    );

    if (!inviteResponse.ok) {
      console.error(
        "Redis invite mapping error:",
        await inviteResponse.text()
      );

      return response.status(500).json({
        success: false,
        error: "Failed to save invite mapping"
      });
    }

    console.log(
      "INVITE CODE MAPPED TO TRACKING ID:",
      trackingId
    );

    // --------------------------------------------------
    // INCREMENT CLICKS
    // --------------------------------------------------

    const incrementResponse = await fetch(
      `${redisUrl}/incr/total_clicks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`
        }
      }
    );

    if (!incrementResponse.ok) {
      console.error(
        "Failed to increment total clicks:",
        await incrementResponse.text()
      );
    }

    // --------------------------------------------------
    // SEND USER TO TELEGRAM
    // --------------------------------------------------

    return response.redirect(302, inviteLink);

  } catch (error) {
    console.error("TRACKER ERROR:", error);

    return response.status(500).json({
      success: false,
      error: "Tracker failed"
    });
  }
}
