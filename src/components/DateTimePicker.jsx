import { useState, useEffect } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { query } from '../lib/database'

export default function DateTimePicker({ serviceId, onTimeSelected, selectedStart, selectedEnd }) {
  const [startDate, setStartDate] = useState(selectedStart || null)
  const [endDate, setEndDate] = useState(selectedEnd || null)
  const [bookedSlots, setBookedSlots] = useState([])
  const [error, setError] = useState(null)
  const [isAvailable, setIsAvailable] = useState(false)
  const isDark = document.body.classList.contains('dark')

  useEffect(() => {
    async function loadBookedSlots() {
      const slots = await query(
        "SELECT booking_date, start_time, end_time FROM bookings WHERE service_id = ?",
        [serviceId]
      )
      setBookedSlots(slots)
    }
    loadBookedSlots()
  }, [serviceId])

  useEffect(() => {
    if (!startDate || !endDate) {
      setIsAvailable(false)
      return
    }

    if (startDate >= endDate) {
      setError("Время начала должно быть раньше времени окончания")
      setIsAvailable(false)
      return
    }

    const hoursDiff = (endDate - startDate) / (1000 * 60 * 60)
    if (hoursDiff > 8) {
      setError("Нельзя выбрать более 8 часов")
      setIsAvailable(false)
      return
    }

    const selectedDateStr = startDate.toISOString().split('T')[0]
    const selectedStart = startDate.getHours().toString().padStart(2, '0') + ':' + startDate.getMinutes().toString().padStart(2, '0')
    const selectedEnd = endDate.getHours().toString().padStart(2, '0') + ':' + endDate.getMinutes().toString().padStart(2, '0')

    const isOverlap = bookedSlots.some(slot => {
      if (slot.booking_date !== selectedDateStr) return false
      const slotStart = slot.start_time
      const slotEnd = slot.end_time
      return (selectedStart < slotEnd && selectedEnd > slotStart)
    })

    if (isOverlap) {
      setError("Это время уже занято, выберите другое")
      setIsAvailable(false)
    } else {
      setError(null)
      setIsAvailable(true)
    }
  }, [startDate, endDate, bookedSlots])

  const filterTime = (time) => {
    const currentDate = new Date()
    const selectedDate = new Date(time)
    if (selectedDate < currentDate) return false
    const hours = selectedDate.getHours()
    if (hours < 10) return false
    if (hours >= 24) return false
    return true
  }

  const handleStartChange = (date) => {
    setStartDate(date)
    if (endDate && date >= endDate) {
      setEndDate(null)
    }
    onTimeSelected(null, null)
    setIsAvailable(false)
  }

  const handleEndChange = (date) => {
    setEndDate(date)
  }

  const handleConfirm = () => {
    if (isAvailable && startDate && endDate) {
      onTimeSelected(startDate, endDate)
    }
  }

  return (
    <div style={{ 
      marginBottom: '30px', 
      padding: '15px', 
      background: isDark ? '#1e1e1e' : '#f9f9f9', 
      borderRadius: '10px' 
    }}>
      <h3 style={{ marginBottom: '15px', color: isDark ? '#fff' : '#333' }}>
        Выберите дату и время
      </h3>
      
      <div style={{ marginBottom: '10px', fontSize: '14px', color: isDark ? '#aaa' : '#666' }}>
        ⏰ Доступное время: с 10:00 до 00:00<br/>
        ⏱ Максимальная длительность: 8 часов
      </div>
      
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '15px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: isDark ? '#fff' : '#333' }}>
            Дата и время начала *
          </label>
          <DatePicker
            selected={startDate}
            onChange={handleStartChange}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={30}
            timeCaption="Время"
            dateFormat="dd.MM.yyyy HH:mm"
            minDate={new Date()}
            filterTime={filterTime}
            placeholderText="Выберите дату и время"
            className="datepicker-input"
          />
        </div>
        
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: isDark ? '#fff' : '#333' }}>
            Дата и время окончания *
          </label>
          <DatePicker
            selected={endDate}
            onChange={handleEndChange}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={30}
            timeCaption="Время"
            dateFormat="dd.MM.yyyy HH:mm"
            minDate={startDate || new Date()}
            minTime={startDate}
            maxTime={startDate ? new Date(startDate.getTime() + 8 * 60 * 60 * 1000) : null}
            filterTime={filterTime}
            placeholderText="Выберите дату и время"
            disabled={!startDate}
            className="datepicker-input"
          />
        </div>
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: '10px', fontSize: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      {isAvailable && (
        <div style={{ color: 'green', marginBottom: '10px', fontSize: '14px' }}>
          ✓ Время свободно!
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={!isAvailable}
        style={{
          background: isAvailable ? '#4caf50' : '#ccc',
          color: 'white',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '8px',
          cursor: isAvailable ? 'pointer' : 'not-allowed',
          width: '100%'
        }}
      >
        {isAvailable ? 'Подтвердить выбранное время' : 'Выберите свободное время'}
      </button>
    </div>
  )
}