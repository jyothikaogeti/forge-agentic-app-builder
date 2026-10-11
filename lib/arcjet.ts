import arcjet, {
  detectPromptInjection,
  sensitiveInfo,
  tokenBucket,
} from "@arcjet/next";

export const arcjetClient = arcjet({
  key: process.env.ARCJEY_KEY!,
  characteristics: ["userId"],
  rules: [
    tokenBucket({
      mode: "LIVE",
      refillRate: 5,
      interval: 60,
      capacity: 5,
    }),
    detectPromptInjection({
      mode: "LIVE",
    }),
    sensitiveInfo({
      mode: "LIVE",
      deny: ["CREDIT_CARD_NUMBER", "API_KEY", "AWS_SECRET_KEY"],
    }),
  ],
});
