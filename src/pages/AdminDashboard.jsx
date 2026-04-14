import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, onAuthChange } from '../lib/firebase';
import { query, run } from '../lib/database';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    completedOrders: 0,
    activeWorkers: 0,
    totalClients: 0
  });
  const [ordersByMonth, setOrdersByMonth] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (currentUser) => {
      console.log('1. onAuthChange вызван, currentUser:', currentUser);
      
      if (!currentUser) {
        console.log('2. Нет пользователя, редирект на главную');
        navigate('/');
        return;
      }
      
      setUser(currentUser);
      console.log('3. Пользователь установлен:', currentUser.phoneNumber);
      
      try {
        console.log('4. Проверяем права админа...');
        const profile = await query(
          "SELECT role FROM user_profiles WHERE user_phone = ?",
          [currentUser.phoneNumber]
        );
        console.log('5. Профиль загружен:', profile);
        
        if (profile.length === 0 || profile[0].role !== 'admin') {
          console.log('6. Нет прав администратора');
          alert('У вас нет доступа к панели администратора');
          navigate('/');
          return;
        }
        
        console.log('7. Загружаем данные...');
        await loadData();
        console.log('8. Данные загружены');
      } catch (err) {
        console.error('Ошибка при загрузке:', err);
      }
      
      setLoading(false);
      console.log('9. loading установлен в false');
    });
    
    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    try {
      console.log('loadData: загружаем заказы...');
      const orders = await query("SELECT * FROM orders");
      console.log('Заказов получено:', orders.length);
      
      const completed = orders.filter(o => o.status === 'completed');
      const totalRevenue = completed.reduce((sum, o) => sum + (o.total_price || 0), 0);
      
      // Получаем работников
      console.log('loadData: загружаем работников...');
      const workersList = await query(
        "SELECT * FROM user_profiles WHERE role = 'worker'"
      );
      console.log('Работников:', workersList.length);
      
      // Получаем клиентов
      const clientsList = await query(
        "SELECT * FROM user_profiles WHERE role = 'client' OR role IS NULL"
      );
      
      // Заказы по месяцам
      const monthly = {};
      orders.forEach(order => {
        if (order.created_at) {
          const month = order.created_at.slice(0, 7);
          if (month) {
            monthly[month] = (monthly[month] || 0) + 1;
          }
        }
      });
      
      const monthlyData = Object.entries(monthly).map(([month, count]) => ({ month, count }));
      console.log('Данные по месяцам:', monthlyData);
      
      // Последние 5 заказов
      const recent = [...orders].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      ).slice(0, 5);
      
      setStats({
        totalOrders: orders.length,
        totalRevenue: totalRevenue,
        completedOrders: completed.length,
        activeWorkers: workersList.length,
        totalClients: clientsList.length
      });
      
      setOrdersByMonth(monthlyData);
      setWorkers(workersList);
      setRecentOrders(recent);
      
    } catch (err) {
      console.error('Ошибка в loadData:', err);
    }
  };

  // Функция для изменения процента работника
  const updateWorkerPercentage = async (workerId, newPercentage) => {
    try {
      await run(
        "UPDATE user_profiles SET worker_percentage = ? WHERE id = ?",
        [newPercentage, workerId]
      );
      alert('Процент заработка обновлен!');
      await loadData();
    } catch (err) {
      console.error('Ошибка обновления:', err);
      alert('Ошибка при обновлении');
    }
  };

  // Функция для удаления работника
  const removeWorker = async (workerId) => {
    const confirmed = window.confirm('Удалить этого работника?');
    if (!confirmed) return;
    
    try {
      await run(
        "DELETE FROM user_profiles WHERE id = ?",
        [workerId]
      );
      alert('Работник удален');
      await loadData();
    } catch (err) {
      console.error('Ошибка удаления:', err);
      alert('Ошибка при удалении');
    }
  };

  if (loading) {
    console.log('Рендерим состояние загрузки...');
    return <div className="container"><p>Загрузка...</p></div>;
  }

  console.log('Рендерим админ-панель');

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>👑 Админ-панель</h1>
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

      {/* Карточки статистики */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{ background: '#e3f2fd', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: '#1976d2' }}>{stats.totalOrders}</h2>
          <p style={{ margin: '5px 0 0', color: '#666' }}>Всего заявок</p>
        </div>
        <div style={{ background: '#e8f5e9', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: '#4caf50' }}>{stats.completedOrders}</h2>
          <p style={{ margin: '5px 0 0', color: '#666' }}>Выполнено</p>
        </div>
        <div style={{ background: '#fff3e0', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: '#ff9800' }}>{stats.totalRevenue.toLocaleString()} ₽</h2>
          <p style={{ margin: '5px 0 0', color: '#666' }}>Выручка</p>
        </div>
        <div style={{ background: '#f3e5f5', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: '#9c27b0' }}>{stats.activeWorkers}</h2>
          <p style={{ margin: '5px 0 0', color: '#666' }}>Работников</p>
        </div>
        <div style={{ background: '#e0f7fa', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: '#00acc1' }}>{stats.totalClients}</h2>
          <p style={{ margin: '5px 0 0', color: '#666' }}>Клиентов</p>
        </div>
      </div>

      {/* График */}
      <div style={{ marginBottom: '30px' }}>
        <h2>📈 Динамика заявок по месяцам</h2>
        {ordersByMonth.length === 0 ? (
          <p style={{ color: '#666', padding: '20px' }}>Нет данных для графика</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', height: '250px', marginTop: '20px', overflowX: 'auto' }}>
            {ordersByMonth.map((item, idx) => {
              const maxCount = Math.max(...ordersByMonth.map(i => i.count), 1);
              const height = (item.count / maxCount) * 180;
              return (
                <div key={idx} style={{ textAlign: 'center', flex: 1, minWidth: '60px' }}>
                  <div style={{
                    height: `${height}px`,
                    background: '#1976d2',
                    borderRadius: '8px 8px 0 0',
                    width: '100%',
                    transition: 'height 0.3s'
                  }}></div>
                  <p style={{ margin: '10px 0 0', fontSize: '12px' }}>{item.month}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>{item.count}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Последние заказы */}
      <div style={{ marginBottom: '30px' }}>
        <h2>📋 Последние заявки</h2>
        {recentOrders.length === 0 ? (
          <p style={{ color: '#666', padding: '20px' }}>Нет заявок</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentOrders.map(order => (
              <div key={order.id} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{order.service_name}</p>
                  <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#666' }}>Клиент: {order.client_name}</p>
                </div>
                <div>
                  <span style={{
                    background: order.status === 'completed' ? '#4caf50' : (order.status === 'in_progress' ? '#2196f3' : '#ff9800'),
                    color: 'white',
                    padding: '2px 10px',
                    borderRadius: '20px',
                    fontSize: '11px'
                  }}>
                    {order.status === 'awaiting_payment' ? 'Ожидает оплаты' : 
                     order.status === 'in_progress' ? 'В процессе' : 
                     order.status === 'completed' ? 'Выполнено' : order.status}
                  </span>
                  <p style={{ margin: '5px 0 0', fontSize: '12px', fontWeight: 'bold', color: '#1976d2' }}>{order.total_price} ₽</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Список работников */}
      <h2>👨‍💼 Сотрудники</h2>
      {workers.length === 0 ? (
        <p style={{ color: '#666', padding: '20px' }}>Нет зарегистрированных работников</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {workers.map(worker => (
            <div key={worker.id} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 'bold' }}>{worker.username || 'Работник'}</p>
                <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#666' }}>{worker.user_phone}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '12px' }}>Процент:</span>
                  <input
                    type="number"
                    defaultValue={worker.worker_percentage}
                    onBlur={(e) => updateWorkerPercentage(worker.id, e.target.value)}
                    style={{
                      width: '60px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid #ddd',
                      textAlign: 'center'
                    }}
                  />
                  <span>%</span>
                </div>
                <button
                  onClick={() => removeWorker(worker.id)}
                  style={{
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}