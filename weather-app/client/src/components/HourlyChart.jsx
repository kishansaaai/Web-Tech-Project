import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

export default function HourlyChart({ labels = [], temps = [] }) {
  if (!labels.length || !temps.length) return null
  const data = {
    labels,
    datasets: [
      {
        label: 'Temperature (°C)',
        data: temps,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.2)',
        fill: true,
        tension: 0.3,
        pointRadius: 0
      }
    ]
  }
  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { maxRotation: 0, minRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
      y: { beginAtZero: false }
    }
  }
  return (
    <div className="card">
      <h3>Next 24 Hours</h3>
      <Line data={data} options={options} />
    </div>
  )
}
