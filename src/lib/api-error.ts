import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function handleApiError(error: unknown) {
  console.error("[Server Exception]: ", error);

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: "Bad Request validation failed",
        issues: error.issues,
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: error instanceof Error ? error.message : "Internal server process error",
    },
    { status: 500 }
  );
}
