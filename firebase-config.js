// Настройки Firebase для проекта kholst-1f465
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBCmWiGXM0DoryqSfLDYYW5Ou8rgTKUY3s",
  authDomain: "kholst-1f465.firebaseapp.com",
  databaseURL: "https://kholst-1f465-default-rtdb.firebaseio.com",
  projectId: "kholst-1f465",
  storageBucket: "kholst-1f465.firebasestorage.app",
  messagingSenderId: "804326345109",
  measurementId: "G-1FT0VMKQPK",   // для статистики: Firebase → Project settings → Integrations → Google Analytics, формат G-XXXXXXXXXX
  appId: "1:804326345109:web:89cbb90a38e2fae1c28e9c"
};

// Ключ для уведомлений: Firebase → Настройки проекта → Cloud Messaging → Web Push certificates → Generate key pair.
// Вставьте сюда «Key pair» (это публичный ключ, он не секретный). Пока пусто — блок уведомлений скрыт.
window.PUSH_VAPID_KEY = 'BOosaja1j7i455dy9BvThNUjdfDIS5ppt54zxxhg0jOu3wJT8KafxA08458hM5P8V-aYHiSB4qjXU49Ki5MJcIc';
// Адрес Cloudflare Worker для отправки уведомлений (этап 2). Пока пусто — уведомления друзьям не отправляются.
window.PUSH_URL = 'https://twosome-push.sergiykudrych2001.workers.dev/';
