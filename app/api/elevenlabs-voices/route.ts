import { NextResponse } from "next/server";
import { getElevenLabsVoices } from "@/lib/elevenlabs-accounts";

export async function GET() {
  const voices = getElevenLabsVoices();
  return NextResponse.json({ voices });
}
