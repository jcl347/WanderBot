// /mocks/destinations.ts
export type FareBreakdown = {
  travelerName: string;
  from: string;
  avgUSD: number;
  monthBreakdown?: { month: string; avgUSD: number }[];
};

export type MockDestinationDetail = {
  slug: string;
  name: string;
  narrative: string;
  months?: { month: string; note: string }[];
  per_traveler_fares: FareBreakdown[];
};

const travelers = ["Jordan", "Alex", "Casey"];

export const mockDestinationDetailBySlug: Record<string, MockDestinationDetail> = {
  lisbon: {
    slug: "lisbon",
    name: "Lisbon",
    narrative:
      "Why it fits: mellow vibe for the travel-averse, trams & cafés, easy day trips to Sintra/Cascais. Family friendly.",
    months: [
      { month: "2025-12", note: "Shoulder → good deals" },
      { month: "2026-01", note: "Low season, lowest fares" },
      { month: "2026-02", note: "Low season continues" },
    ],
    per_traveler_fares: travelers.map((t, i) => ({
      travelerName: t,
      from: ["LAX", "SEA", "DEN"][i],
      avgUSD: [820, 760, 740][i],
      monthBreakdown: [
        { month: "2025-12", avgUSD: [880, 810, 790][i] },
        { month: "2026-01", avgUSD: [770, 720, 700][i] },
        { month: "2026-02", avgUSD: [810, 750, 730][i] },
      ],
    })),
  },

  "mexico-city": {
    slug: "mexico-city",
    name: "Mexico City",
    narrative:
      "Culture, parks, kid-friendly museums, fantastic food; easy transit days. Great for mixed interests.",
    months: [
      { month: "2025-12", note: "Holiday bump" },
      { month: "2026-01", note: "Post-holiday dip" },
      { month: "2026-02", note: "Stable, good value" },
    ],
    per_traveler_fares: travelers.map((t, i) => ({
      travelerName: t,
      from: ["LAX", "SEA", "DEN"][i],
      avgUSD: [360, 410, 430][i],
      monthBreakdown: [
        { month: "2025-12", avgUSD: [420, 460, 470][i] },
        { month: "2026-01", avgUSD: [330, 380, 400][i] },
        { month: "2026-02", avgUSD: [340, 390, 420][i] },
      ],
    })),
  },

  montreal: {
    slug: "montreal",
    name: "Montreal",
    narrative:
      "Walkable neighborhoods, kid fun at Biodome, budget-friendly shoulder seasons.",
    months: [
      { month: "2025-12", note: "Holiday peak" },
      { month: "2026-01", note: "Cheapest" },
      { month: "2026-02", note: "Still low" },
    ],
    per_traveler_fares: travelers.map((t, i) => ({
      travelerName: t,
      from: ["LAX", "SEA", "DEN"][i],
      avgUSD: [900, 780, 620][i],
      monthBreakdown: [
        { month: "2025-12", avgUSD: [980, 860, 700][i] },
        { month: "2026-01", avgUSD: [840, 720, 580][i] },
        { month: "2026-02", avgUSD: [880, 760, 600][i] },
      ],
    })),
  },

  "san-diego": {
    slug: "san-diego",
    name: "San Diego",
    narrative:
      "Beaches, zoo, lots of low-stress movement for the travel-averse. Easy sunshine.",
    months: [
      { month: "2025-12", note: "Holidays" },
      { month: "2026-01", note: "Very stable, low" },
      { month: "2026-02", note: "Stable" },
    ],
    per_traveler_fares: travelers.map((t, i) => ({
      travelerName: t,
      from: ["LAX", "SEA", "DEN"][i],
      avgUSD: [120, 260, 240][i],
      monthBreakdown: [
        { month: "2025-12", avgUSD: [140, 280, 260][i] },
        { month: "2026-01", avgUSD: [110, 230, 220][i] },
        { month: "2026-02", avgUSD: [120, 250, 240][i] },
      ],
    })),
  },

  honolulu: {
    slug: "honolulu",
    name: "Honolulu",
    narrative:
      "Family beach time, hiking, consistent weather; highest but predictable airfares.",
    months: [
      { month: "2025-12", note: "Big holiday surge" },
      { month: "2026-01", note: "Eases" },
      { month: "2026-02", note: "Eases" },
    ],
    per_traveler_fares: travelers.map((t, i) => ({
      travelerName: t,
      from: ["LAX", "SEA", "DEN"][i],
      avgUSD: [620, 560, 610][i],
      monthBreakdown: [
        { month: "2025-12", avgUSD: [780, 690, 740][i] },
        { month: "2026-01", avgUSD: [580, 520, 560][i] },
        { month: "2026-02", avgUSD: [600, 540, 590][i] },
      ],
    })),
  },
};
