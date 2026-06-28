import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

export default function VegetationChart({ history }) {
  if (!history || history.length === 0) return null;

  // Format history points for Recharts
  const data = history.map(h => ({
    date: new Date(h.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    NDVI: h.value ? parseFloat(h.value.toFixed(3)) : null,
    DVI: h.payload?.dvi_value ? parseFloat(h.payload.dvi_value.toFixed(3)) : null,
    EVI: h.payload?.evi_value ? parseFloat(h.payload.evi_value.toFixed(3)) : null,
    NDWI: h.payload?.ndwi_value ? parseFloat(h.payload.ndwi_value.toFixed(3)) : null,
    SAVI: h.payload?.savi_value ? parseFloat(h.payload.savi_value.toFixed(3)) : null,
    GNDVI: h.payload?.gndvi_value ? parseFloat(h.payload.gndvi_value.toFixed(3)) : null,
  }));

  return (
    <div style={{ width: "100%", height: 320, marginTop: "32px", padding: "16px", background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)" }}>
      <h3 style={{ marginBottom: "16px", color: "var(--text-primary)", fontSize: "16px" }}>Vegetation Indices (ML Features)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
          <YAxis stroke="var(--text-secondary)" fontSize={12} domain={[-0.2, 1]} axisLine={false} tickLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
            itemStyle={{ fontSize: "13px" }}
            labelStyle={{ color: "var(--text-secondary)", marginBottom: "8px", fontWeight: "bold" }}
          />
          <Legend wrapperStyle={{ fontSize: "13px", paddingTop: "10px" }} />
          <Line type="monotone" dataKey="NDVI" stroke="#10b981" strokeWidth={3} dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 6 }} />
          <Line type="monotone" dataKey="DVI" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="EVI" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="NDWI" stroke="#0ea5e9" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="SAVI" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="GNDVI" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
