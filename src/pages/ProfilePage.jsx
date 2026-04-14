import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, onAuthChange } from '../lib/firebase';
import { query, run } from '../lib/database';
import UsernameModal from '../components/UsernameModal';
import PhoneAuth from '../components/PhoneAuth';
import { signOut } from 'firebase/auth';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  // Загрузка пользователя и его профиля
  useEffect(() => {
    const unsubscribe = onAuthChange(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // Загружаем профиль из БД
        const profile = await query(
          "SELECT * FROM user_profiles WHERE user_phone = ?",
          [currentUser.phoneNumber]
        );
        
        if (profile.length > 0) {
          setUserProfile(profile[0]);
          if (profile[0].avatar) setAvatar(profile[0].avatar);
        } else {
          setShowUsernameModal(true);
        }
        
        // Загружаем заказы пользователя
        const orders = await query(
          "SELECT * FROM orders WHERE client_phone = ? ORDER BY created_at DESC",
          [currentUser.phoneNumber]
        );
        setUserOrders(orders);
      } else {
        setUser(null);
        setUserProfile(null);
        setUserOrders([]);
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const handleUsernameSuccess = (newUsername) => {
    setUserProfile(prev => ({ ...prev, username: newUsername }));
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/profile');
    } catch (err) {
      console.error('Ошибка выхода:', err);
    }
  };

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    window.location.reload();
  };

  // Обработчик оплаты предоплаты
  const handlePayPrepayment = async (orderId) => {
    const order = userOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const confirmed = window.confirm(`Подтвердите оплату предоплаты в размере ${Math.round(order.prepaid_amount)} ₽`);
    
    if (confirmed) {
      await run(
        "UPDATE orders SET is_prepaid = 1, status = 'in_progress' WHERE id = ?",
        [orderId]
      );
      
      setUserOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, is_prepaid: 1, status: 'in_progress' } : o
      ));
      
      alert('✅ Предоплата подтверждена! Заявка переведена в статус "В процессе"');
    }
  };

  // Обработчик отмены заявки
  const handleCancelOrder = async (orderId) => {
    const confirmed = window.confirm('Вы уверены, что хотите отменить эту заявку?');
    
    if (confirmed) {
      const order = userOrders.find(o => o.id === orderId);
      
      if (order.booking_date && order.start_time) {
        await run(
          "DELETE FROM bookings WHERE booking_date = ? AND start_time = ? AND client_phone = ?",
          [order.booking_date, order.start_time, user?.phoneNumber]
        );
      }
      
      await run(
        "UPDATE orders SET status = 'cancelled' WHERE id = ?",
        [orderId]
      );
      
      setUserOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: 'cancelled' } : o
      ));
      
      alert('❌ Заявка отменена');
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (file && user) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const avatarData = reader.result;
        setAvatar(avatarData);
        await run(
          "UPDATE user_profiles SET avatar = ? WHERE user_phone = ?",
          [avatarData, user.phoneNumber]
        );
      };
      reader.readAsDataURL(file);
    }
  };

  // Фильтрация заказов
  const filteredOrders = userOrders.filter(order => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'awaiting_payment') return order.status === 'awaiting_payment' && !order.is_prepaid;
    if (activeFilter === 'in_progress') return order.status === 'in_progress';
    if (activeFilter === 'completed') return order.status === 'completed';
    if (activeFilter === 'cancelled') return order.status === 'cancelled';
    return true;
  });

  const displayedOrders = showAllOrders ? filteredOrders : filteredOrders.slice(0, 3);

  // Статистика заказов
  const stats = {
    total: userOrders.length,
    awaitingPayment: userOrders.filter(o => o.status === 'awaiting_payment' && !o.is_prepaid).length,
    inProgress: userOrders.filter(o => o.status === 'in_progress').length,
    completed: userOrders.filter(o => o.status === 'completed').length,
    cancelled: userOrders.filter(o => o.status === 'cancelled').length
  };

  const getStatusText = (status, isPrepaid) => {
    if (status === 'awaiting_payment' && !isPrepaid) return 'Ожидает оплаты';
    if (status === 'in_progress') return 'В процессе';
    if (status === 'completed') return 'Выполнено';
    if (status === 'cancelled') return 'Отменено';
    return status;
  };

  const getStatusColor = (status, isPrepaid) => {
    if (status === 'awaiting_payment' && !isPrepaid) return '#ff9800';
    if (status === 'in_progress') return '#2196f3';
    if (status === 'completed') return '#4caf50';
    if (status === 'cancelled') return '#f44336';
    return '#666';
  };

  if (loading) {
    return <div className="container"><p>Загрузка...</p></div>;
  }

  if (!user) {
    return (
      <div className="container" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Мой профиль</h1>
        <PhoneAuth onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <UsernameModal
        isOpen={showUsernameModal}
        onClose={() => setShowUsernameModal(false)}
        onSuccess={handleUsernameSuccess}
        userPhone={user.phoneNumber}
        existingUsername={userProfile?.username || null}
      />

      {/* Шапка профиля */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            color: '#1976d2',
            fontSize: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          ← Главная страница
        </button>
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              🔔
              {stats.awaitingPayment > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  background: 'red',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {stats.awaitingPayment}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div style={{
                position: 'absolute',
                top: '35px',
                right: '0',
                width: '300px',
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 100,
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                <div style={{ padding: '10px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>
                  Уведомления
                </div>
                {userOrders.filter(o => o.status === 'awaiting_payment' && !o.is_prepaid).length > 0 ? (
                  userOrders.filter(o => o.status === 'awaiting_payment' && !o.is_prepaid).map(order => (
                    <div key={order.id} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                      <p style={{ margin: 0 }}>⏳ {order.service_name} ожидает оплаты</p>
                      <small style={{ color: '#666' }}>{order.created_at?.slice(0, 10)}</small>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                    Нет новых уведомлений
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Фото профиля и никнейм */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '30px', 
        marginBottom: '30px',
        padding: '20px',
        background: document.body.classList.contains('dark') ? '#1e1e1e' : '#f5f5f5',
        borderRadius: '15px',
        flexWrap: 'wrap'
      }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: avatar ? 'transparent' : '#1976d2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            fontSize: '40px'
          }}>
            {avatar ? (
              <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              '👤'
            )}
          </div>
          <label style={{
            position: 'absolute',
            bottom: '0',
            right: '0',
            background: '#1976d2',
            color: 'white',
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '20px'
          }}>
            +
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>
              {userProfile?.username || 'Пользователь'}
            </h2>
            
            {/* Отображение роли */}
            {userProfile?.role === 'worker' && (
              <span style={{ background: '#4caf50', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '12px' }}>
                👨‍💼 Работник
              </span>
            )}
            {userProfile?.role === 'admin' && (
              <span style={{ background: '#f44336', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '12px' }}>
                👑 Администратор
              </span>
            )}
            {(!userProfile?.role || userProfile?.role === 'client') && (
              <span style={{ background: '#1976d2', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '12px' }}>
                👤 Клиент
              </span>
            )}
            
            <button
              onClick={() => setShowUsernameModal(true)}
              style={{
                background: 'none',
                border: '1px solid #1976d2',
                color: '#1976d2',
                padding: '5px 12px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ✏️ Сменить ник
            </button>
            <button
              onClick={handleLogout}
              style={{
                background: 'none',
                border: '1px solid #dc3545',
                color: '#dc3545',
                padding: '5px 12px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '12px',
                marginLeft: 'auto'
              }}
            >
              🚪 Выйти
            </button>
          </div>
          <p style={{ color: '#666', marginTop: '5px' }}>{user.phoneNumber}</p>
        </div>
      </div>

      {/* Статистика аккаунта */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '10px',
        marginBottom: '30px'
      }}>
        <div 
          onClick={() => setActiveFilter('all')}
          style={{ 
            textAlign: 'center', 
            padding: '12px', 
            background: activeFilter === 'all' ? '#1976d2' : '#e3f2fd', 
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <h3 style={{ margin: 0, color: activeFilter === 'all' ? 'white' : '#1976d2' }}>{stats.total}</h3>
          <p style={{ margin: '5px 0 0', fontSize: '11px', color: activeFilter === 'all' ? 'rgba(255,255,255,0.8)' : '#666' }}>Всего</p>
        </div>
        <div 
          onClick={() => setActiveFilter('awaiting_payment')}
          style={{ 
            textAlign: 'center', 
            padding: '12px', 
            background: activeFilter === 'awaiting_payment' ? '#ff9800' : '#fff3e0', 
            borderRadius: '10px',
            cursor: 'pointer'
          }}
        >
          <h3 style={{ margin: 0, color: activeFilter === 'awaiting_payment' ? 'white' : '#ff9800' }}>{stats.awaitingPayment}</h3>
          <p style={{ margin: '5px 0 0', fontSize: '11px', color: activeFilter === 'awaiting_payment' ? 'rgba(255,255,255,0.8)' : '#666' }}>Ожидают</p>
        </div>
        <div 
          onClick={() => setActiveFilter('in_progress')}
          style={{ 
            textAlign: 'center', 
            padding: '12px', 
            background: activeFilter === 'in_progress' ? '#2196f3' : '#e3f2fd', 
            borderRadius: '10px',
            cursor: 'pointer'
          }}
        >
          <h3 style={{ margin: 0, color: activeFilter === 'in_progress' ? 'white' : '#2196f3' }}>{stats.inProgress}</h3>
          <p style={{ margin: '5px 0 0', fontSize: '11px', color: activeFilter === 'in_progress' ? 'rgba(255,255,255,0.8)' : '#666' }}>В процессе</p>
        </div>
        <div 
          onClick={() => setActiveFilter('completed')}
          style={{ 
            textAlign: 'center', 
            padding: '12px', 
            background: activeFilter === 'completed' ? '#4caf50' : '#e8f5e9', 
            borderRadius: '10px',
            cursor: 'pointer'
          }}
        >
          <h3 style={{ margin: 0, color: activeFilter === 'completed' ? 'white' : '#4caf50' }}>{stats.completed}</h3>
          <p style={{ margin: '5px 0 0', fontSize: '11px', color: activeFilter === 'completed' ? 'rgba(255,255,255,0.8)' : '#666' }}>Выполнено</p>
        </div>
        <div 
          onClick={() => setActiveFilter('cancelled')}
          style={{ 
            textAlign: 'center', 
            padding: '12px', 
            background: activeFilter === 'cancelled' ? '#f44336' : '#ffebee', 
            borderRadius: '10px',
            cursor: 'pointer'
          }}
        >
          <h3 style={{ margin: 0, color: activeFilter === 'cancelled' ? 'white' : '#f44336' }}>{stats.cancelled}</h3>
          <p style={{ margin: '5px 0 0', fontSize: '11px', color: activeFilter === 'cancelled' ? 'rgba(255,255,255,0.8)' : '#666' }}>Отменено</p>
        </div>
      </div>

      {/* Мои заявки */}
      <h2>Мои заявки</h2>
      
      {displayedOrders.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          {activeFilter === 'all' ? 'У вас пока нет заявок' : 'Нет заявок в этом разделе'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {displayedOrders.map(order => (
            <div key={order.id} style={{
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              padding: '15px',
              background: 'white',
              transition: 'box-shadow 0.2s'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '5px' }}>
                    <h3 style={{ margin: 0 }}>{order.service_name}</h3>
                    <span style={{
                      background: '#e3f2fd',
                      color: '#1976d2',
                      padding: '2px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: '500'
                    }}>
                      🏢 {order.studio_name || 'Студия звукозаписи Mini'}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                    {order.booking_date && `${order.booking_date} ${order.start_time || ''}`}
                  </p>
                  {order.title && (
                    <p style={{ margin: '5px 0 0', fontSize: '14px', color: '#333' }}>🎵 {order.title}</p>
                  )}
                  <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#999' }}>
                    Создано: {new Date(order.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    background: getStatusColor(order.status, order.is_prepaid),
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    display: 'inline-block'
                  }}>
                    {getStatusText(order.status, order.is_prepaid)}
                  </span>
                  <p style={{ margin: '8px 0 0', fontWeight: 'bold', color: '#1976d2' }}>
                    {order.total_price} ₽
                  </p>
                  {order.status === 'awaiting_payment' && !order.is_prepaid && (
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#ff9800' }}>
                      Предоплата: {Math.round(order.prepaid_amount)} ₽
                    </p>
                  )}
                </div>
              </div>
              
              {/* Кнопки действий */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px', justifyContent: 'flex-end' }}>
                {order.status === 'awaiting_payment' && !order.is_prepaid && (
                  <button
                    onClick={() => handlePayPrepayment(order.id)}
                    style={{
                      background: '#4caf50',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    💳 Оплатить предоплату ({Math.round(order.prepaid_amount)} ₽)
                  </button>
                )}
                
                {order.status !== 'completed' && order.status !== 'cancelled' && (
                  <button
                    onClick={() => handleCancelOrder(order.id)}
                    style={{
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    ❌ Отменить заявку
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredOrders.length > 3 && !showAllOrders && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            onClick={() => setShowAllOrders(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#1976d2',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Посмотреть полностью ({filteredOrders.length - 3} еще) →
          </button>
        </div>
      )}

      {showAllOrders && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            onClick={() => setShowAllOrders(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#1976d2',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← Скрыть
          </button>
        </div>
      )}
    </div>
  );
}