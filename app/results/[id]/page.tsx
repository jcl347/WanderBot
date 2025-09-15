// app/results/[id]/page.tsx  (SERVER component)
import BackgroundMap from "@/components/BackgroundMap";
import SectionCard from "@/components/SectionCard";
import RobotBadge from "@/components/RobotBadge";
import ResultsClient from "@/components/ResultsClient"; // client wrapper
import { q } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { mockPlan, mockDestinations } from "@/mocks/plan";

type PageProps = { params: { id: string } };

export default async function ResultsPage({ params }: PageProps) {
  const { id } = params; // synchronous in this shape (Next 15 accepts this)
  const useMock =
    id === "demo" ||
    process.env.NEXT_PUBLIC_MOCK === "1" ||
    process.env.MOCK === "1";

  let plan: any;
  let dests: any[] = [];

  if (useMock) {
    plan = {
      id: "demo",
      final_recommendation: mockPlan.final_recommendation,
      summary: mockPlan.summary,
    };
    dests = mockDestinations.map((d) => ({
      slug: d.slug,
      name: d.name,
      narrative: d.narrative,
    }));
  } else {
    const rows = await q<any>("select * from plans where id = $1", [id]);
    plan = rows?.[0];
    if (!plan) return notFound();
    dests = await q<any>(
      "select slug, name, narrative from destinations where plan_id = $1 order by name asc",
      [id]
    );
  }

  return (
    <BackgroundMap>
      <div className="flex items-center justify-between">
        <RobotBadge />
        <Link href="/" className="text-sm text-sky-700 underline">
          ← Start a new plan
        </Link>
      </div>

      <SectionCard>
        <h1 className="text-2xl font-semibold">Your trip plan</h1>
        <p className="mt-2 text-neutral-700 whitespace-pre-line">
          {plan.final_recommendation}
        </p>
      </SectionCard>

      {/* Client-only interactive area */}
      <ResultsClient
        plan={plan}
        destinations={dests}
        useMock={useMock}
        planId={plan.id}
      />
    </BackgroundMap>
  );
}
