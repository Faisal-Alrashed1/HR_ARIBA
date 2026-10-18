import { useEffect, useRef } from 'react';
import { Chart, BarController, DoughnutController, BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
Chart.register(BarController, DoughnutController, BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

export const CLR = ['#014D3D', '#29B35E', '#E4E4BC', '#4B5563', '#9CA3AF', '#231F20'];
/** رسم بياني (bar | doughnut) بنفس إعدادات النظام القديم */
export default function ChartCanvas({ id, type, labels, data, colors }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !labels.length) return undefined;
    const cfg = type === 'bar'
      ? { type: 'bar', data: { labels, datasets: [{ data, backgroundColor: colors || CLR, borderRadius: 6 }] }, options: { animation: { duration: 0 }, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ' ' + c.parsed.y.toLocaleString() } } }, scales: { x: { ticks: { color: '#6B7280', font: { size: 10 } }, grid: { color: 'rgba(36,48,68,.4)' } }, y: { ticks: { color: '#6B7280', font: { size: 10 } }, grid: { color: 'rgba(36,48,68,.4)' } } } } }
      : { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: colors || CLR, borderWidth: 0 }] }, options: { animation: { duration: 0 }, responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { tooltip: { callbacks: { label: (c) => ' ' + c.label + ': ' + c.parsed } }, legend: { position: 'bottom', labels: { color: '#8A928F', font: { size: 10 }, boxWidth: 10, padding: 6 } } } } };
    const ch = new Chart(ref.current, cfg);
    return () => ch.destroy();
  }, [type, JSON.stringify(labels), JSON.stringify(data), JSON.stringify(colors)]); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas id={id} ref={ref} />;
}
