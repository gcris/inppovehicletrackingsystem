import { PieChart, Pie, ResponsiveContainer, Tooltip, Legend } from "recharts";

type Props = {
  good: number;
  dueSoon: number;
  overdue: number;
};

export default function MaintenanceStatusChart({
  good,
  dueSoon,
  overdue,
}: Props) {
  const data = [
    {
      name: "Good",
      value: good,
      fill: "#22c55e",
    },
    {
      name: "Due Soon",
      value: dueSoon,
      fill: "#f59e0b",
    },
    {
      name: "Overdue",
      value: overdue,
      fill: "#ef4444",
    },
  ].filter((d) => d.value > 0);

  return (
    <div className="h-80">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
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
