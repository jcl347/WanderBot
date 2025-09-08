// mocks/plan.ts
export const mockPlan = {
  id: "demo",
  final_recommendation:
    "Pick **Lisbon** for mild weather, walkability for the travel-averse, great food, and lowest total group cost.",
  summary: {
    destinations: [
      { name: "Lisbon", slug: "lisbon", totalGroupUSD: 3180, avgPerPersonUSD: 530 },
      { name: "Mexico City", slug: "mexico-city", totalGroupUSD: 3550, avgPerPersonUSD: 590 },
      { name: "Montreal", slug: "montreal", totalGroupUSD: 3720, avgPerPersonUSD: 620 },
      { name: "San Diego", slug: "san-diego", totalGroupUSD: 4150, avgPerPersonUSD: 690 },
      { name: "Honolulu", slug: "honolulu", totalGroupUSD: 4920, avgPerPersonUSD: 820 }
    ]
  }
};

export const mockDestinations = [
  {
    slug: "lisbon",
    name: "Lisbon",
    narrative:
      "Why it fits: mellow vibe for the travel-averse, trams & cafés, day trips to Sintra/Cascais. Kids: Oceanário. Foodies: Time Out Market.",
    per_traveler_fares: [
      { travelerName: "Alex", from: "LAX", avgUSD: 750, monthBreakdown: [
        { month: "2026-03", avgUSD: 720 }, { month: "2026-04", avgUSD: 770 }
      ]},
      { travelerName: "Sam", from: "LAX", avgUSD: 750, monthBreakdown: [
        { month: "2026-03", avgUSD: 720 }, { month: "2026-04", avgUSD: 780 }
      ]},
      { travelerName: "Taylor", from: "SEA", avgUSD: 620, monthBreakdown: [
        { month: "2026-03", avgUSD: 600 }, { month: "2026-04", avgUSD: 640 }
      ]},
      { travelerName: "Jamie", from: "SEA", avgUSD: 610, monthBreakdown: [
        { month: "2026-03", avgUSD: 590 }, { month: "2026-04", avgUSD: 630 }
      ]}
    ]
  },
  {
    slug: "mexico-city",
    name: "Mexico City",
    narrative: "Culture, parks, kid-friendly museums, fantastic food; easy transit days.",
    per_traveler_fares: [
      { travelerName: "Alex", from: "LAX", avgUSD: 320 },
      { travelerName: "Sam", from: "LAX", avgUSD: 320 },
      { travelerName: "Taylor", from: "SEA", avgUSD: 410 },
      { travelerName: "Jamie", from: "SEA", avgUSD: 400 }
    ]
  },
  {
    slug: "montreal",
    name: "Montreal",
    narrative: "Walkable neighborhoods, kid fun at Biodome, budget-friendly shoulder seasons.",
    per_traveler_fares: [
      { travelerName: "Alex", from: "LAX", avgUSD: 520 },
      { travelerName: "Sam", from: "LAX", avgUSD: 520 },
      { travelerName: "Taylor", from: "SEA", avgUSD: 430 },
      { travelerName: "Jamie", from: "SEA", avgUSD: 430 }
    ]
  },
  {
    slug: "san-diego",
    name: "San Diego",
    narrative: "Beaches, zoo, low-stress movement for the travel-averse.",
    per_traveler_fares: [
      { travelerName: "Alex", from: "LAX", avgUSD: 120 },
      { travelerName: "Sam", from: "LAX", avgUSD: 120 },
      { travelerName: "Taylor", from: "SEA", avgUSD: 260 },
      { travelerName: "Jamie", from: "SEA", avgUSD: 250 }
    ]
  },
  {
    slug: "honolulu",
    name: "Honolulu",
    narrative: "Family beach time, hiking, consistent weather; highest but predictable airfare.",
    per_traveler_fares: [
      { travelerName: "Alex", from: "LAX", avgUSD: 420 },
      { travelerName: "Sam", from: "LAX", avgUSD: 420 },
      { travelerName: "Taylor", from: "SEA", avgUSD: 520 },
      { travelerName: "Jamie", from: "SEA", avgUSD: 520 }
    ]
  }
];
