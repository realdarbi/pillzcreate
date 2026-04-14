import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { query } from '../lib/database'

export default function StudioPage() {
  const { studioId } = useParams()
  const [studio, setStudio] = useState(null)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const studioData = await query("SELECT * FROM studios WHERE id = ?", [studioId])
      const servicesData = await query("SELECT * FROM services WHERE studio_id = ?", [studioId])
      
      setStudio(studioData[0] || null)
      setServices(servicesData)
      setLoading(false)
    }
    fetchData()
  }, [studioId])

  if (loading) return <div className="container"><p>Загрузка...</p></div>
  if (!studio) return <div className="container"><p>Студия не найдена</p></div>

  return (
    <div className="container">
      <Link to="/" style={{ textDecoration: 'none', color: '#1976d2' }}>← Назад к студиям</Link>
      <h1>{studio.name}</h1>
      <p>{studio.description}</p>

      <h2>Услуги</h2>
      <div className="studios-grid">
        {services.map(service => (
          <Link to={`/service/${service.id}`} key={service.id} className="studio-card">
            <div className="studio-content">
              <div className="studio-title">{service.name}</div>
              <div className="studio-description">{service.description}</div>
              <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1976d2', marginTop: '10px' }}>
                {service.price} ₽
              </p>
              <small>Длительность: {service.estimated_duration_minutes} мин</small>
              <div style={{ 
                display: 'inline-block', 
                background: service.service_type === 'offline' ? '#4CAF50' : '#FF9800', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '20px', 
                fontSize: '12px',
                marginLeft: '10px'
              }}>
                {service.service_type === 'offline' ? '📍 Оффлайн' : '💻 Онлайн'}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}