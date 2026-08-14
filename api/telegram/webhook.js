module.exports = async function handler(request, response) {
  try {
    // ==========================================
    // ONLY ACCEPT TELEGRAM POST REQUESTS
    // ==========================================

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

    // ==========================================
    // REDIS
    // ==========================================

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

    // ==========================================
    // REQUEST TO JOIN
    // ==========================================

    const joinRequest =
      update?.chat_join_request;

    if (joinRequest) {

      console.log(
        "TELEGRAM JOIN REQUEST:",
        JSON.stringify(joinRequest)
      );

      // ------------------------------------------
      // GET INVITE LINK
      // ------------------------------------------

      const inviteLink =
        joinRequest.invite_link?.invite_link;

      if (!inviteLink) {

        console.log(
          "NO INVITE LINK FOUND IN JOIN REQUEST"
        );

        return response.status(200).json({
          ok: true,
          message: "No invite link"
        });
      }

      console.log(
        "JOIN REQUEST INVITE LINK:",
        inviteLink
      );

      // ------------------------------------------
      // FIND TRACKING ID
      // ------------------------------------------

      const inviteKey =
        `invite:${encodeURIComponent(inviteLink)}`;

      const trackingResponse =
        await fetch(
          `${redisUrl}/get/${inviteKey}`,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${redisToken}`
            }
          }
        );

      if (!trackingResponse.ok) {

        console.error(
          "Redis invite lookup error:",
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

      // ------------------------------------------
      // NO TRACKING ID
      // ------------------------------------------

      if (!trackingId) {

        console.log(
          "NO TRACKING ID FOUND FOR INVITE:",
          inviteLink
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

      // ------------------------------------------
      // USER INFORMATION
      // ------------------------------------------

      const user =
        joinRequest.from;

      const userId =
        user?.id || null;

      const username =
        user?.username || null;

      const firstName =
        user?.first_name || null;

      const requestDate =
        new Date().toISOString();

      // ------------------------------------------
      // SAVE JOIN REQUEST
      // ------------------------------------------

      const requestData = {
        tracking_id: trackingId,

        invite_link: inviteLink,

        telegram_user_id: userId,

        telegram_username: username,

        first_name: firstName,

        requested_at: requestDate,

        status: "pending"
      };

      console.log(
        "TELEGRAM JOIN REQUEST DATA:",
        requestData
      );

      const requestResponse =
        await fetch(
          `${redisUrl}/set/join_request:${encodeURIComponent(trackingId)}`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${redisToken}`,

              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(requestData)
          }
        );

      if (!requestResponse.ok) {

        console.error(
          "Redis join request save error:",
          await requestResponse.text()
        );

      }

      // ------------------------------------------
      // INCREMENT TOTAL REQUESTS
      // ------------------------------------------

      const incrementResponse =
        await fetch(
          `${redisUrl}/incr/total_join_requests`,
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
          "Failed to increment join requests:",
          await incrementResponse.text()
        );

      }

      return response.status(200).json({
        ok: true,

        type: "chat_join_request",

        tracking_id: trackingId,

        telegram_user_id: userId,

        status: "pending"
      });
    }

    // ==========================================
    // CHAT MEMBER UPDATE
    //
    // This happens when the user actually
    // becomes a member.
    // ==========================================

    const chatMember =
      update?.chat_member;

    if (chatMember) {

      console.log(
        "TELEGRAM CHAT MEMBER UPDATE:",
        JSON.stringify(chatMember)
      );

      // ------------------------------------------
      // CHECK MEMBER STATUS
      // ------------------------------------------

      const newStatus =
        chatMember.new_chat_member?.status;

      const oldStatus =
        chatMember.old_chat_member?.status;

      /*
       * We only count a real join.
       *
       * Common transition:
       *
       * left / kicked
       *        ↓
       * member
       */

      const becameMember =
        newStatus === "member" &&
        oldStatus !== "member";

      if (!becameMember) {

        return response.status(200).json({
          ok: true,
          message: "Not a new member"
        });
      }

      // ------------------------------------------
      // GET INVITE LINK
      // ------------------------------------------

      const inviteLink =
        chatMember.invite_link?.invite_link;

      if (!inviteLink) {

        console.log(
          "NO INVITE LINK FOUND IN CHAT MEMBER UPDATE"
        );

        return response.status(200).json({
          ok: true,
          message: "No invite link"
        });
      }

      console.log(
        "MEMBER INVITE LINK:",
        inviteLink
      );

      // ------------------------------------------
      // FIND TRACKING ID
      // ------------------------------------------

      const inviteKey =
        `invite:${encodeURIComponent(inviteLink)}`;

      const trackingResponse =
        await fetch(
          `${redisUrl}/get/${inviteKey}`,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${redisToken}`
            }
          }
        );

      if (!trackingResponse.ok) {

        console.error(
          "Redis member invite lookup error:",
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

      if (!trackingId) {

        console.log(
          "NO TRACKING ID FOUND FOR MEMBER INVITE"
        );

        return response.status(200).json({
          ok: true,
          message: "No tracking ID found"
        });
      }

      console.log(
        "MEMBER TRACKING ID FOUND:",
        trackingId
      );

      // ------------------------------------------
      // USER INFORMATION
      // ------------------------------------------

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

      // ------------------------------------------
      // SAVE CONFIRMED JOIN
      // ------------------------------------------

      const joinData = {

        tracking_id:
          trackingId,

        invite_link:
          inviteLink,

        telegram_user_id:
          userId,

        telegram_username:
          username,

        first_name:
          firstName,

        joined_at:
          joinedAt,

        status:
          "joined"
      };

      console.log(
        "TELEGRAM JOIN DATA:",
        joinData
      );

      const joinResponse =
        await fetch(
          `${redisUrl}/set/join:${encodeURIComponent(trackingId)}`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${redisToken}`,

              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(joinData)
          }
        );

      if (!joinResponse.ok) {

        console.error(
          "Redis join save error:",
          await joinResponse.text()
        );

      }

      // ------------------------------------------
      // INCREMENT TOTAL CONFIRMED JOINS
      // ------------------------------------------

      const incrementResponse =
        await fetch(
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

        type:
          "chat_member",

        tracking_id:
          trackingId,

        telegram_user_id:
          userId,

        status:
          "joined"

      });
    }

    // ==========================================
    // OTHER TELEGRAM UPDATES
    // ==========================================

    return response.status(200).json({
      ok: true,
      message: "Update received but not relevant"
    });

  } catch (error) {

    console.error(
      "WEBHOOK ERROR:",
      error
    );

    return response.status(500).json({
      ok: false,
      error: "Webhook failed",
      message: error.message
    });
  }
};
