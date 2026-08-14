export default async function handler(request, response) {
  try {
    const redisUrl = process.env.KV_REST_API_URL;
    const redisToken = process.env.KV_REST_API_TOKEN;

    if (!redisUrl || !redisToken) {
      return response.status(500).json({
        success: false,
        error: "Redis configuration is missing"
      });
    }

    const headers = {
      Authorization: `Bearer ${redisToken}`
    };

    // ==========================================
    // HELPER: GET REDIS VALUE
    // ==========================================

    async function getRedis(key) {
      try {
        const result = await fetch(
          `${redisUrl}/get/${encodeURIComponent(key)}`,
          {
            headers
          }
        );

        if (!result.ok) {
          return null;
        }

        const data = await result.json();

        return data.result ?? null;
      } catch {
        return null;
      }
    }

    // ==========================================
    // TOTAL CLICKS
    // ==========================================

    const clicksValue =
      await getRedis("total_clicks");

    const totalClicks =
      Number(clicksValue || 0);

    // ==========================================
    // TOTAL JOIN REQUESTS
    // ==========================================

    const requestsValue =
      await getRedis("total_join_requests");

    const totalRequests =
      Number(requestsValue || 0);

    // ==========================================
    // TOTAL APPROVED / JOINS
    // ==========================================

    const joinsValue =
      await getRedis("total_joins");

    const totalJoins =
      Number(joinsValue || 0);

    // ==========================================
    // PENDING REQUESTS
    // ==========================================

    let pendingRequests = 0;

    // ==========================================
    // GET CLICK RECORDS
    // ==========================================

    let clicks = [];

    try {
      const scanResponse = await fetch(
        `${redisUrl}/scan/0/match/click:*`,
        {
          headers
        }
      );

      if (scanResponse.ok) {
        const scanData =
          await scanResponse.json();

        const keys =
          scanData.result?.[1] || [];

        for (const key of keys.slice(0, 100)) {
          try {
            const keyName =
              String(key).replace(
                /^click:/,
                ""
              );

            const recordValue =
              await getRedis(
                "click:" + keyName
              );

            if (!recordValue) {
              continue;
            }

            let record =
              recordValue;

            if (typeof record === "string") {
              try {
                record =
                  JSON.parse(record);
              } catch {
                continue;
              }
            }

            clicks.push({
              tracking_id:
                record.tracking_id ||
                keyName,

              timestamp:
                record.timestamp ||
                null,

              fbclid:
                record.fbclid ||
                null,

              utm_source:
                record.utm_source ||
                null,

              utm_medium:
                record.utm_medium ||
                null,

              utm_campaign:
                record.utm_campaign ||
                null,

              utm_content:
                record.utm_content ||
                null,

              utm_term:
                record.utm_term ||
                null
            });

          } catch (error) {
            console.error(
              "Failed to read click:",
              error
            );
          }
        }
      }

    } catch (error) {
      console.error(
        "Click scan error:",
        error
      );
    }

    // ==========================================
    // GET JOIN REQUEST RECORDS
    // ==========================================

    let requests = [];

    try {
      const scanResponse = await fetch(
        `${redisUrl}/scan/0/match/join_request:*`,
        {
          headers
        }
      );

      if (scanResponse.ok) {
        const scanData =
          await scanResponse.json();

        const keys =
          scanData.result?.[1] || [];

        for (const key of keys.slice(0, 100)) {
          try {
            const keyName =
              String(key).replace(
                /^join_request:/,
                ""
              );

            const recordValue =
              await getRedis(
                "join_request:" + keyName
              );

            if (!recordValue) {
              continue;
            }

            let record =
              recordValue;

            if (typeof record === "string") {
              try {
                record =
                  JSON.parse(record);
              } catch {
                continue;
              }
            }

            requests.push({
              tracking_id:
                record.tracking_id ||
                keyName,

              telegram_user_id:
                record.telegram_user_id ||
                null,

              telegram_username:
                record.telegram_username ||
                null,

              first_name:
                record.first_name ||
                null,

              requested_at:
                record.requested_at ||
                null,

              status:
                record.status ||
                "pending"
            });

          } catch (error) {
            console.error(
              "Failed to read join request:",
              error
            );
          }
        }
      }

    } catch (error) {
      console.error(
        "Join request scan error:",
        error
      );
    }

    // ==========================================
    // CALCULATE PENDING
    // ==========================================

    pendingRequests =
      requests.filter(
        request =>
          request.status === "pending"
      ).length;

    // ==========================================
    // CONVERSION RATE
    // ==========================================

    const conversion =
      totalClicks > 0
        ? (totalJoins / totalClicks) * 100
        : 0;

    const conversionRate =
      conversion.toFixed(2) + "%";

    // ==========================================
    // REQUEST RATE
    // ==========================================

    const requestRate =
      totalClicks > 0
        ? ((totalRequests / totalClicks) * 100)
            .toFixed(2) + "%"
        : "0%";

    // ==========================================
    // SORT CLICKS
    // ==========================================

    clicks.sort(
      (a, b) =>
        new Date(b.timestamp || 0) -
        new Date(a.timestamp || 0)
    );

    // ==========================================
    // RESPONSE
    // ==========================================

    return response.status(200).json({
      success: true,

      total_clicks:
        totalClicks,

      total_requests:
        totalRequests,

      pending_requests:
        pendingRequests,

      total_joins:
        totalJoins,

      approved:
        totalJoins,

      conversion_rate:
        conversionRate,

      request_rate:
        requestRate,

      clicks:
        clicks,

      requests:
        requests
    });

  } catch (error) {

    console.error(
      "STATS ERROR:",
      error
    );

    return response.status(500).json({
      success: false,
      error:
        "Failed to load statistics"
    });
  }
}
