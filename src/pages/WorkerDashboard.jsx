import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, onAuthChange } from '../lib/firebase';
import { query, run } from '../lib/database';

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('available');
  const [availableOrders, setAvailableOrders] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [mySlots, setMySlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [stats, setStats] = useState({ totalEarned: 0, completedCount: 0, inProgressCount: 0, activeSlotsCount: 0 });

  useEffect(() => {
    const unsubscribe = onAuthChange(async (currentUser) => {
      if (!currentUser) {
        navigate('/');
        return;
      }
      
      setUser(currentUser);
      
      try {
        const profile = await query(
          "SELECT * FROM user_profiles WHERE user_phone = ?",
          [currentUser.phoneNumber]
        );
        
        if (profile.length === 0 || (profile[0].role !== 'worker' && profile[0].role !== 'admin')) {
          alert('У вас нет доступа к панели работника');
          navigate('/');
          return;
        }
        
        setUserProfile(profile[0]);
        await loadData(currentUser.phoneNumber, profile[0].worker_percentage || 30);
      } catch (err) {
        console.error('Ошибка при загрузке:', err);
      }
      
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const loadData = async (workerPhone, percentage) => {
    try {
      // Доступные онлайн-заявки (с ником клиента)
      const orders = await query(
        `SELECT o.*, up.username as client_username 
         FROM orders o
         LEFT JOIN user_profiles up ON o.client_phone = up.user_phone
         WHERE o.status IN ('awaiting_payment', 'in_progress')
         AND (o.worker_id IS NULL OR o.worker_id = '')
         ORDER BY o.created_at ASC`
      );
      setAvailableOrders(orders);

      // Доступные оффлайн слоты
      const slots = await query(
        `SELECT s.*, serv.name as service_name, serv.price, serv.estimated_duration_minutes
         FROM slots s
         JOIN services serv ON s.service_id = serv.id
         WHERE s.is_booked = 0 AND s.date >= date('now')
         ORDER BY s.date, s.start_time`
      );
      setAvailableSlots(slots);

      // Мои онлайн-заявки (взятые в работу)
      const my = await query(
        `SELECT o.*, up.username as client_username 
         FROM orders o
         LEFT JOIN user_profiles up ON o.client_phone = up.user_phone
         WHERE o.worker_id = ?
         ORDER BY o.created_at DESC`,
        [workerPhone]
      );
      setMyOrders(my);

      // Мои забронированные слоты
      const mySlotsData = await query(
        `SELECT s.*, serv.name as service_name, serv.price, serv.estimated_duration_minutes, up.username as client_username
         FROM slots s
         JOIN services serv ON s.service_id = serv.id
         LEFT JOIN user_profiles up ON s.client_phone = up.user_phone
         WHERE s.worker_id = ?
         ORDER BY s.date, s.start_time`,
        [workerPhone]
      );
      setMySlots(mySlotsData);

      // Статистика
      const completed = my.filter(o => o.status === 'completed');
      const inProgress = my.filter(o => o.status === 'in_progress');
      const totalEarned = completed.reduce((sum, o) => sum + (o.worker_earnings || 0), 0);
      
      setStats({
        totalEarned: Math.round(totalEarned),
        completedCount: completed.length,
        inProgressCount: inProgress.length,
        activeSlotsCount: mySlotsData.length
      });
    } catch (err) {
      console.error('Ошибка в loadData:', err);
    }
  };

  // Фильтрация заявок по типу услуги
  const getFilteredOrders = (orders) => {
    if (filterType === 'all') return orders;
    return orders.filter(order => order.service_name === filterType);
  };

  // Получение уникальных типов услуг для фильтра
  const getUniqueServiceTypes = (orders) => {
    const types = [...new Set(orders.map(o => o.service_name))];
    return types;
  };

  // Взятие онлайн-заявки
  const takeOnlineOrder = async (orderId) => {
    const confirmed = window.confirm('Взять эту заявку в работу?');
    if (!confirmed) return;

    try {
      await run(
        "UPDATE orders SET worker_id = ?, status = 'in_progress' WHERE id = ?",
        [user.phoneNumber, orderId]
      );
      alert('✅ Заявка принята!');
      await loadData(user.phoneNumber, userProfile?.worker_percentage || 30);
    } catch (err) {
      console.error('Ошибка при взятии заявки:', err);
      alert('Ошибка при взятии заявки');
    }
  };

  // Взятие оффлайн слота
  const takeOfflineSlot = async (slotId) => {
    const confirmed = window.confirm('Забронировать этот слот?');
    if (!confirmed) return;

    try {
      await run(
        "UPDATE slots SET is_booked = 1, worker_id = ? WHERE id = ?",
        [user.phoneNumber, slotId]
      );
      alert('✅ Слот забронирован!');
      await loadData(user.phoneNumber, userProfile?.worker_percentage || 30);
    } catch (err) {
      console.error('Ошибка при бронировании слота:', err);
      alert('Ошибка при бронировании слота');
    }
  };

  // Отмена бронирования слота
  const cancelSlot = async (slotId) => {
    const confirmed = window.confirm('Отменить бронирование этого слота?');
    if (!confirmed) return;

    try {
      await run(
        "UPDATE slots SET is_booked = 0, worker_id = NULL WHERE id = ?",
        [slotId]
      );
      alert('❌ Бронирование слота отменено');
      await loadData(user.phoneNumber, userProfile?.worker_percentage || 30);
    } catch (err) {
      console.error('Ошибка при отмене слота:', err);
      alert('Ошибка при отмене слота');
    }
  };

  // Отметить заявку как выполненную
  const markAsCompleted = async (orderId, orderTotal) => {
    const confirmed = window.confirm('Отметить заявку как выполненную?');
    if (!confirmed) return;

    try {
      const earnings = orderTotal * (userProfile?.worker_percentage || 30) / 100;
      await run(
        "UPDATE orders SET status = 'completed', worker_earnings = ? WHERE id = ?",
        [Math.round(earnings), orderId]
      );
      alert(`✅ Заявка отмечена как выполненная! Ваш заработок: ${Math.round(earnings)} ₽`);
      await loadData(user.phoneNumber, userProfile?.worker_percentage || 30);
    } catch (err) {
      console.error('Ошибка при завершении заявки:', err);
      alert('Ошибка при завершении заявки');
    }
  };

  if (loading) {
    return <div className="container"><p>Загрузка...</p></div>;
  }

  const uniqueServiceTypes = getUniqueServiceTypes([...availableOrders, ...myOrders]);
  const filteredAvailableOrders = getFilteredOrders(availableOrders);
  const filteredMyOrders = getFilteredOrders(myOrders);

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>👨‍💼 Панель работника</h1>
        <button
          onClick={() => navigate('/profile')}
          style={{
            background: '#1976d2',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          👤 Мой профиль
        </button>
      </div>

      {/* Статистика */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{ background: '#e8f5e9', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
          <h3 style={{ margin: 0, color: '#4caf50' }}>{stats.totalEarned} ₽</h3>
          <p style={{ margin: '5px 0 0', color: '#666' }}>Заработано всего</p>
        </div>
        <div style={{ background: '#e3f2fd', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
          <h3 style={{ margin: 0, color: '#2196f3' }}>{stats.inProgressCount}</h3>
          <p style={{ margin: '5px 0 0', color: '#666' }}>В работе</p>
        </div>
        <div style={{ background: '#fff3e0', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
          <h3 style={{ margin: 0, color: '#ff9800' }}>{stats.completedCount}</h3>
          <p style={{ margin: '5px 0 0', color: '#666' }}>Выполнено</p>
        </div>
        <div style={{ background: '#f3e5f5', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
          <h3 style={{ margin: 0, color: '#9c27b0' }}>{stats.activeSlotsCount}</h3>
          <p style={{ margin: '5px 0 0', color: '#666' }}>Мои слоты</p>
        </div>
      </div>

      {/* Фильтр по типу услуги */}
      {uniqueServiceTypes.length > 0 && (
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold' }}>Фильтр по услуге:</span>
          <button
            onClick={() => setFilterType('all')}
            style={{
              background: filterType === 'all' ? '#1976d2' : '#f0f0f0',
              color: filterType === 'all' ? 'white' : '#333',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '20px',
              cursor: 'pointer'
            }}
          >
            Все
          </button>
          {uniqueServiceTypes.map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              style={{
                background: filterType === type ? '#1976d2' : '#f0f0f0',
                color: filterType === type ? 'white' : '#333',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '20px',
                cursor: 'pointer'
              }}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Вкладки */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #ddd' }}>
        <button
          onClick={() => setActiveTab('available')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 20px',
            cursor: 'pointer',
            borderBottom: activeTab === 'available' ? '2px solid #1976d2' : 'none',
            color: activeTab === 'available' ? '#1976d2' : '#666',
            fontWeight: activeTab === 'available' ? 'bold' : 'normal'
          }}
        >
          📋 Доступные заявки
        </button>
        <button
          onClick={() => setActiveTab('my')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 20px',
            cursor: 'pointer',
            borderBottom: activeTab === 'my' ? '2px solid #1976d2' : 'none',
            color: activeTab === 'my' ? '#1976d2' : '#666',
            fontWeight: activeTab === 'my' ? 'bold' : 'normal'
          }}
        >
          ✅ Мои заявки
        </button>
        <button
          onClick={() => setActiveTab('myslots')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 20px',
            cursor: 'pointer',
            borderBottom: activeTab === 'myslots' ? '2px solid #1976d2' : 'none',
            color: activeTab === 'myslots' ? '#1976d2' : '#666',
            fontWeight: activeTab === 'myslots' ? 'bold' : 'normal'
          }}
        >
          📅 Мои слоты
        </button>
      </div>

      {activeTab === 'available' && (
        <>
          {/* Онлайн заявки */}
          <h2>🖥 Онлайн-услуги</h2>
          {filteredAvailableOrders.filter(o => {
            const isOnline = true;
            return true;
          }).length === 0 ? (
            <p style={{ color: '#666', padding: '20px' }}>Нет доступных онлайн-заявок</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
              {filteredAvailableOrders.map(order => (
                <div key={order.id} style={{ border: '1px solid #e0e0e0', borderRadius: '12px', padding: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{order.service_name}</h3>
                      <p style={{ margin: '5px 0', color: '#666' }}>
                        👤 Клиент: {order.client_username || order.client_name || 'Не указан'}
                      </p>
                      {order.title && <p style={{ margin: '5px 0' }}>🎵 {order.title}</p>}
                      {order.description && <p style={{ margin: '5px 0', fontSize: '14px' }}>{order.description}</p>}
                      {order.reference_link && (
                        <a href={order.reference_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px' }}>
                          🔊 Референс
                        </a>
                      )}
                      {order.deadline_date && (
                        <p style={{ margin: '5px 0', fontSize: '12px', color: '#ff9800' }}>⏰ Дедлайн: {order.deadline_date}</p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1976d2' }}>{order.total_price} ₽</p>
                      <p style={{ fontSize: '12px', color: '#666' }}>Ваш доход: {Math.round(order.total_price * (userProfile?.worker_percentage || 30) / 100)} ₽</p>
                      <button
                        onClick={() => takeOnlineOrder(order.id)}
                        style={{
                          background: '#4caf50',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          marginTop: '10px'
                        }}
                      >
                        📥 Взять в работу
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Оффлайн слоты */}
          <h2>📍 Оффлайн-запись (слоты)</h2>
          {availableSlots.length === 0 ? (
            <p style={{ color: '#666', padding: '20px' }}>Нет доступных слотов</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {availableSlots.map(slot => (
                <div key={slot.id} style={{ border: '1px solid #e0e0e0', borderRadius: '12px', padding: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{slot.service_name}</h3>
                      <p style={{ margin: '5px 0', color: '#666' }}>
                        👤 Клиент: {slot.client_username || slot.client_name || 'Не указан'}
                      </p>
                      <p style={{ margin: '5px 0', color: '#666' }}>
                        📅 {slot.date} ⏰ {slot.start_time} - {slot.end_time}
                      </p>
                      <p style={{ margin: '5px 0', fontSize: '14px' }}>Длительность: {slot.estimated_duration_minutes} мин</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1976d2' }}>{slot.price} ₽</p>
                      <p style={{ fontSize: '12px', color: '#666' }}>Ваш доход: {Math.round(slot.price * (userProfile?.worker_percentage || 30) / 100)} ₽</p>
                      <button
                        onClick={() => takeOfflineSlot(slot.id)}
                        style={{
                          background: '#4caf50',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          marginTop: '10px'
                        }}
                      >
                        📅 Забронировать слот
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'my' && (
        <>
          {filteredMyOrders.length === 0 ? (
            <p style={{ color: '#666', padding: '20px' }}>У вас пока нет взятых заявок</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {filteredMyOrders.map(order => {
                const isCompleted = order.status === 'completed';
                const isInProgress = order.status === 'in_progress';
                
                return (
                  <div key={order.id} style={{ border: '1px solid #e0e0e0', borderRadius: '12px', padding: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <h3 style={{ margin: 0 }}>{order.service_name}</h3>
                          <span style={{
                            background: isCompleted ? '#4caf50' : (isInProgress ? '#2196f3' : '#ff9800'),
                            color: 'white',
                            padding: '2px 10px',
                            borderRadius: '20px',
                            fontSize: '11px'
                          }}>
                            {isCompleted ? 'Выполнено' : (isInProgress ? 'В процессе' : order.status)}
                          </span>
                        </div>
                        <p style={{ margin: '5px 0', color: '#666' }}>
                          👤 Клиент: {order.client_username || order.client_name || 'Не указан'}
                        </p>
                        {order.booking_date && (
                          <p style={{ margin: '5px 0', color: '#666' }}>
                            📅 {order.booking_date} {order.start_time} - {order.end_time}
                          </p>
                        )}
                        {order.title && <p style={{ margin: '5px 0' }}>🎵 {order.title}</p>}
                        {order.comments && (
                          <p style={{ margin: '5px 0', fontSize: '14px',  background: document.body.classList.contains('dark') ? '#1e1e1e' : '#f5f5f5', padding: '8px', borderRadius: '8px' }}>
                            💬 {order.comments}
                          </p>
                        )}
                        {order.reference_link && (
                          <a href={order.reference_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px' }}>
                            🔊 Ссылка
                          </a>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1976d2' }}>{order.total_price} ₽</p>
                        <p style={{ fontSize: '12px', color: '#666' }}>
                          Ваш доход: {order.worker_earnings || Math.round(order.total_price * (userProfile?.worker_percentage || 30) / 100)} ₽
                        </p>
                        {!isCompleted && (
                          <button
                            onClick={() => markAsCompleted(order.id, order.total_price)}
                            style={{
                              background: '#4caf50',
                              color: 'white',
                              border: 'none',
                              padding: '8px 16px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              marginTop: '10px'
                            }}
                          >
                            ✅ Отметить выполненным
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'myslots' && (
        <>
          {mySlots.length === 0 ? (
            <p style={{ color: '#666', padding: '20px' }}>У вас пока нет забронированных слотов</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {mySlots.map(slot => {
                const isPast = new Date(slot.date) < new Date();
                return (
                  <div key={slot.id} style={{ border: '1px solid #e0e0e0', borderRadius: '12px', padding: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap' }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{slot.service_name}</h3>
                        <p style={{ margin: '5px 0', color: '#666' }}>
                          👤 Клиент: {slot.client_username || slot.client_name || 'Не указан'}
                        </p>
                        <p style={{ margin: '5px 0', color: '#666' }}>
                          📅 {slot.date} ⏰ {slot.start_time} - {slot.end_time}
                        </p>
                        <p style={{ margin: '5px 0', fontSize: '14px' }}>Длительность: {slot.estimated_duration_minutes} мин</p>
                        {isPast && (
                          <p style={{ margin: '5px 0', fontSize: '12px', color: '#4caf50' }}>✅ Слот уже прошел</p>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1976d2' }}>{slot.price} ₽</p>
                        <p style={{ fontSize: '12px', color: '#666' }}>Ваш доход: {Math.round(slot.price * (userProfile?.worker_percentage || 30) / 100)} ₽</p>
                        {!isPast && (
                          <button
                            onClick={() => cancelSlot(slot.id)}
                            style={{
                              background: '#dc3545',
                              color: 'white',
                              border: 'none',
                              padding: '8px 16px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              marginTop: '10px'
                            }}
                          >
                            ❌ Отменить бронь
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}