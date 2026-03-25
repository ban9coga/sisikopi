import { NextResponse } from "next/server";

export function jsonError(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk(payload, init = {}) {
  return NextResponse.json(payload, init);
}
