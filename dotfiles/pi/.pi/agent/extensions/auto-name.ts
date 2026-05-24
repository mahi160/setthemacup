import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI): void {
  let named = false;
  let abortController: AbortController | undefined;

  pi.on("session_start", () => {
    named = false;
    abortController?.abort();
    abortController = undefined;
  });

  pi.on("agent_end", async (event, ctx) => {
    if (named || pi.getSessionName()) {
      named = true;
      return;
    }

    const userMsgs = event.messages.filter((m) => m.role === "user");
    if (userMsgs.length === 0) return;

    const firstMsg = userMsgs[0];
    let text = "";
    if (typeof firstMsg.content === "string") {
      text = firstMsg.content;
    } else if (Array.isArray(firstMsg.content)) {
      text = firstMsg.content
        .filter((b: any) => b.type === "text" && b.text)
        .map((b: any) => b.text)
        .join(" ");
    }
    text = text.trim();
    if (!text) return;

    named = true;

    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;

    try {
      const apiKey = await ctx.modelRegistry.getApiKeyForProvider("google");
      if (!apiKey) throw new Error("No API Key");

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Create a 3-5 word title for this request: ${text.slice(0, 200)}`,
                  },
                ],
              },
            ],
            generationConfig: { maxOutputTokens: 20, temperature: 0.2 },
          }),
          signal: controller.signal,
        },
      );

      if (!res.ok) throw new Error("API call failed");

      const data = (await res.json()) as any;
      const name = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (name) {
        pi.setSessionName(name.replace(/["']/g, ""));
      } else {
        pi.setSessionName(text.substring(0, 50));
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      pi.setSessionName(text.substring(0, 50));
    } finally {
      if (abortController === controller) abortController = undefined;
    }
  });

  pi.on("session_shutdown", () => {
    abortController?.abort();
    abortController = undefined;
  });
}
