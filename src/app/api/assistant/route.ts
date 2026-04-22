import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, type FunctionDeclaration } from "@google/genai";
import { requireUser } from "@/lib/supabase/server";
import {
  toolDeclarations,
  runTool,
  systemPrompt,
} from "@/lib/gemini/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "model"; content: string };
interface AssistantRequest {
  messages: ChatMessage[];
}
interface ToolTrace {
  name: string;
  args: Record<string, unknown>;
  summary: string;
}

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    ({ user: { id: userId } } = await requireUser());
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured." },
      { status: 500 }
    );
  }

  let body: AssistantRequest;
  try {
    body = (await req.json()) as AssistantRequest;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages must be a non-empty array" },
      { status: 400 }
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Translate each tool's JSON Schema — omit empty properties/required
    // because the Gemini API rejects `{}`.
    const functionDeclarations: FunctionDeclaration[] = toolDeclarations.map(
      (t) => {
        const params = t.parameters as {
          type: string;
          properties?: Record<string, unknown>;
          required?: string[];
        };
        const hasProps =
          params.properties && Object.keys(params.properties).length > 0;
        const schema: Record<string, unknown> = { type: "object" };
        if (hasProps) schema.properties = params.properties;
        if (hasProps && params.required && params.required.length > 0) {
          schema.required = params.required;
        }
        return {
          name: t.name,
          description: t.description,
          parametersJsonSchema: schema,
        };
      }
    );

    const contents: Array<{ role: "user" | "model"; parts: unknown[] }> =
      messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));

    const traces: ToolTrace[] = [];
    const MAX_ITER = 6;
    let finalText = "";

    for (let i = 0; i < MAX_ITER; i++) {
      const resp = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        // @ts-expect-error — contents typed loosely to support the tool loop.
        contents,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations }],
          temperature: 0.3,
        },
      });

      const candidate = resp.candidates?.[0];
      const parts = (candidate?.content?.parts ?? []) as Array<{
        text?: string;
        functionCall?: { name?: string; args?: Record<string, unknown> };
      }>;
      const fnCalls = parts.filter((p) => p.functionCall?.name);
      const textParts = parts
        .filter((p) => typeof p.text === "string")
        .map((p) => p.text ?? "")
        .join("");

      if (fnCalls.length === 0) {
        finalText = textParts || "(no response)";
        break;
      }

      contents.push({ role: "model", parts: fnCalls });

      const responseParts: unknown[] = [];
      for (const p of fnCalls) {
        const fc = p.functionCall;
        if (!fc || !fc.name) continue;
        const args = (fc.args as Record<string, unknown>) ?? {};
        try {
          const result = await runTool(userId, fc.name, args);
          traces.push({
            name: fc.name,
            args,
            summary: summarize(fc.name, result),
          });
          responseParts.push({
            functionResponse: { name: fc.name, response: { result } },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "tool failed";
          traces.push({ name: fc.name, args, summary: `error: ${msg}` });
          responseParts.push({
            functionResponse: {
              name: fc.name,
              response: { result: { error: msg } },
            },
          });
        }
      }
      contents.push({ role: "user", parts: responseParts });
    }

    return NextResponse.json({ text: finalText, tools: traces });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "assistant failed";
    console.error("[assistant] error:", msg, err);
    return NextResponse.json(
      { error: `Assistant error: ${msg}` },
      { status: 500 }
    );
  }
}

function summarize(name: string, result: unknown): string {
  try {
    if (name === "getPortfolioSummary") {
      const r = result as { netWorth: number; positionCount: number };
      return `net worth $${Math.round(r.netWorth ?? 0).toLocaleString()}, ${r.positionCount ?? 0} positions`;
    }
    if (name === "getHoldings") {
      const arr = result as unknown[];
      return `${arr.length} holdings`;
    }
    if (name === "getSyncStatus") {
      const arr = result as unknown[];
      return `${arr.length} log entries`;
    }
    if (name === "updatePreferences" || name === "updateProfile")
      return "updated";
    return "ok";
  } catch {
    return "ok";
  }
}
