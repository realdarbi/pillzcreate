import { useNavigate } from 'react-router-dom';

export default function CreditsPage() {
  const navigate = useNavigate();

  const clients = [
    { name: 'Kurt Guetto', project: 'Сингл "Uno Dos Tres"', year: 2025, icon: '🎤' },
    { name: 'Мария Петрова', project: 'Сингл "Лети"', year: 2024, icon: '🎵' },
    { name: 'Алексей Смирнов', project: 'EP "Космос"', year: 2023, icon: '🎸' },
    { name: 'Елена Козлова', project: 'Альбом "Мечты"', year: 2023, icon: '🎹' },
    { name: 'Дмитрий Новиков', project: 'Сингл "Ветер"', year: 2024, icon: '🥁' },
    { name: 'Анна Морозова', project: 'Альбом "Зима"', year: 2023, icon: '🎤' },
    { name: 'Сергей Волков', project: 'EP "Город"', year: 2024, icon: '🎸' },
    { name: 'Ольга Соколова', project: 'Сингл "Счастье"', year: 2023, icon: '🎹' }
  ];

  return (
    <div className="container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'none',
          border: 'none',
          color: '#1976d2',
          fontSize: '16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          marginBottom: '30px'
        }}
      >
        ← Назад
      </button>

      <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>Наши известные клиенты</h1>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: '40px' }}>
        Мы гордимся сотрудничеством с талантливыми артистами
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '20px'
      }}>
        {clients.map((client, idx) => (
          <div key={idx} style={{
            padding: '20px',
             background: document.body.classList.contains('dark') ? '#1e1e1e' : '#f5f5f5',
            borderRadius: '12px',
            textAlign: 'center',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer',
            ':hover': {
              transform: 'translateY(-5px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }
          }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>{client.icon}</div>
            <h3 style={{ margin: '0 0 5px 0' }}>{client.name}</h3>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>{client.project}</p>
            <p style={{ margin: '5px 0 0', color: '#1976d2', fontSize: '12px', fontWeight: 'bold' }}>{client.year}</p>
          </div>
        ))}
      </div>

      {/* Статистика */}
      <div style={{
        marginTop: '50px',
        padding: '20px',
        background: 'linear-gradient(135deg, #1976d2, #1565c0)',
        borderRadius: '12px',
        textAlign: 'center',
        color: 'white'
      }}>
        <h3 style={{ margin: 0 }}>Всего проектов: {clients.length}</h3>
        <p style={{ margin: '10px 0 0', opacity: 0.9 }}>Спасибо каждому артисту за доверие!</p>
      </div>
    </div>
  );
}