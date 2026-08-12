export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(200).json({
      ok: true,
      message: "Telegram webhook is running"
    });
  }

  try {
    const update = request.body;

    console.log("TELEGRAM UPDATE:", JSON.stringify(update));

    return response.status(200).json({
      ok: true
    });

  } catch (error) {
    console.error("WEBHOOK ERROR:", error);

    return response.status(500).json({
      ok: false
    });
  }
}
