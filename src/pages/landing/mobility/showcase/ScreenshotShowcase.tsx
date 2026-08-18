import ShowcaseCard from "./ShowcaseCard";
import { showcase } from "./showcaseData";

export default function ScreenshotShowcase() {
  return (
    <section id="showcase" className="bg-white py-28 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl space-y-32 px-6">
        <div className="text-center">
          <p className="font-semibold uppercase tracking-[0.35em] text-blue-600">
            Product Showcase
          </p>

          <h2 className="mt-4 text-5xl font-black">
            Explore Project M.O.B.I.L.I.S
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-500">
            Discover how Project M.O.B.I.L.I.S simplifies mobility management
            through centralized mobility asset records, maintenance monitoring,
            and inspections.
          </p>
        </div>

        {showcase.map((item, index) => (
          <ShowcaseCard key={item.title} {...item} reverse={index % 2 === 1} />
        ))}
      </div>
    </section>
  );
}
