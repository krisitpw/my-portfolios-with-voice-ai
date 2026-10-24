export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  res.setHeader("Cache-Control", "no-store");

  return res.status(200).json({
    configured: Boolean(
      process.env.DEEPGRAM_API_KEY?.trim()
    ),
    provider: "Deepgram",
    voice: process.env.DEEPGRAM_TTS_MODEL || "flux-naveen-en",
    accent: "Indian English",
    transport: "websocket",
  });
}