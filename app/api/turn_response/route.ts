import { getDeveloperPrompt, MODEL } from "@/config/constants";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getFreshAccessToken } from "@/lib/googleTokens";
import { withGoogleConnector } from "@/lib/tools/connectors";

export async function POST(request: Request) {
  try {
    const { messages, tools, googleIntegrationEnabled } = await request.json();
    console.log("Received messages:", messages);

    // Get fresh tokens (refresh if near expiry or missing access token when refresh exists)
    const { accessToken } = await getFreshAccessToken();

    // Build tools list, conditionally adding the Google Calendar connector via MCP
    const toolsWithConnector = withGoogleConnector(
      Array.isArray(tools) ? tools : [],
      { enabled: Boolean(googleIntegrationEnabled), accessToken }
    );

    const openai = new OpenAI();

    const events = await openai.responses.create({
      model: MODEL,
      input: messages,
      instructions: getDeveloperPrompt(),
      tools: toolsWithConnector as any,
      stream: true,
      parallel_tool_calls: false,
    });

    // Create a ReadableStream that emits SSE data
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of events) {
            // Sending all events to the client
            const data = JSON.stringify({
              event: event.type,
              data: event,
            });
            controller.enqueue(`data: ${data}\n\n`);
          }
          // End of stream
          controller.close();
        } catch (error) {
          console.error("Error in streaming loop:", error);
          controller.error(error);
        }
      },
    });

    // Return the ReadableStream as SSE
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Error in POST handler:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
