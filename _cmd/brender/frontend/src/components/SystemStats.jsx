import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { onAppEvent } from '../lib/appEvents'

function Bar({ label, pct, detail, color }) {
  const p = Math.min(100, Math.max(0, pct || 0))
  return (
    <div className="sysmon-bar">
      <span className="sysmon-label">{label}</span>
      <div className="sysmon-track">
        <div className="sysmon-fill" style={{ width: `${p}%`, background: color }} />
      </div>
      <span className="sysmon-pct">{p.toFixed(0)}%</span>
      {detail && <span className="sysmon-detail">{detail}</span>}
    </div>
  )
}

function SystemStats() {
  const { t } = useTranslation()
  const [stats, setStats] = useState(null)

  useEffect(() => onAppEvent('system:stats', setStats), [])

  if (!stats) return null

  const memDetail = stats.mem_total_mb
    ? `${(stats.mem_used_mb / 1024).toFixed(1)}/${(stats.mem_total_mb / 1024).toFixed(1)}GB`
    : null

  return (
    <div className="sysmon-container">
      <Bar label="CPU"  pct={stats.cpu_usage} color="#4a7cdc" />
      <Bar label={t('sysmon.memory')} pct={stats.mem_usage} detail={memDetail} color="#27ae60" />
      {stats.gpu_available && stats.gpus?.map(gpu => (
        <div key={gpu.index} className="sysmon-gpu-group">
          <Bar
            label="GPU"
            pct={gpu.usage}
            color="#d15904"
          />
          <Bar
            label="VRAM"
            pct={gpu.mem_usage}
            detail={gpu.mem_total_mb ? `${(gpu.mem_used_mb / 1024).toFixed(1)}/${(gpu.mem_total_mb / 1024).toFixed(1)}GB` : null}
            color="#d15904"
          />
          {gpu.temperature > 0 && (
            <span className="sysmon-temp">{gpu.temperature}°C</span>
          )}
        </div>
      ))}
    </div>
  )
}

export default SystemStats
