'use client'

import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  Legend
} from 'recharts'

const COLORS = ['#3b82f6', '#1e40af']

export default function TypeBreakdownChart({ data }: { data: { name: string; value: number }[] }) {
  const isEmpty = data.every(d => d.value === 0)
  
  if (isEmpty) {
    return (
      <div className="h-[300px] flex items-center justify-center text-zinc-600 font-mono text-xs uppercase tracking-widest">
        No Data Available
      </div>
    )
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#111', 
              border: '1px solid #ffffff10',
              borderRadius: '12px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            formatter={(value) => <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
