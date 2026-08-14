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

    // Only process chat_member updates
    if (!update || !update.chat_member) {
      return response.status(200).json({
        ok: true
      });
    }

    const chatMember = update.chat_member;
    const chat = chatMember.chat;

    const oldStatus =
      chatMember.old_chat_member?.status;

    const newStatus =
      chatMember.new_chat_member?.status;

    // Your Telegram channel ID
    const channelId = "-1001986231339";

    // Ignore updates from other chats
    if (!chat || String(chat.id) !== channelId) {
      return response.status(200).json({
        ok: true,
        ignored: true
      });
    }

    // Detect a new member
    const isJoin =
      (
        oldStatus === "left" ||
        oldStatus === "kicked" ||
        oldStatus === undefined
      ) &&
      (
        newStatus === "member" ||
        newStatus === "administrator"
      );

    if (!isJoin) {
      return response.status(200).json({
        ok: true,
        ignored: true
      });
    }

    // Telegram sends invite_link as an object.
    // We need the actual invite URL from inside it.
    const inviteLink =
      chatMember.invite_link?.invite_link;

    if (!inviteLink) {
      console.log(
        "JOIN DETECTED BUT NO INVITE LINK FOUND"
      );

      return response.status(200).json({
        ok: true,
        join: true,
        tracking_id: null,
        reason: "No invite link"
      });
    }

    console.log(
      "JOIN INVITE LINK:",
      inviteLink
    );

    // Redis configuration
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

    // This must match the key created by go.js
    const redisKey =
      `invite:${encodeURIComponent(inviteLink)}`;

    console.log(
      "REDIS LOOKUP KEY:",
      redisKey
    );

    // Look up the tracking ID
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
      const errorText =
        await redisResponse.text();

      console.error(
        "Redis lookup failed:",
        errorText
      );

      return response.status(500).json({
        ok: false,
        error: "Redis lookup failed"
      });
    }

    // Upstash Redis REST returns:
    // { "result": "tracking-id" }
    const redisData =
      await redisResponse.json();

    console.log(
      "REDIS LOOKUP RESULT:",
      redisData
    );

    const trackingId =
      redisData.result;

    if (!trackingId) {
      console.log(
        "NO TRACKING ID FOUND FOR INVITE"
      );

      return response.status(200).json({
        ok: true,
        join: true,
        tracking_id: null,
        reason: "Invite link not found in Redis"
      });
    }

    console.log(
      "TELEGRAM JOIN MATCHED:",
      trackingId
    );

    // Telegram user information
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

    // Save the Telegram join
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
      const errorText =
        await joinResponse.text();

      console.error(
        "Failed to save Telegram join:",
        errorText
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

    console.log(
      "TELEGRAM JOIN SAVED SUCCESSFULLY:",
      trackingId
    );

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
