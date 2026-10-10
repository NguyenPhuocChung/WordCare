
import { z } from "zod";

export const FormatRulesSchema = z.object({
  fontFamily: z.string().trim().min(1).max(100).optional(),

  fontSizePt: z.number().min(8).max(72).optional(),

  alignment: z
    .enum(["left", "center", "right", "justify"])
    .optional(),

  lineSpacing: z
    .enum(["1.0", "1.15", "1.5", "2.0"])
    .optional(),

  firstLineIndentCm: z.number().min(0).max(5).optional(),

  marginsCm: z
    .object({
      top: z.number().min(0).max(10).optional(),
      bottom: z.number().min(0).max(10).optional(),
      left: z.number().min(0).max(10).optional(),
      right: z.number().min(0).max(10).optional(),
    })
    .optional(),
}).strict();

export type FormatRules = z.infer<typeof FormatRulesSchema>;

export const FormatRequestSchema = z.object({
  instructions: z.string().trim().min(1).max(5000),
});

export type FormatRequest = z.infer<typeof FormatRequestSchema>;

export type RuleAnalysis = {
  rules: FormatRules;
  warnings: string[];
  unsupportedRequests: string[];
  requiresConfirmation: true;
};
