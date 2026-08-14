export default async function handler(request, response) {
  try {
    const url = new URL(
      request.url,
      `https://${request.headers.host}`
    );

    // Create unique tracking ID
    const trackingId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) +
          Math.random().toString(36).slice(2);

    // Collect Meta / UTM information
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

    // Environment variables
    const redisUrl = process.env.KV_REST_API_URL;
    const redisToken = process.env.KV_REST_API_TOKEN;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    // Telegram channel ID
    const channelId = "-1001986231339";

    // Check configuration
    if (!redisUrl || !redisToken || !botToken) {
      console.error("Required environment variables are missing");

      return response.status(500).json({
        success: false,
        error: "Tracker configuration is incomplete"
      });
    }

    console.log("META TRACKER CLICK:", data);

    // --------------------------------------------------
    // 1. CREATE UNIQUE TELEGRAM INVITE LINK
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

    const telegramResult =
      await telegramResponse.json();

    if (!telegramResponse.ok || !telegramResult.ok) {
      console.error(
        "Telegram invite creation error:",
        telegramResult
      );

      return response.status(500).json({
        success: false,
        error: "Failed to create Telegram invite link"
      });
    }

    const inviteLink =
      telegramResult.result.invite_link;

    console.log(
      "TELEGRAM INVITE CREATED:",
      inviteLink
    );

    // --------------------------------------------------
    // 2. GET ONLY THE UNIQUE INVITE CODE
    // --------------------------------------------------

    const inviteCode =
      inviteLink.split("/").pop();

    if (!inviteCode) {
      console.error(
        "Could not extract Telegram invite code"
      );

      return response.status(500).json({
        success: false,
        error: "Invalid Telegram invite link"
      });
    }

    console.log(
      "TELEGRAM INVITE CODE:",
      inviteCode
    );

    // --------------------------------------------------
    // 3. SAVE CLICK DATA
    // --------------------------------------------------

    const clickResponse = await fetch(
      `${redisUrl}/set/click:${trackingId}`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${redisToken}`,
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify(data)
      }
    );

    if (!clickResponse.ok) {
      const redisError =
        await clickResponse.text();

      console.error(
        "Redis click error:",
        redisError
      );

      return response.status(500).json({
        success: false,
        error: "Failed to save click"
      });
    }

    // --------------------------------------------------
    // 4. SAVE INVITE CODE → TRACKING ID
    // --------------------------------------------------

    const encodedInviteCode =
      encodeURIComponent(inviteCode);

    const inviteResponse = await fetch(
      `${redisUrl}/set/invite_code:${encodedInviteCode}`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${redisToken}`,
          "Content-Type":
            "application/json"
        },
        body: trackingId
      }
    );

    if (!inviteResponse.ok) {
      const redisError =
        await inviteResponse.text();

      console.error(
        "Redis invite mapping error:",
        redisError
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
    // 5. INCREMENT TOTAL CLICKS
    // --------------------------------------------------

    const incrementResponse =
      await fetch(
        `${redisUrl}/incr/total_clicks`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${redisToken}`
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
    // 6. REDIRECT USER TO TELEGRAM
    // --------------------------------------------------

    return response.redirect(
      302,
      inviteLink
    );

  } catch (error) {
    console.error(
      "TRACKER ERROR:",
      error
    );

    return response.status(500).json({
      success: false,
      error: "Tracker failed"
    });
  }
}
