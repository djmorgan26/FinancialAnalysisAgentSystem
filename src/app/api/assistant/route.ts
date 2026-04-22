import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type, type FunctionDeclaration } from "@google/genai";
import { requireUser } from "@/lib/supabase/server";
import {
  toolDeclarations,
  runTool,
  systemPrompt,
} from "@/lib/gemini/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "user" | "model";
  content: string;
};

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
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const { messages } = (await req.json()) as AssistantRequest;

  const ai = new GoogleGenAI({ apiKey });

  // Convert JSON Schema parameter shapes into Gemini's FunctionDeclaration format.
  const functionDeclarations: FunctionDeclaration[] = toolDeclarations.map(
    (t) => ({
      name: t.name,
      description: t.description,
      parameters: toGeminiSchema(
        t.parameters as unknown as JsonSchemaObject
      ) as FunctionDeclaration["parameters"],
    })
  );

  // Build the conversation for Gemini: preserve the final user message for
  // iterative tool-calling loop (we push function responses back into contents).
  const contents: Array<{
    role: "user" | "model";
    parts: unknown[];
  }> = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  const traces: ToolTrace[] = [];
  const MAX_ITER = 6;
  let finalText = "";

  for (let i = 0; i < MAX_ITER; i++) {
    const resp = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      // @ts-expect-error — contents parts typed loosely to satisfy iterative tool loop.
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
      finalText = textParts;
      break;
    }

    // Record the model's request turn in contents so Gemini sees its own call.
    contents.push({ role: "model", parts: fnCalls });

    // Execute each tool call.
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
}

interface JsonSchemaObject {
  type: string;
  properties?: Record<string, JsonSchemaObject>;
  required?: string[];
  enum?: string[];
  items?: JsonSchemaObject;
  description?: string;
}

function toGeminiSchema(s: JsonSchemaObject): Record<string, unknown> {
  const typeMap: Record<string, Type> = {
    object: Type.OBJECT,
    array: Type.ARRAY,
    string: Type.STRING,
    number: Type.NUMBER,
    boolean: Type.BOOLEAN,
    integer: Type.INTEGER,
  };
  const out: Record<string, unknown> = { type: typeMap[s.type] ?? Type.OBJECT };
  if (s.description) out.description = s.description;
  if (s.enum) out.enum = s.enum;
  if (s.type === "object" && s.properties) {
    out.properties = Object.fromEntries(
      Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)])
    );
    if (s.required && s.required.length > 0) out.required = s.required;
  }
  if (s.type === "array" && s.items) {
    out.items = toGeminiSchema(s.items);
  }
  return out;
}

function summarize(name: string, result: unknown): string {
  try {
    if (name === "getPortfolioSummary") {
      const r = result as { netWorth: number; positionCount: number };
      return `net worth $${Math.round(r.netWorth).toLocaleString()}, ${r.positionCount} positions`;
    }
    if (name === "getHoldings") {
      const arr = result as unknown[];
      return `${arr.length} holdings`;
    }
    if (name === "getSyncStatus") {
      const arr = result as unknown[];
      return `${arr.length} log entries`;
    }
    if (name === "updatePreferences" || name === "updateProfile") {
      return "updated";
    }
    return "ok";
  } catch {
    return "ok";
  }
}
