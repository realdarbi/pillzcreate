import { useState } from 'react';
import { query, run } from '../lib/database';

export default function UsernameModal({ isOpen, onClose, onSuccess, userPhone, existingUsername }) {
  const [username, setUsername] = useState(existingUsername || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const checkUsernameExists = async (name) => {
    // Проверяем, существует ли такой ник у другого пользователя
    const existing = await query(
      "SELECT username FROM user_profiles WHERE username = ? AND user_phone != ?",
      [name, userPhone]
    );
    return existing.length > 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const trimmedUsername = username.trim();
    
    if (trimmedUsername.length < 3) {
      setError('Никнейм должен содержать минимум 3 символа');
      setLoading(false);
      return;
    }

    if (trimmedUsername.length > 20) {
      setError('Никнейм не должен превышать 20 символов');
      setLoading(false);
      return;
    }

    // Проверяем уникальность
    const exists = await checkUsernameExists(trimmedUsername);
    if (exists) {
      setError('Такой никнейм уже занят, выберите другой');
      setLoading(false);
      return;
    }

    // Проверяем, есть ли уже запись для этого пользователя
    const existingProfile = await query(
      "SELECT * FROM user_profiles WHERE user_phone = ?",
      [userPhone]
    );
    
    if (existingProfile.length > 0) {
      // Обновляем существующую запись
      await run(
        "UPDATE user_profiles SET username = ? WHERE user_phone = ?",
        [trimmedUsername, userPhone]
      );
    } else {
      // Создаем новую запись
      await run(
        "INSERT INTO user_profiles (user_phone, username) VALUES (?, ?)",
        [userPhone, trimmedUsername]
      );
    }

    setLoading(false);
    onSuccess(trimmedUsername);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '30px',
        width: '90%',
        maxWidth: '400px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}>
        <h2 style={{ margin: '0 0 10px 0', textAlign: 'center' }}>
          {existingUsername ? 'Изменить никнейм' : 'Добро пожаловать!'}
        </h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
          {existingUsername ? 'Введите новый никнейм' : 'Придумайте себе уникальный никнейм'}
        </p>
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Никнейм"
            autoFocus
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              marginBottom: '15px'
            }}
          />
          
          {error && (
            <div style={{ color: 'red', marginBottom: '15px', fontSize: '14px' }}>
              ⚠️ {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading || !username.trim()}
            style={{
              width: '100%',
              padding: '12px',
              background: (loading || !username.trim()) ? '#ccc' : '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: (loading || !username.trim()) ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Проверка...' : (existingUsername ? 'Сохранить' : 'Продолжить')}
          </button>
        </form>
      </div>
    </div>
  );
}