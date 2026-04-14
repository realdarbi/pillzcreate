# 🎵 Pillz Studio — Платформа для записи в студию

[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![SQL.js](https://img.shields.io/badge/SQL.js-003B57?style=flat&logo=sqlite&logoColor=white)](https://sql.js.org/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=black)](https://firebase.google.com/)

Веб-приложение для записи в студию звукозаписи, видеостудию и студию монтажа. Клиенты могут бронировать время, работники — брать заявки, администраторы — смотреть аналитику.

## 🚀 Демо

[Ссылка на деплой (Vercel)](https://studio-app.vercel.app)

## 📋 Функционал

### 👤 Клиент
- Просмотр каталога студий и услуг
- Бронирование времени (онлайн/оффлайн)
- Оплата предоплаты (30%)
- Личный кабинет с историей заказов
- Отмена заявки

### 👨‍💼 Работник
- Панель управления заявками
- Взятие онлайн-заявок в работу
- Бронирование оффлайн-слотов
- Отметка выполнения заказа
- Просмотр заработка

### 👑 Администратор
- Дашборд с аналитикой
- Графики заказов по месяцам
- Управление работниками
- Настройка процента заработка

## 🛠 Технологии

| Технология | Назначение |
|------------|------------|
| **React 18** | UI библиотека |
| **Vite** | Сборка проекта |
| **SQL.js** | Локальная БД (SQLite в браузере) |
| **Firebase Auth** | Аутентификация по SMS |
| **React Router DOM** | Маршрутизация |
| **React DatePicker** | Календарь выбора времени |
| **Recharts** | Графики в админ-панели |

## 📦 Установка и запуск

```bash
# Клонировать репозиторий
git clone https://github.com/realdarbi/pillzcreate.git
cd pillzcreate

# Установить зависимости
npm install

# Запустить в режиме разработки
npm run dev

# Собрать для продакшена
npm run build

🔐 Тестовые аккаунты
Роль	Номер телефона	Код
Клиент	 +79135939921	123456 (тестовый)
Работник	+76767676767	123456
Администратор	+75252525252	123456

src/
├── components/     # Переиспользуемые компоненты
│   ├── Header.jsx
│   ├── Footer.jsx
│   ├── PhoneAuth.jsx
│   ├── DateTimePicker.jsx
│   └── UsernameModal.jsx
├── pages/          # Страницы приложения
│   ├── Catalog.jsx
│   ├── StudioPage.jsx
│   ├── ServicePage.jsx
│   ├── ProfilePage.jsx
│   ├── WorkerDashboard.jsx
│   └── AdminDashboard.jsx
├── lib/            # Утилиты
│   ├── database.js # Работа с SQL.js
│   └── firebase.js # Firebase Auth
└── styles/
    └── index.css   # Глобальные стили + темная тема
