export default async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return response.status(500).json({
      ok: false,
      error: "TELEGRAM_BOT_TOKEN is missing"
    });
  }

  const webhookUrl =
    "https://meta-tracker-rho.vercel.app/api/telegram/webhook";

  try {
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["chat_member"],
          drop_pending_updates: true
        })
      }
    );

    const result = await telegramResponse.json();

    return response.status(200).json(result);

  } catch (error) {
    console.error("Telegram setup error:", error);

    return response.status(500).json({
      ok: false,
      error: "Failed to configure Telegram webhook"
    });
  }
}
