export default async function handler(request, response) {
  try {
    // Telegram sends POST requests
    if (request.method !== "POST") {
      return response.status(200).json({
        ok: true,
        message: "Telegram webhook is running"
      });
    }

    const update = request.body;

    console.log(
      "TELEGRAM UPDATE:",
      JSON.stringify(update)
    );

    // --------------------------------------------------
    // ONLY PROCESS CHAT MEMBER UPDATES
    // --------------------------------------------------

    const chatMember = update?.chat_member;

    if (!chatMember) {
      return response.status(200).json({
        ok: true,
        message: "No chat_member update"
      });
    }

    // --------------------------------------------------
    // GET INVITE LINK USED BY USER
    // --------------------------------------------------

    const inviteLink =
      chatMember.invite_link;

    if (!inviteLink) {
      console.log(
        "NO INVITE LINK FOUND IN TELEGRAM UPDATE"
      );

      return response.status(200).json({
        ok: true,
        message: "No invite link"
      });
    }

    console.log(
      "TELEGRAM INVITE LINK:",
      JSON.stringify(inviteLink)
    );

    // --------------------------------------------------
    // EXTRACT INVITE CODE
    // --------------------------------------------------

    let inviteCode = "";

    if (inviteLink.invite_link) {
      const fullLink = inviteLink.invite_link;

      if (fullLink.includes("/+")) {
        inviteCode = fullLink.split("/+")[1];
      } else if (fullLink.includes("/joinchat/")) {
        inviteCode = fullLink.split("/joinchat/")[1];
      }
    }

    if (!inviteCode) {
      console.log(
        "NO INVITE CODE FOUND"
      );

      return response.status(200).json({
        ok: true,
        message: "No invite code"
      });
    }

    console.log(
      "TELEGRAM INVITE CODE:",
      inviteCode
    );

    // --------------------------------------------------
    // REDIS
    // --------------------------------------------------

    const redisUrl =
      process.env.KV_REST_API_URL;

    const redisToken =
      process.env.KV_REST_API_TOKEN;

    if (!redisUrl || !redisToken) {
      console.error(
        "Redis environment variables missing"
      );

      return response.status(500).json({
        ok: false,
        error: "Redis configuration missing"
      });
    }

    // --------------------------------------------------
    // FIND TRACKING ID
    // --------------------------------------------------

    const inviteKey =
      `invite_code:${encodeURIComponent(inviteCode)}`;

    const trackingResponse = await fetch(
      `${redisUrl}/get/${inviteKey}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${redisToken}`
        }
      }
    );

    if (!trackingResponse.ok) {
      console.error(
        "Redis lookup error:",
        await trackingResponse.text()
      );

      return response.status(200).json({
        ok: true,
        message: "Redis lookup failed"
      });
    }

    const trackingResult =
      await trackingResponse.json();

    const trackingId =
      trackingResult.result;

    // --------------------------------------------------
    // NO TRACKING ID
    // --------------------------------------------------

    if (!trackingId) {
      console.log(
        "NO TRACKING ID FOUND FOR INVITE CODE:",
        inviteCode
      );

      return response.status(200).json({
        ok: true,
        message: "No tracking ID found"
      });
    }

    console.log(
      "TRACKING ID FOUND:",
      trackingId
    );

    // --------------------------------------------------
    // GET USER INFORMATION
    // --------------------------------------------------

    const user =
      chatMember.new_chat_member?.user ||
      chatMember.from;

    const userId =
      user?.id || null;

    const username =
      user?.username || null;

    const firstName =
      user?.first_name || null;

    const joinedAt =
      new Date().toISOString();

    // --------------------------------------------------
    // SAVE JOIN DATA
    // --------------------------------------------------

    const joinData = {
      tracking_id: trackingId,
      invite_code: inviteCode,
      telegram_user_id: userId,
      telegram_username: username,
      first_name: firstName,
      joined_at: joinedAt
    };

    console.log(
      "TELEGRAM JOIN DATA:",
      joinData
    );

    const joinResponse = await fetch(
      `${redisUrl}/set/join:${encodeURIComponent(trackingId)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(joinData)
      }
    );

    if (!joinResponse.ok) {
      console.error(
        "Redis join save error:",
        await joinResponse.text()
      );
    }

    // --------------------------------------------------
    // INCREMENT TOTAL JOINS
    // --------------------------------------------------

    const incrementResponse = await fetch(
      `${redisUrl}/incr/total_joins`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`
        }
      }
    );

    if (!incrementResponse.ok) {
      console.error(
        "Failed to increment joins:",
        await incrementResponse.text()
      );
    }

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    return response.status(200).json({
      ok: true,
      tracking_id: trackingId,
      invite_code: inviteCode
    });

  } catch (error) {
    console.error(
      "WEBHOOK ERROR:",
      error
    );

    return response.status(500).json({
      ok: false,
      error: "Webhook failed"
    });
  }
}
