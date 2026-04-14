import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPhoneNumber, 
  RecaptchaVerifier,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';

// Замени на свои данные из Firebase Console!
const firebaseConfig = {
  apiKey: "AIzaSyCDgyqIzwIbtU6-oUGO-LprifKa-6XD7CI",
  authDomain: "studio-app-93939.firebaseapp.com",
  projectId: "studio-app-93939",
  storageBucket: "studio-app-93939.firebasestorage.app",
  messagingSenderId: "988317612823",
  appId: "1:988317612823:web:aa6d2982a2c95f2b58d552"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Настройка reCAPTCHA (невидимая)
export const setupRecaptcha = (elementId) => {
  return new RecaptchaVerifier(auth, elementId, {
    size: 'invisible',
    callback: () => console.log('reCAPTCHA решена')
  });
};

// Отправка SMS с кодом
export const sendOTP = async (phoneNumber, recaptchaVerifier) => {
  try {
    const confirmationResult = await signInWithPhoneNumber(
      auth, 
      phoneNumber, 
      recaptchaVerifier
    );
    return confirmationResult;
  } catch (error) {
    console.error('Ошибка отправки SMS:', error);
    throw error;
  }
};

// Выход из аккаунта
export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Ошибка выхода:', error);
  }
};

// Слушатель состояния авторизации
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};