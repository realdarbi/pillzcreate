import { useState, useEffect } from 'react';
import { auth, onAuthChange } from '../lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

export default function PhoneAuth({ onLoginSuccess }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthChange((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        onLoginSuccess?.(currentUser);
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, [onLoginSuccess]);

  const formatPhoneNumber = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length === 0) return '';
    if (numbers.length <= 1) return `+7(${numbers}`;
    if (numbers.length <= 4) return `+7(${numbers.slice(1)}`;
    if (numbers.length <= 7) return `+7(${numbers.slice(1, 4)})${numbers.slice(4)}`;
    if (numbers.length <= 9) return `+7(${numbers.slice(1, 4)})${numbers.slice(4, 7)}-${numbers.slice(7)}`;
    return `+7(${numbers.slice(1, 4)})${numbers.slice(4, 7)}-${numbers.slice(7, 9)}-${numbers.slice(9, 11)}`;
  };

  const handlePhoneChange = (e) => {
    setPhoneNumber(formatPhoneNumber(e.target.value));
  };

  // Настройка reCAPTCHA
  const setupRecaptcha = () => {
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
    }
    
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
      'callback': () => {
        console.log('reCAPTCHA решена');
      },
      'expired-callback': () => {
        console.log('reCAPTCHA истекла');
      }
    });
    
    return window.recaptchaVerifier;
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const rawNumber = phoneNumber.replace(/\D/g, '');
      if (rawNumber.length < 11) {
        throw new Error('invalid-phone-number');
      }
      const fullNumber = `+${rawNumber}`;
      
      console.log('Отправка на номер:', fullNumber);
      
      const recaptchaVerifier = setupRecaptcha();
      await recaptchaVerifier.render();
      
      const result = await signInWithPhoneNumber(auth, fullNumber, recaptchaVerifier);
      setConfirmationResult(result);
      setStep('otp');
    } catch (err) {
      console.error('Firebase error:', err);
      if (err.code === 'auth/invalid-phone-number' || err.message === 'invalid-phone-number') {
        setError('Неверный формат номера телефона. Введите 10 цифр после +7');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Слишком много попыток. Попробуйте позже');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Ошибка сети. Проверьте подключение к интернету');
      } else if (err.code === 'auth/quota-exceeded') {
        setError('Лимит SMS на сегодня исчерпан. Попробуйте завтра');
      } else {
        setError('Ошибка: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await confirmationResult.confirm(otp);
      setStep('phone');
      setPhoneNumber('');
      setOtp('');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-verification-code') {
        setError('Неверный код подтверждения');
      } else {
        setError('Ошибка проверки кода');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const { signOut } = await import('firebase/auth');
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Ошибка выхода:', err);
    }
  };

  if (user) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ 
          background: '#e8f5e9', 
          padding: '15px', 
          borderRadius: '10px',
          marginBottom: '20px'
        }}>
          <p style={{ margin: 0, color: '#2e7d32' }}>
            ✅ Вы вошли как: {user.phoneNumber}
          </p>
        </div>
        <button 
          onClick={handleLogout}
          style={{
            background: '#dc3545',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Выйти
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px' }}>
      <div id="recaptcha-container"></div>

      {step === 'phone' ? (
        <form onSubmit={handleSendOTP}>
          <h3>Вход по номеру телефона</h3>
          
          <div className="form-group">
            <label>Номер телефона</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder="+7(XXX)XXX-XX-XX"
              required
              disabled={loading}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
            />
          </div>

          {error && (
            <div style={{ color: 'red', marginBottom: '10px', fontSize: '14px' }}>
              ⚠️ {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || phoneNumber.replace(/\D/g, '').length < 11}
            style={{
              background: (loading || phoneNumber.replace(/\D/g, '').length < 11) ? '#ccc' : '#1976d2',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              cursor: (loading || phoneNumber.replace(/\D/g, '').length < 11) ? 'not-allowed' : 'pointer',
              width: '100%'
            }}
          >
            {loading ? 'Отправка...' : 'Получить код'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOTP}>
          <h3>Введите код из SMS</h3>
          <p style={{ color: '#666', marginBottom: '15px' }}>
            Код отправлен на номер {phoneNumber}
          </p>
          
          <div className="form-group">
            <label>Код подтверждения</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-значный код"
              maxLength="6"
              required
              disabled={loading}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
            />
          </div>

          {error && (
            <div style={{ color: 'red', marginBottom: '10px', fontSize: '14px' }}>
              ⚠️ {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || otp.length !== 6}
            style={{
              background: (loading || otp.length !== 6) ? '#ccc' : '#1976d2',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              cursor: (loading || otp.length !== 6) ? 'not-allowed' : 'pointer',
              width: '100%'
            }}
          >
            {loading ? 'Проверка...' : 'Подтвердить'}
          </button>

          <button
            type="button"
            onClick={() => setStep('phone')}
            style={{
              background: 'none',
              color: '#1976d2',
              padding: '10px',
              marginTop: '10px',
              width: '100%',
              cursor: 'pointer',
              border: 'none'
            }}
          >
            ← Изменить номер
          </button>
        </form>
      )}
    </div>
  );
}