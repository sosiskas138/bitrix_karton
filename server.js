const express = require('express');
const crypto = require('crypto');
const axios = require('axios');


const app = express();
const PORT = process.env.PORT || 3333;

// Middleware для получения сырого тела запроса ТОЛЬКО для /webhook (нужно для проверки подписи)
// Важно: это должно быть ДО express.json(), чтобы Express не пытался парсить JSON дважды
app.use('/webhook', express.raw({ 
  type: '*/*',  // Принимать любой Content-Type для совместимости
  limit: '10mb' // Лимит размера тела запроса
}));

// Middleware для парсинга JSON в других роутах (НЕ для /webhook)
// Express автоматически пропустит /webhook, т.к. тело уже обработано express.raw()
app.use(express.json({ limit: '10mb' }));

/**
 * Обработчик вебхука от Sasha AI
 */
app.post('/webhook', async (req, res) => {
  // const signature = req.headers['x-webhook-signature'];
  const payload = req.body; // Сырое тело запроса в виде строки
  // const secret = 'ваш_секретный_ключ_вебхука';
  
  // if (!verifyWebhookSignature(payload, signature, secret)) {
  //   return res.status(401).send('Недействительная подпись');
  // }
  
  // Парсинг JSON из строки
  const webhookData = JSON.parse(payload);
  
  try {
    console.log(webhookData)
  } catch (error) {
    console.log("error data: ", error)
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  
  if (!process.env.WEBHOOK_SECRET) {
    console.warn('⚠️  ВНИМАНИЕ: WEBHOOK_SECRET не установлен. Проверка подписи отключена!');
  }
  
  if (!process.env.BITRIX_WEBHOOK_URL) {
    console.warn('⚠️  ВНИМАНИЕ: BITRIX_WEBHOOK_URL не установлен. Отправка в Bitrix не будет работать!');
  }
});
