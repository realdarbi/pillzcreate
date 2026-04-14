import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { query } from '../lib/database'

export default function Catalog() {
  const [studios, setStudios] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStudios() {
      const data = await query("SELECT * FROM studios")
      setStudios(data)
      setLoading(false)
    }
    fetchStudios()
  }, [])

  if (loading) return <div className="container"><h1>Загрузка...</h1></div>

  return (
    <div className="container">
      <h1>Наши студии</h1>
      <div className="studios-grid">
        {studios.map(studio => (
          <Link to={`/studio/${studio.id}`} key={studio.id} className="studio-card">
            <div className="studio-content">
              <div className="studio-title">{studio.name}</div>
              <div className="studio-description">{studio.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}