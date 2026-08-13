import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

type Props = {
  serviceable: number;
  underMaintenance: number;
  unserviceable: number;
  ber: number;
};

const COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#475569"];

export default function MobiityAssetsStatusChart({
  serviceable,
  underMaintenance,
  unserviceable,
  ber,
}: Props) {
  const data = [
    {
      name: "Serviceable",
      value: serviceable,
      fill: "#22c55e",
    },
    {
      name: "Under Maintenance",
      value: underMaintenance,
      fill: "#f59e0b",
    },
    {
      name: "Unserviceable",
      value: unserviceable,
      fill: "#ef4444",
    },
    {
      name: "Beyond Economic Repair",
      value: ber,
      fill: "#475569",
    },
  ].filter((item) => item.value > 0);

  // const renderLabel = ({
  //   cx,
  //   cy,
  //   midAngle,
  //   innerRadius,
  //   outerRadius,
  //   value,
  // }: any) => {
  //   const RADIAN = Math.PI / 180;
  //   const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  //   const x = cx + radius * Math.cos(-midAngle * RADIAN);
  //   const y = cy + radius * Math.sin(-midAngle * RADIAN);

  //   return (
  //     <text
  //       x={x}
  //       y={y}
  //       fill="white"
  //       textAnchor={x > cx ? "start" : "end"}
  //       dominantBaseline="central"
  //       fontSize={16}
  //       fontWeight={700}
  //     >
  //       {value}
  //     </text>
  //   );
  // };

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={70}
            outerRadius={110}
            label={({ value }) => value}
            labelLine={false}
          />

          <Tooltip />

          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
