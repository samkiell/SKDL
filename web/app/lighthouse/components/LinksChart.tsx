'use client'

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts'

export default function LinksChart({ data }: { data: any[] }) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#71717a', fontSize: 10, fontWeight: 600 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#71717a', fontSize: 10, fontWeight: 600 }}
          />
          <Tooltip 
            cursor={{ fill: 'white', opacity: 0.05 }}
            contentStyle={{ 
              backgroundColor: '#111', 
              border: '1px solid #ffffff10',
              borderRadius: '12px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}
            itemStyle={{ color: '#fff' }}
          />
          <Bar 
            dataKey="count" 
            fill="#3b82f6" 
            radius={[4, 4, 0, 0]} 
            barSize={32}
            className="hover:fill-blue-400 transition-colors"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index === data.length - 1 ? '#3b82f6' : '#3b82f640'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
