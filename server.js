const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { contactMapping, dealMapping, leadMapping, mapFields } = require('./mapping');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Логирование всех входящих запросов (до обработки тела)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Middleware для получения сырого тела запроса ТОЛЬКО для /webhook (нужно для проверки подписи)
// Важно: это должно быть ДО express.json(), чтобы Express не пытался парсить JSON дважды
app.use('/webhook', express.raw({ 
  type: 'application/json',
  limit: '10mb' // Лимит размера тела запроса
}));

// Middleware для парсинга JSON в других роутах (НЕ для /webhook)
// Express автоматически пропустит /webhook, т.к. тело уже обработано express.raw()
app.use(express.json({ limit: '10mb' }));

/**
 * Проверка подписи вебхука
 * @param {string} payload - Сырое тело запроса
 * @param {string} signature - Подпись из заголовка X-Webhook-Signature
 * @param {string} secret - Секретный ключ вебхука
 * @returns {boolean} - true если подпись валидна
 */
function verifyWebhookSignature(payload, signature, secret) {
  if (!signature || !secret) {
    return false;
  }

  const computed = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Используем timingSafeEqual для защиты от timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch (error) {
    return false;
  }
}

/**
 * Поиск контакта в Bitrix по телефону
 * @param {string} bitrixWebhookUrl - URL вебхука Bitrix
 * @param {string} phone - Номер телефона
 * @returns {Promise<string|null>} - ID контакта или null
 */
async function findContactByPhone(bitrixWebhookUrl, phone) {
  try {
    const response = await axios.post(
      `${bitrixWebhookUrl}/crm.contact.list`,
      {
        filter: { 'PHONE': phone },
        select: ['ID', 'NAME']
      }
    );

    if (response.data.result && response.data.result.length > 0) {
      return response.data.result[0].ID;
    }
    return null;
  } catch (error) {
    console.warn('Ошибка при поиске контакта:', error.message);
    return null;
  }
}

/**
 * Отправка данных в Bitrix24
 * @param {object} webhookData - Данные вебхука
 * @returns {Promise<object>} - Результат отправки
 */
