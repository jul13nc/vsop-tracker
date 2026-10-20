import { describe, expect, it } from "vitest";
import { formatWhatsAppResults } from "./whatsapp";

describe("formatWhatsAppResults", () => {
  it("formats payout order, rebuy order labels (R1, R2…), and optional 7/2 winners", () => {
    const text = formatWhatsAppResults(
      "2026-11-14",
      [
        { playerId: "julien", rank: 1, rebuys: 0 },
        { playerId: "marie", rank: 2, rebuys: 1 },
        { playerId: "karim", rank: 3, rebuys: 2 },
      ],
      { julien: "Julien", marie: "Marie", karim: "Karim" },
      new Map([["marie", 2]]),
      new Map([
        ["marie", 1],
        ["karim", 2],
      ]),
    );

    expect(text).toBe(
      "Résultats du 2026-11-14\n" +
        "1. Julien\n" +
        "2. Marie (R1)\n" +
        "3. Karim (R2)\n" +
        "\n7/2 : Marie (2)",
    );
  });

  it("falls back to a count when a rebuyer has no rebuy order", () => {
    const text = formatWhatsAppResults(
      "2026-11-14",
      [{ playerId: "marie", rank: 1, rebuys: 2 }],
      { marie: "Marie" },
      new Map(),
      new Map(),
    );

    expect(text).toBe("Résultats du 2026-11-14\n1. Marie (R×2)");
  });

  it("omits 7/2 section when nobody won a 7/2", () => {
    const text = formatWhatsAppResults(
      "2026-11-14",
      [{ playerId: "julien", rank: 1, rebuys: 0 }],
      { julien: "Julien" },
      new Map(),
      new Map(),
    );

    expect(text).toBe("Résultats du 2026-11-14\n1. Julien");
  });
});
