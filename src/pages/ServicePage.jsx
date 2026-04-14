import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DateTimePicker from '../components/DateTimePicker'
import { query, run } from '../lib/database'
import { auth } from '../lib/firebase'

export default function ServicePage() {
  const { serviceId } = useParams()
  const navigate = useNavigate()
  const [service, setService] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [selectedStart, setSelectedStart] = useState(null)
  const [selectedEnd, setSelectedEnd] = useState(null)
  
  const [totalPrice, setTotalPrice] = useState(0)
  
  const hourlyRates = {
    'Запись вокала': 500,
    'Аренда студии': 1000
  }
  
  const [formData, setFormData] = useState({
    client_name: '',
    title: '',
    description: '',
    reference: '',
    deadline: '',
    comments: ''
  })

  useEffect(() => {
    async function loadService() {
      try {
        const data = await query("SELECT * FROM services WHERE id = ?", [serviceId])
        if (data && data.length > 0) {
          setService(data[0])
          if (hourlyRates[data[0].name]) {
            setTotalPrice(hourlyRates[data[0].name])
          } else {
            setTotalPrice(data[0].price)
          }
        }
        setLoading(false)
      } catch (err) {
        console.error("Ошибка:", err)
        setLoading(false)
      }
    }
    loadService()
  }, [serviceId])

  useEffect(() => {
    if (service && hourlyRates[service.name] && selectedStart && selectedEnd) {
      const hoursDiff = (selectedEnd - selectedStart) / (1000 * 60 * 60)
      const newPrice = Math.round(hourlyRates[service.name] * hoursDiff)
      setTotalPrice(newPrice)
    }
  }, [selectedStart, selectedEnd, service])

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleTimeSelected = (start, end) => {
    setSelectedStart(start)
    setSelectedEnd(end)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    
    try {
      const isHourlyService = !!hourlyRates[service.name]
      const prepaidAmount = totalPrice * 0.3
      
      const currentUser = auth.currentUser
      const clientPhone = currentUser ? currentUser.phoneNumber : null
      
      if (!clientPhone) {
        alert('Пожалуйста, авторизуйтесь в профиле перед отправкой заявки')
        navigate('/profile')
        return
      }
      
      let bookingDate = null
      let startTime = null
      let endTime = null
      
      if (isHourlyService && selectedStart && selectedEnd) {
        bookingDate = selectedStart.toISOString().split('T')[0]
        startTime = selectedStart.getHours().toString().padStart(2, '0') + ':' + selectedStart.getMinutes().toString().padStart(2, '0')
        endTime = selectedEnd.getHours().toString().padStart(2, '0') + ':' + selectedEnd.getMinutes().toString().padStart(2, '0')
        
        const existingBookings = await query(
          `SELECT * FROM bookings 
           WHERE service_id = ? AND booking_date = ? 
           AND ((start_time < ? AND end_time > ?))`,
          [serviceId, bookingDate, endTime, startTime]
        )
        
        if (existingBookings.length > 0) {
          alert("Это время уже занято! Пожалуйста, выберите другое.")
          return
        }
        
        await run(`
          INSERT INTO bookings (service_id, booking_date, start_time, end_time, client_name, client_phone)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [serviceId, bookingDate, startTime, endTime, formData.client_name, clientPhone])
      }
      
      // Получаем название студии
      const studioData = await query(
        "SELECT name FROM studios WHERE id = (SELECT studio_id FROM services WHERE id = ?)",
        [serviceId]
      )
      const studioName = studioData[0]?.name || 'Студия звукозаписи Mini'
      
      await run(`
        INSERT INTO orders (
          client_name, client_phone, service_name, studio_name,
          title, description, reference_link, deadline_date, comments,
          booking_date, start_time, end_time,
          total_price, prepaid_amount, status, is_prepaid
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment', 0)
      `, [
        formData.client_name,
        clientPhone,
        service.name,
        studioName,
        formData.title || null,
        formData.description,
        formData.reference,
        formData.deadline,
        formData.comments,
        bookingDate,
        startTime,
        endTime,
        totalPrice,
        prepaidAmount
      ])
      
      setSubmitted(true)
    } catch (err) {
      console.error("Ошибка при сохранении:", err)
      alert("Ошибка при отправке. Попробуйте еще раз.")
    }
  }

  if (loading) return <div className="container"><p>Загрузка...</p></div>
  if (!service) return <div className="container"><p>Услуга не найдена</p></div>

  if (submitted) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '50px' }}>
        <h2>✅ Заявка отправлена!</h2>
        <p>Сумма предоплаты: {Math.round(totalPrice * 0.3)} ₽ (30%)</p>
        {selectedStart && selectedEnd && (
          <p>
            Вы выбрали время: {selectedStart.toLocaleDateString('ru-RU')} с {selectedStart.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})} 
            до {selectedEnd.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})}
          </p>
        )}
        <p>Мы свяжемся с вами для подтверждения записи.</p>
        <button onClick={() => navigate('/')}>Вернуться на главную</button>
      </div>
    )
  }

  const isHourlyService = !!hourlyRates[service.name]
  const hourlyRate = isHourlyService ? hourlyRates[service.name] : null
  const isVoiceService = service.name === 'Запись вокала'
  const isStudioRental = service.name === 'Аренда студии'
  const isExpressService = service.name === 'Экспресс сведение'

  return (
    <div className="container" style={{ maxWidth: '700px', margin: '0 auto' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: '20px', background: 'none', color: '#1976d2', padding: 0, cursor: 'pointer' }}>
        ← Назад
      </button>
      
      <h1>{service.name}</h1>
      <p>{service.description}</p>
      
      {isHourlyService && (
        <DateTimePicker 
          serviceId={serviceId} 
          onTimeSelected={handleTimeSelected}
          selectedStart={selectedStart}
          selectedEnd={selectedEnd}
        />
      )}
      
      <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
        <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#1976d2', margin: 0 }}>
          {totalPrice} ₽
        </p>
        <p style={{ margin: '5px 0 0', fontSize: '14px', color: '#666' }}>
          Предоплата: {Math.round(totalPrice * 0.3)} ₽ (30%)
        </p>
        {isHourlyService && selectedStart && selectedEnd && (
          <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#888' }}>
            * {(selectedEnd - selectedStart) / (1000 * 60 * 60)} ч × {hourlyRate} ₽/ч = {totalPrice} ₽
          </p>
        )}
        {isHourlyService && !selectedStart && (
          <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#888' }}>
            * Стоимость часа: {hourlyRate} ₽
          </p>
        )}
      </div>

      {isHourlyService && (
        <form onSubmit={handleSubmit}>
          <h3>Ваши данные</h3>

          <div className="form-group">
            <label>Ваше имя *</label>
            <input type="text" name="client_name" required onChange={handleChange} />
          </div>

          {isVoiceService && (
            <>
              <div className="form-group">
                <label>Название трека</label>
                <input type="text" name="title" onChange={handleChange} placeholder="Название песни" />
              </div>
              <div className="form-group">
                <label>Пожелания</label>
                <textarea name="comments" rows="3" onChange={handleChange} placeholder="Что нужно учесть при записи?" />
              </div>
            </>
          )}

          {isStudioRental && (
            <>
              <div className="form-group">
                <label>Название мероприятия / проекта</label>
                <input type="text" name="title" onChange={handleChange} placeholder="Например: Запись альбома, Репетиция" />
              </div>
              <div className="form-group">
                <label>Дополнительные пожелания</label>
                <textarea name="comments" rows="3" onChange={handleChange} placeholder="Какое оборудование нужно? Есть особые требования?" />
              </div>
            </>
          )}

          <button 
            type="submit" 
            disabled={!selectedStart || !selectedEnd}
            style={{
              background: (selectedStart && selectedEnd) ? '#1976d2' : '#ccc',
              color: 'white',
              padding: '15px 30px',
              fontSize: '16px',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '8px',
              cursor: (selectedStart && selectedEnd) ? 'pointer' : 'not-allowed',
              width: '100%',
              marginTop: '20px'
            }}
          >
            {(selectedStart && selectedEnd) ? 'Забронировать и внести предоплату (30%)' : 'Сначала выберите дату и время'}
          </button>
        </form>
      )}

      {isExpressService && (
        <form onSubmit={handleSubmit}>
          <h3>Данные для сведения</h3>

          <div className="form-group">
            <label>Ваше имя *</label>
            <input type="text" name="client_name" required onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Заголовок *</label>
            <input type="text" name="title" required onChange={handleChange} placeholder="Название вашего трека" />
          </div>

          <div className="form-group">
            <label>Описание услуги *</label>
            <textarea name="description" rows="3" required onChange={handleChange} placeholder="Опишите, что нужно сделать с треком..." />
          </div>

          <div className="form-group">
            <label>Референс (ссылка на пример) *</label>
            <input type="url" name="reference" required onChange={handleChange} placeholder="https://soundcloud.com/example" />
          </div>

          <div className="form-group">
            <label>Дедлайн сдачи *</label>
            <input type="date" name="deadline" required onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Комментарии</label>
            <textarea name="comments" rows="4" onChange={handleChange} placeholder="Дополнительные пожелания, особенности..." />
          </div>

          <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>💰 Стоимость услуги: 700 ₽ (фиксированная)</p>
            <p style={{ margin: '5px 0 0', fontSize: '14px' }}>Предоплата: 210 ₽ (30%)</p>
          </div>

          <button type="submit" style={{
            background: '#1976d2',
            color: 'white',
            padding: '15px 30px',
            fontSize: '16px',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '100%',
            marginTop: '20px'
          }}>
            Отправить заявку
          </button>
        </form>
      )}

      {!isHourlyService && !isExpressService && (
        <form onSubmit={handleSubmit}>
          <h3>Ваши данные</h3>
          
          <div className="form-group">
            <label>Ваше имя *</label>
            <input type="text" name="client_name" required onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Описание задачи</label>
            <textarea name="description" rows="4" onChange={handleChange} placeholder="Расскажите, что нужно сделать..." />
          </div>

          <div className="form-group">
            <label>Ссылка на референс (пример)</label>
            <input type="url" name="reference" onChange={handleChange} placeholder="https://..." />
          </div>

          <div className="form-group">
            <label>Желаемая дата выполнения (дедлайн)</label>
            <input type="date" name="deadline" onChange={handleChange} />
          </div>

          <button type="submit" style={{
            background: '#1976d2',
            color: 'white',
            padding: '15px 30px',
            fontSize: '16px',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '100%',
            marginTop: '20px'
          }}>
            Забронировать и внести предоплату (30%)
          </button>
        </form>
      )}
    </div>
  )
}