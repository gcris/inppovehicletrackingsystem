import { useState } from "react";
import MobilityTypeTable from "./MobilityTypeTable";
import MobilitySourceTable from "./MobilitySourceTable";

export default function MobilityDistributionPage() {
  const [loading, setLoading] = useState(true);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mobility Distribution Report</h1>

          <p className="text-slate-500 mt-2">
            Distribution of mobility assets by Unit/Station.
          </p>
        </div>
      </div>

      <MobilityTypeTable loading={loading} setLoading={setLoading} />
      <MobilitySourceTable loading={loading} setLoading={setLoading} />

      <div className="mb-10"></div>
    </div>
  );
}
