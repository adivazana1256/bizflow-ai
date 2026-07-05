import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { SimulatorTransport } from "@/transport/simulator";
import { processInbound } from "@/transport/handler";

// Chat Simulator backend. Now goes through the transport layer: the route hands
// the raw payload to the SimulatorTransport and the shared orchestrator; the
// engine only ever sees canonical messages.
const transport = new SimulatorTransport();

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const session = await auth();
  const out = await processInbound(transport, body, { businessId: session?.user.businessId });
  return NextResponse.json(out);
}
