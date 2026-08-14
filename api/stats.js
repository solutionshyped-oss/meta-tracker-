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

    // --------------------------------------------------
    // TOTAL CLICKS
    // --------------------------------------------------

    const clicksResponse = await fetch(
      `${redisUrl}/get/total_clicks`,
      {
        headers
      }
    );

    const clicksData = await clicksResponse.json();

    const totalClicks =
      Number(clicksData.result || 0);


    // --------------------------------------------------
    // TOTAL JOINS
    // --------------------------------------------------

    const joinsResponse = await fetch(
      `${redisUrl}/get/total_joins`,
      {
        headers
      }
    );

    const joinsData = await joinsResponse.json();

    const totalJoins =
      Number(joinsData.result || 0);


    // --------------------------------------------------
    // CONVERSION RATE
    // --------------------------------------------------

    const conversion =
      totalClicks > 0
        ? (totalJoins / totalClicks) * 100
        : 0;

    const conversionRate =
      conversion.toFixed(2) + "%";


    // --------------------------------------------------
    // GET CLICK KEYS
    // --------------------------------------------------

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


        // Get individual click records
        for (const key of keys.slice(0, 100)) {

          try {

            const keyName =
              String(key).replace(/^click:/, "");

            const clickResponse =
              await fetch(
                `${redisUrl}/get/${encodeURIComponent(
                  "click:" + keyName
                )}`,
                {
                  headers
                }
              );

            if (!clickResponse.ok) {
              continue;
            }

            const clickData =
              await clickResponse.json();

            if (!clickData.result) {
              continue;
            }

            let record = clickData.result;

            // Redis may return JSON as a string
            if (typeof record === "string") {

              try {
                record = JSON.parse(record);
              } catch {
                continue;
              }

            }

            clicks.push({
              tracking_id:
                record.tracking_id || keyName,

              timestamp:
                record.timestamp || null,

              fbclid:
                record.fbclid || null,

              utm_source:
                record.utm_source || null,

              utm_medium:
                record.utm_medium || null,

              utm_campaign:
                record.utm_campaign || null,

              utm_content:
                record.utm_content || null,

              utm_term:
                record.utm_term || null
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


    // --------------------------------------------------
    // SORT NEWEST FIRST
    // --------------------------------------------------

    clicks.sort(
      (a, b) =>
        new Date(b.timestamp || 0) -
        new Date(a.timestamp || 0)
    );


    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return response.status(200).json({

      success: true,

      total_clicks:
        totalClicks,

      total_joins:
        totalJoins,

      conversion_rate:
        conversionRate,

      clicks:
        clicks

    });

  } catch (error) {

    console.error(
      "STATS ERROR:",
      error
    );

    return response.status(500).json({
      success: false,
      error: "Failed to load statistics"
    });

  }
}
