"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.photoQuerySchema = exports.poiQuerySchema = void 0;
exports.formatZodError = formatZodError;
const zod_1 = require("zod");
// Schemas for validating and coercing query parameters
exports.poiQuerySchema = zod_1.z.object({
    startLat: zod_1.z.coerce.number({ invalid_type_error: "startLat must be a number" }),
    startLng: zod_1.z.coerce.number({ invalid_type_error: "startLng must be a number" }),
    prompt: zod_1.z
        .string()
        .trim()
        .min(1, { message: "prompt cannot be empty" })
        .max(200, { message: "prompt too long (max 200)" })
        .optional(),
    radius: zod_1.z
        .coerce.number({ invalid_type_error: "radius must be a number" })
        .positive({ message: "radius must be positive" })
        .default(1200)
        .optional(),
    vibe: zod_1.z
        .string()
        .trim()
        .min(1, { message: "vibe cannot be empty" })
        .max(100, { message: "vibe too long (max 100)" })
        .optional(),
});
exports.photoQuerySchema = zod_1.z.object({
    ref: zod_1.z.string({ required_error: "ref is required" }).min(1, { message: "ref is required" }),
    maxwidth: zod_1.z
        .coerce.number({ invalid_type_error: "maxwidth must be a number" })
        .int({ message: "maxwidth must be an integer" })
        .min(1, { message: "maxwidth must be >= 1" })
        .max(4000, { message: "maxwidth must be <= 4000" })
        .default(1200)
        .optional(),
});
function formatZodError(err) {
    if (err && typeof err === "object" && "issues" in err) {
        const ze = err;
        const messages = ze.issues.map((i) => `${i.path.join(".") || "param"}: ${i.message}`);
        return { error: "Invalid query parameters", details: messages };
    }
    return { error: "Invalid input" };
}
