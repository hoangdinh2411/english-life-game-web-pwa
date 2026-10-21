import {
  conversationTurnSchema,
  type ChatStreamRequest,
  type ConversationTurn,
} from "@life-abroad/shared";

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1";

function messageFrom(value: unknown, fallback: string): string {
  if (typeof value !== "object" || value === null || !("message" in value))
    return fallback;
  return typeof value.message === "string" ? value.message : fallback;
}

export async function readChatStream(
  response: Response,
  onToken: (text: string) => void,
): Promise<ConversationTurn> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const nested =
      typeof body === "object" && body !== null && "error" in body
        ? body.error
        : body;
    const error = new Error(
      messageFrom(nested, `Chat request failed (${response.status}).`),
    );
    Object.assign(error, { status: response.status });
    throw error;
  }
  if (!response.body)
    throw new Error("The chat stream did not start. Try again.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed: ConversationTurn | null = null;
  const consume = (block: string): void => {
    let event = "",
      data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!event || !data) return;
    const value: unknown = JSON.parse(data);
    console.log(value);
    if (
      event === "token" &&
      typeof value === "object" &&
      value !== null &&
      "text" in value &&
      typeof value.text === "string"
    )
      onToken(value.text);
    else if (
      event === "done" &&
      typeof value === "object" &&
      value !== null &&
      "turn" in value
    )
      completed = conversationTurnSchema.parse(value.turn);
    else if (event === "error")
      throw new Error(
        messageFrom(value, "Chat is unavailable right now. Try again."),
      );
  };
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replaceAll("\r\n", "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      consume(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
    if (done) break;
  }
  if (buffer.trim()) consume(buffer);
  if (!completed)
    throw new Error(
      "The chat reply ended before it was saved. Retry your message.",
    );
  return completed;
}

export async function streamChat(
  token: string,
  request: ChatStreamRequest,
  onToken: (text: string) => void,
  signal: AbortSignal,
): Promise<ConversationTurn> {
  if (!navigator.onLine)
    throw new Error("You’re offline. Reconnect to chat; nothing was queued.");
  const response = await fetch(`${baseUrl}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
    cache: "no-store",
    signal,
  });
  return readChatStream(response, onToken);
}
