import { z } from "zod";

// Schemas for validating and coercing query parameters
export const poiQuerySchema = z.object({
  startLat: z.coerce.number({ invalid_type_error: "startLat must be a number" }),
  startLng: z.coerce.number({ invalid_type_error: "startLng must be a number" }),
  prompt: z
    .string()
    .trim()
    .min(1, { message: "prompt cannot be empty" })
    .max(200, { message: "prompt too long (max 200)" })
    .optional(),
  radius: z
    .coerce.number({ invalid_type_error: "radius must be a number" })
    .positive({ message: "radius must be positive" })
    .default(1200)
    .optional(),
  vibe: z
    .string()
    .trim()
    .min(1, { message: "vibe cannot be empty" })
    .max(100, { message: "vibe too long (max 100)" })
    .optional(),
});

export type PoiQuery = z.infer<typeof poiQuerySchema>;

export const photoQuerySchema = z.object({
  ref: z.string({ required_error: "ref is required" }).min(1, { message: "ref is required" }),
  maxwidth: z
    .coerce.number({ invalid_type_error: "maxwidth must be a number" })
    .int({ message: "maxwidth must be an integer" })
    .min(1, { message: "maxwidth must be >= 1" })
    .max(4000, { message: "maxwidth must be <= 4000" })
    .default(1200)
    .optional(),
});

export type PhotoQuery = z.infer<typeof photoQuerySchema>;

export function formatZodError(err: unknown): { error: string; details?: unknown } {
  if (err && typeof err === "object" && "issues" in err) {
    const ze = err as z.ZodError;
    const messages = ze.issues.map((i) => `${i.path.join(".") || "param"}: ${i.message}`);
    return { error: "Invalid query parameters", details: messages };
  }
  return { error: "Invalid input" };
}