async function sendToBitrix(webhookData) {
  const bitrixWebhookUrl = process.env.BITRIX_WEBHOOK_URL;
  
  if (!bitrixWebhookUrl) {
    throw new Error('BITRIX_WEBHOOK_URL не настроен');
  }

  const results = [];
  let contactId = null;

  try {
    // 1. Создание/обновление контакта (если есть телефон)
    if (webhookData.contact?.phone) {
      const phone = webhookData.contact.phone;
      
      // Ищем существующий контакт
      contactId = await findContactByPhone(bitrixWebhookUrl, phone);
      
      // Преобразуем данные по маппингу (с преобразованием алиасов в реальные ID)
      const contactFields = mapFields(webhookData, contactMapping, 'contact');
      
      if (contactId) {
        // Обновляем существующий контакт
        try {
          const updateResponse = await axios.post(
            `${bitrixWebhookUrl}/crm.contact.update`,
            {
              id: contactId,
              fields: contactFields
            },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 10000
            }
          );
          console.log('✅ Контакт обновлен:', contactId);
          results.push({ type: 'contact', action: 'updated', id: contactId });
        } catch (error) {
          console.error('Ошибка обновления контакта:', error.message);
          // Продолжаем работу даже если обновление не удалось
        }
      } else {
        // Создаем новый контакт
        try {
          const createResponse = await axios.post(
            `${bitrixWebhookUrl}/crm.contact.add`,
            { fields: contactFields },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 10000
            }
          );
          contactId = createResponse.data.result;
          console.log('✅ Контакт создан:', contactId);
          results.push({ type: 'contact', action: 'created', id: contactId });
        } catch (error) {
          console.error('Ошибка создания контакта:', error.message);
          if (error.response) {
            console.error('Ответ Bitrix:', JSON.stringify(error.response.data, null, 2));
          }
          // Продолжаем работу даже если создание не удалось
        }
      }
    }

    // 2. Создание сделки или лида на основе договоренности
    const isCommit = webhookData.call?.agreements?.isCommit;
    const agreements = webhookData.call?.agreements?.agreements?.trim();
    const clientFacts = webhookData.call?.agreements?.client_facts?.trim();
    const hasAgreements = agreements || clientFacts;

    if (isCommit && hasAgreements) {
      // Создаем сделку, если есть договоренность
      const dealFields = mapFields(webhookData, dealMapping, 'deal');
      
      // Добавляем связь с контактом
      if (contactId) {
        dealFields['CONTACT_ID'] = contactId;
      }

      try {
        const dealResponse = await axios.post(
          `${bitrixWebhookUrl}/crm.deal.add`,
          { fields: dealFields },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
          }
        );
        
        const dealId = dealResponse.data.result;
        console.log('✅ Сделка создана:', dealId);
        results.push({ type: 'deal', action: 'created', id: dealId });

        // Добавляем комментарий в timeline сделки с деталями звонка
        try {
          const durationSeconds = Math.round((webhookData.call?.duration || 0) / 1000);
          const durationMinutes = Math.floor(durationSeconds / 60);
          const durationSecs = durationSeconds % 60;
          const durationFormatted = durationMinutes > 0 
            ? `${durationMinutes} мин ${durationSecs} сек` 
            : `${durationSecs} сек`;
          
          const commentParts = [
            '📞 Звонок завершен',
            `Длительность: ${durationFormatted}`,
            `Статус: ${webhookData.call?.status || 'неизвестно'}`,
            webhookData.call?.type && `Тип: ${webhookData.call.type === 'outgoing' ? 'Исходящий' : 'Входящий'}`,
            webhookData.callList?.name && `Колл-лист: ${webhookData.callList.name}`,
            webhookData.call?.agreements?.agreements?.trim() && `\nДоговоренность:\n${webhookData.call.agreements.agreements.trim()}`,
            webhookData.call?.agreements?.client_facts?.trim() && `\nФакты о клиенте:\n${webhookData.call.agreements.client_facts.trim()}`,
            webhookData.call?.agreements?.smsText?.trim() && `\nSMS текст:\n${webhookData.call.agreements.smsText.trim()}`,
          ].filter(Boolean);
          
          const commentText = commentParts.join('\n');

          await axios.post(
            `${bitrixWebhookUrl}/crm.timeline.comment.add`,
            {
              fields: {
                ENTITY_ID: dealId,
                ENTITY_TYPE: 'deal',
                COMMENT: commentText
              }
            },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 10000
            }
          );
        } catch (commentError) {
          console.warn('Не удалось добавить комментарий к сделке:', commentError.message);
        }
      } catch (error) {
        console.error('Ошибка создания сделки:', error.message);
        if (error.response) {
          console.error('Ответ Bitrix:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
      }
    } else if (hasAgreements) {
      // Создаем лид, если нет договоренности, но есть информация
      const leadFields = mapFields(webhookData, leadMapping, 'lead');
      
      // Добавляем связь с контактом
      if (contactId) {
        leadFields['CONTACT_ID'] = contactId;
      }

      try {
        const leadResponse = await axios.post(
          `${bitrixWebhookUrl}/crm.lead.add`,
          { fields: leadFields },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
          }
        );
        
        const leadId = leadResponse.data.result;
        console.log('✅ Лид создан:', leadId);
        results.push({ type: 'lead', action: 'created', id: leadId });
      } catch (error) {
        console.error('Ошибка создания лида:', error.message);
        if (error.response) {
          console.error('Ответ Bitrix:', JSON.stringify(error.response.data, null, 2));
        }
        // Не бросаем ошибку для лида, т.к. это менее критично
      }
    }

    return { success: true, results };
  } catch (error) {
    console.error('Ошибка при отправке в Bitrix:', error.message);
    if (error.response) {
      console.error('Ответ Bitrix:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Обработчик вебхука от Sasha AI
 */
app.post('/webhook', async (req, res) => {
  try {
    // Проверяем Content-Type
    const contentType = req.headers['content-type'];
    if (contentType && !contentType.includes('application/json')) {
      console.warn(`Предупреждение: неожиданный Content-Type: ${contentType}`);
    }

    // Проверяем, что тело запроса - это Buffer (сырые данные)
    if (!Buffer.isBuffer(req.body)) {
      console.error('Ошибка: тело запроса не является Buffer. Проверьте настройку middleware.');
      console.error('Тип req.body:', typeof req.body);
      return res.status(500).json({ error: 'Ошибка конфигурации сервера' });
    }

    // Получаем сырое тело запроса для проверки подписи
    const payload = req.body.toString('utf8');
    const signature = req.headers['x-webhook-signature'];
    const webhookId = req.headers['x-webhook-id'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const callListId = req.headers['x-call-list-id'];

    // Логируем информацию о запросе (первые 200 символов для отладки)
    console.log('📥 Получен вебхук:', {
      webhookId,
      timestamp,
      callListId,
      hasSignature: !!signature,
      payloadLength: payload.length,
      contentType: contentType || 'не указан',
      payloadPreview: payload.substring(0, 200) + (payload.length > 200 ? '...' : ''),
    });

    // Проверка подписи (если включена)
    if (process.env.WEBHOOK_SECRET) {
      const isValid = verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET);
      
      if (!isValid) {
        console.error('Недействительная подпись вебхука');
        return res.status(401).json({ error: 'Недействительная подпись' });
      }
      
      console.log('Подпись вебхука проверена успешно');
    } else {
      console.warn('ВНИМАНИЕ: Проверка подписи отключена (WEBHOOK_SECRET не установлен)');
    }

    // Проверяем, что payload не пустой
    if (!payload || payload.trim().length === 0) {
      console.error('Ошибка: тело запроса пустое');
      return res.status(400).json({ error: 'Тело запроса пустое' });
    }

    // Парсинг JSON из строки
    let webhookData;
    try {
      webhookData = JSON.parse(payload);
    } catch (parseError) {
      console.error('Ошибка парсинга JSON:', parseError.message);
      console.error('Первые 500 символов payload:', payload.substring(0, 500));
      return res.status(400).json({ 
        error: 'Неверный формат JSON',
        message: parseError.message 
      });
    }

    // Проверяем структуру данных
    if (!webhookData.type) {
      console.warn('Предупреждение: поле "type" отсутствует в данных');
    }

    // Логирование полученных данных
    console.log('✅ Данные успешно распарсены:', {
      type: webhookData.type,
      id: webhookData.id,
      hasCall: !!webhookData.call,
      hasContact: !!webhookData.contact,
      hasCallList: !!webhookData.callList,
    });

    // Отправка в Bitrix в фоновом режиме (не блокируем ответ)
    sendToBitrix(webhookData)
      .then(() => {
        console.log('Данные успешно отправлены в Bitrix для события:', webhookData.id);
      })
      .catch((error) => {
        console.error('Ошибка при отправке в Bitrix для события:', webhookData.id, error.message);
        // Здесь можно добавить логику повторных попыток или отправки в очередь
      });

    // Отвечаем сразу, чтобы не превысить таймаут в 10 секунд
    res.status(200).json({ 
      success: true, 
      message: 'Webhook получен и обрабатывается',
      eventId: webhookData.id 
    });

  } catch (error) {
    console.error('Ошибка обработки вебхука:', error);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'sasha-webhook-to-bitrix'
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Необработанная ошибка:', err);
  res.status(500).json({ 
    error: 'Внутренняя ошибка сервера',
    message: err.message 
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  
  if (!process.env.WEBHOOK_SECRET) {
    console.warn('⚠️  ВНИМАНИЕ: WEBHOOK_SECRET не установлен. Проверка подписи отключена!');
  }
  
  if (!process.env.BITRIX_WEBHOOK_URL) {
    console.warn('⚠️  ВНИМАНИЕ: BITRIX_WEBHOOK_URL не установлен. Отправка в Bitrix не будет работать!');
  }
});
