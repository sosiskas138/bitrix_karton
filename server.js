const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { contactMapping, dealMapping, leadMapping, mapFields } = require('./mapping');
require('dotenv').config();

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
 * Проверка подписи вебхука
 * @param {string} payload - Сырое тело запроса
 * @param {string} signature - Подпись из заголовка X-Webhook-Signature
 * @param {string} secret - Секретный ключ вебхука
 * @returns {boolean} - true если подпись валидна
 */
function verifyWebhookSignature(payload, signature, secret) {
  const computed = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(computed, 'hex'),
    Buffer.from(signature, 'hex')
  );
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
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body; // Сырое тело запроса в виде строки
  const secret = 'ваш_секретный_ключ_вебхука';
  
  if (!verifyWebhookSignature(payload, signature, secret)) {
    return res.status(401).send('Недействительная подпись');
  }
  
  // Парсинг JSON из строки
  const webhookData = JSON.parse(payload);
  
  try {
    sendToBitrix(webhookData)
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
