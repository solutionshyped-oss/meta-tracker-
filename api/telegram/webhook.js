export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(200).json({
      ok: true,
      message: "Telegram webhook is running"
    });
  }

  try {
    const update = request.body;

    console.log(
      "TELEGRAM UPDATE:",
      JSON.stringify(update)
    );

    // We only care about chat_member updates
    if (!update || !update.chat_member) {
      return response.status(200).json({
        ok: true
      });
    }

    const chatMember = update.chat_member;

    const chat = chatMember.chat;
    const oldStatus = chatMember.old_chat_member?.status;
    const newStatus = chatMember.new_chat_member?.status;

    // Your Telegram channel
    const channelId = "-1001986231339";

    // Ignore updates from other chats
    if (!chat || String(chat.id) !== channelId) {
      return response.status(200).json({
        ok: true
      });
    }

    // A real join is usually:
    // old status = left/kicked
    // new status = member
    const isJoin =
      (oldStatus === "left" ||
        oldStatus === "kicked" ||
        oldStatus === undefined) &&
      (newStatus === "member" ||
        newStatus === "administrator");

    if (!isJoin) {
      return response.status(200).json({
        ok: true,
        ignored: true
      });
    }

    const inviteLink =
      chatMember.invite_link;

    if (!inviteLink) {
      console.log(
        "JOIN DETECTED BUT NO INVITE LINK FOUND"
      );

      return response.status(200).json({
        ok: true,
        join: true,
        tracking_id: null,
        reason: "No invite link in Telegram update"
      });
    }

    console.log(
      "JOIN INVITE LINK:",
      inviteLink
    );

    const redisUrl =
      process.env.KV_REST_API_URL;

    const redisToken =
      process.env.KV_REST_API_TOKEN;

    if (!redisUrl || !redisToken) {
      console.error(
        "Redis environment variables are missing"
      );

      return response.status(500).json({
        ok: false,
        error: "Redis is not configured"
      });
    }

    // Find the tracking ID connected to this invite link
    const redisKey =
      `invite:${encodeURIComponent(inviteLink)}`;

    const redisResponse = await fetch(
      `${redisUrl}/get/${redisKey}`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${redisToken}`
        }
      }
    );

    if (!redisResponse.ok) {
      console.error(
        "Redis lookup failed:",
        await redisResponse.text()
      );

      return response.status(500).json({
        ok: false,
        error: "Redis lookup failed"
      });
    }

    const trackingId =
      await redisResponse.text();

    if (
      !trackingId ||
      trackingId === "null"
    ) {
      console.log(
        "NO TRACKING ID FOUND FOR INVITE"
      );

      return response.status(200).json({
        ok: true,
        join: true,
        tracking_id: null
      });
    }

    console.log(
      "TELEGRAM JOIN MATCHED:",
      trackingId
    );

    // Information about the Telegram user
    const user =
      chatMember.new_chat_member?.user || {};

    const joinData = {
      tracking_id: trackingId,
      joined_at: new Date().toISOString(),
      telegram_user_id: user.id || null,
      telegram_username: user.username || null,
      telegram_first_name: user.first_name || null,
      channel_id: channelId,
      invite_link: inviteLink
    };

    console.log(
      "TELEGRAM JOIN DATA:",
      joinData
    );

    // Save the join
    const joinResponse = await fetch(
      `${redisUrl}/set/join:${trackingId}`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${redisToken}`,
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify(joinData)
      }
    );

    if (!joinResponse.ok) {
      console.error(
        "Failed to save Telegram join:",
        await joinResponse.text()
      );

      return response.status(500).json({
        ok: false,
        error: "Failed to save Telegram join"
      });
    }

    // Increment total joins
    const incrementResponse = await fetch(
      `${redisUrl}/incr/total_joins`,
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
        "Failed to increment total joins:",
        await incrementResponse.text()
      );
    }

    return response.status(200).json({
      ok: true,
      join: true,
      tracking_id: trackingId
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
