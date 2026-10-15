import { describe, expect, it } from "vitest";
import { formatWhatsAppResults } from "./whatsapp";

describe("formatWhatsAppResults", () => {
  it("formats payout order, rebuy marks, and optional 7/2 winners", () => {
    const text = formatWhatsAppResults(
      "2026-11-14",
      [
        { playerId: "julien", rank: 1, rebuys: 0 },
        { playerId: "marie", rank: 2, rebuys: 1 },
      ],
      { julien: "Julien", marie: "Marie" },
      new Map([["marie", 2]]),
    );

    expect(text).toBe(
      "Résultats du 2026-11-14\n1. Julien\n2. Marie (R)\n\n7/2 : Marie (2)",
    );
  });

  it("omits 7/2 section when nobody won a 7/2", () => {
    const text = formatWhatsAppResults(
      "2026-11-14",
      [{ playerId: "julien", rank: 1, rebuys: 0 }],
      { julien: "Julien" },
      new Map(),
    );

    expect(text).toBe("Résultats du 2026-11-14\n1. Julien");
  });
});
