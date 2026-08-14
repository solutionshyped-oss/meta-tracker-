export default async function handler(request, response) {
  try {
    const redisUrl = process.env.KV_REST_API_URL;
    const redisToken = process.env.KV_REST_API_TOKEN;

    if (!redisUrl || !redisToken) {
      return response.status(500).json({
        success: false,
        error: "Redis configuration missing"
      });
    }

    // Get total clicks
    const clicksResponse = await fetch(
      `${redisUrl}/get/total_clicks`,
      {
        headers: {
          Authorization: `Bearer ${redisToken}`
        }
      }
    );

    const clicksData = await clicksResponse.json();

    // Get total joins
    const joinsResponse = await fetch(
      `${redisUrl}/get/total_joins`,
      {
        headers: {
          Authorization: `Bearer ${redisToken}`
        }
      }
    );

    const joinsData = await joinsResponse.json();

    const totalClicks =
      Number(clicksData.result || 0);

    const totalJoins =
      Number(joinsData.result || 0);

    const conversionRate =
      totalClicks > 0
        ? ((totalJoins / totalClicks) * 100).toFixed(2)
        : "0.00";

    return response.status(200).json({
      success: true,
      total_clicks: totalClicks,
      total_joins: totalJoins,
      conversion_rate: `${conversionRate}%`
    });

  } catch (error) {
    console.error("STATS ERROR:", error);

    return response.status(500).json({
      success: false,
      error: "Failed to load statistics"
    });
  }
}
