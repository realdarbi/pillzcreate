import { useState, useEffect } from 'react'
import { query, run } from '../lib/database'

export default function TimeSlotCalendar({ serviceId, onSlotSelected, selectedSlotId }) {
  const [slots, setSlots] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [availableDates, setAvailableDates] = useState([])

  // Генерируем даты на 14 дней вперед
  const generateDates = () => {
    const dates = []
    const today = new Date()
    for (let i = 1; i <= 14; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const dates = generateDates()

  // Загружаем слоты для выбранной даты
  useEffect(() => {
    if (!selectedDate) return
    
    async function loadSlots() {
      setLoading(true)
      const dateStr = selectedDate.toISOString().split('T')[0]
      const data = await query(
        "SELECT * FROM slots WHERE service_id = ? AND date = ? ORDER BY start_time",
        [serviceId, dateStr]
      )
      setSlots(data)
      setLoading(false)
    }
    
    loadSlots()
  }, [selectedDate, serviceId])

  // Проверяем, есть ли слоты на каждую дату
  useEffect(() => {
    async function checkAvailableDates() {
      const available = []
      for (const date of dates) {
        const dateStr = date.toISOString().split('T')[0]
        const data = await query(
          "SELECT COUNT(*) as count FROM slots WHERE service_id = ? AND date = ? AND is_booked = 0",
          [serviceId, dateStr]
        )
        if (data[0]?.count > 0) {
          available.push(date)
        }
      }
      setAvailableDates(available)
      if (available.length > 0 && !selectedDate) {
        setSelectedDate(available[0])
      }
    }
    checkAvailableDates()
  }, [serviceId])

  const formatDate = (date) => {
    return date.toLocaleDateString('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    })
  }

  const handleSlotClick = (slot) => {
    if (slot.is_booked) return
    onSlotSelected(slot)
  }

  const isDateAvailable = (date) => {
    return availableDates.some(d => d.toDateString() === date.toDateString())
  }

  return (
    <div style={{ marginBottom: '30px' }}>
      <h3>Выберите дату и время</h3>
      
      {/* Выбор даты */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        overflowX: 'auto', 
        padding: '10px 0',
        marginBottom: '20px'
      }}>
        {dates.map((date, idx) => {
          const isAvailable = isDateAvailable(date)
          const isSelected = selectedDate && selectedDate.toDateString() === date.toDateString()
          
          return (
            <button
              key={idx}
              onClick={() => isAvailable && setSelectedDate(date)}
              disabled={!isAvailable}
              style={{
                minWidth: '80px',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                background: isSelected ? '#1976d2' : (isAvailable ? 'white' : '#f0f0f0'),
                color: isSelected ? 'white' : (isAvailable ? '#333' : '#999'),
                cursor: isAvailable ? 'pointer' : 'not-allowed',
                fontWeight: isSelected ? 'bold' : 'normal'
              }}
            >
              {formatDate(date)}
            </button>
          )
        })}
      </div>

      {/* Выбор времени */}
      {selectedDate && (
        <div>
          {loading ? (
            <p>Загрузка...</p>
          ) : slots.length === 0 ? (
            <p style={{ color: '#999' }}>Нет доступных слотов на эту дату</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {slots.map(slot => (
                <button
                  key={slot.id}
                  onClick={() => handleSlotClick(slot)}
                  disabled={slot.is_booked}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    background: selectedSlotId === slot.id ? '#1976d2' : (slot.is_booked ? '#f0f0f0' : 'white'),
                    color: selectedSlotId === slot.id ? 'white' : (slot.is_booked ? '#999' : '#333'),
                    cursor: slot.is_booked ? 'not-allowed' : 'pointer',
                    fontWeight: selectedSlotId === slot.id ? 'bold' : 'normal',
                    opacity: slot.is_booked ? 0.6 : 1
                  }}
                >
                  {slot.start_time} - {slot.end_time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}