import { ConfigService } from "@nestjs/config";
import { AiProvider, AiReplyRequest } from "./ai-provider";
import { NPC_SYSTEM_PROMPT, npcUserPrompt } from "./prompts";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function replyText(body: unknown): string {
  const candidate: unknown =
    record(body) && Array.isArray(body.candidates)
      ? body.candidates[0]
      : undefined;
  if (
    !record(candidate) ||
    candidate.finishReason !== "STOP" ||
    !record(candidate.content) ||
    !Array.isArray(candidate.content.parts)
  )
    throw new Error("AI reply was incomplete or blocked.");
  const parts: unknown[] = candidate.content.parts;
  const text = parts
    .map((part) =>
      record(part) && part.thought !== true && typeof part.text === "string"
        ? part.text
        : "",
    )
    .join("")
    .trim();
  if (!text) throw new Error("AI reply was empty.");
  return text;
}

function streamedText(body: unknown): { text: string; stopped: boolean } {
  const candidate: unknown = record(body) && Array.isArray(body.candidates) ? body.candidates[0] : undefined;
  if (!record(candidate)) throw new Error("AI stream chunk was malformed.");
  const finishReason = candidate.finishReason;
  if (finishReason !== undefined && finishReason !== "STOP") throw new Error("AI reply was incomplete or blocked.");
  const parts = record(candidate.content) && Array.isArray(candidate.content.parts) ? candidate.content.parts : [];
  const text = parts.map((part: unknown) => record(part) && part.thought !== true && typeof part.text === "string"
    ? part.text : "").join("");
  return { text, stopped: finishReason === "STOP" };
}

export class GeminiProvider implements AiProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(
    config: ConfigService,
    private readonly request: typeof fetch = fetch,
  ) {
    this.apiKey = config.get<string>("AI_API_KEY")?.trim() ?? "";
    this.model = config.get<string>("AI_MODEL")?.trim() ?? "";
    if (!this.apiKey || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(this.model)) {
      throw new Error("Gemini requires AI_API_KEY and a valid AI_MODEL.");
    }
  }

  async reply(input: AiReplyRequest, signal: AbortSignal): Promise<string> {
    const response = await this.request(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      this.requestOptions(input, signal),
    );
    // Do not include provider bodies/URLs in errors: they can contain private data.
    if (!response.ok) throw new Error("AI provider request failed.");
    const body: unknown = await response.json();
    return replyText(body);
  }

  async *stream(input: AiReplyRequest, signal: AbortSignal): AsyncIterable<string> {
    const response = await this.request(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse`,
      this.requestOptions(input, signal),
    );
    if (!response.ok || !response.body) throw new Error("AI provider stream failed.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let stopped = false;
    const consume = (block: string): { text: string; stopped: boolean } | null => {
      const data = block.split("\n").filter(line => line.startsWith("data:"))
        .map(line => line.slice(5).trim()).join("");
      return data ? streamedText(JSON.parse(data) as unknown) : null;
    };
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replaceAll("\r\n", "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const chunk = consume(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (chunk) { stopped ||= chunk.stopped; if (chunk.text) yield chunk.text; }
        boundary = buffer.indexOf("\n\n");
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const chunk = consume(buffer);
      if (chunk) { stopped ||= chunk.stopped; if (chunk.text) yield chunk.text; }
    }
    if (!stopped) throw new Error("AI stream ended before completion.");
  }

  private requestOptions(input: AiReplyRequest, signal: AbortSignal): RequestInit {
    return {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: input.prompt?.system ?? NPC_SYSTEM_PROMPT }] },
        contents: [
          ...(input.prompt?.history ?? []).map((message) => ({
            role: message.speaker === "player" ? "user" : "model",
            parts: [{ text: message.text }],
          })),
          { role: "user", parts: [{ text: npcUserPrompt(input) }] },
        ],
      }),
    };
  }
}
