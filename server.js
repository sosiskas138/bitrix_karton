const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
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

/**
 * Функция для заполнения карточки лида в Bitrix
 * @param {Object} data - Данные в формате вебхука от Sasha AI
 * @returns {Promise<Object>} - Результат создания лида в Bitrix
 */
async function createLeadInBitrix(data) {
  const bitrixWebhookUrl = process.env.BITRIX_WEBHOOK_URL;
  
  if (!bitrixWebhookUrl) {
    throw new Error('BITRIX_WEBHOOK_URL не установлен в переменных окружения');
  }

  // Извлечение данных из структуры
  const contact = data.contact || {};
  const call = data.call || {};
  const agreements = call.agreements || {};
  const callList = data.callList || {};
  
  // Формирование имени и фамилии
  const clientName = agreements.client_name || '';
  const nameParts = clientName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  // Формирование телефона
  const phone = contact.phone || '';
  const phoneFormatted = phone ? phone.replace(/\D/g, '') : '';
  
  // Формирование названия лида
  const leadTitle = agreements.agreements 
    ? `Лид: ${agreements.agreements.substring(0, 100)}`
    : `Лид от ${callList.name || 'неизвестного источника'}`;
  
  // Формирование комментариев
  const comments = [];
  if (agreements.agreements) {
    comments.push(`Договоренности: ${agreements.agreements}`);
  }
  if (agreements.client_facts) {
    comments.push(`Факты о клиенте: ${agreements.client_facts}`);
  }
  if (agreements.smsText) {
    comments.push(`SMS текст: ${agreements.smsText}`);
  }
  if (call.duration) {
    const durationMinutes = Math.floor(call.duration / 60000);
    const durationSeconds = Math.floor((call.duration % 60000) / 1000);
    comments.push(`Длительность звонка: ${durationMinutes} мин ${durationSeconds} сек`);
  }
  if (call.startedAt) {
    comments.push(`Звонок начат: ${new Date(call.startedAt).toLocaleString('ru-RU')}`);
  }
  if (call.endedAt) {
    comments.push(`Звонок завершен: ${new Date(call.endedAt).toLocaleString('ru-RU')}`);
  }
  if (agreements.agreements_time) {
    comments.push(`Время договоренности: ${agreements.agreements_time}`);
  }
  if (agreements.lead_destination) {
    comments.push(`Направление лида: ${agreements.lead_destination}`);
  }
  if (agreements.status) {
    comments.push(`Статус: ${agreements.status}`);
  }
  
  const commentsText = comments.join('\n\n');
  
  // Формирование данных для Bitrix
  const leadData = {
    fields: {
      TITLE: leadTitle,
      NAME: firstName,
      LAST_NAME: lastName,
      COMMENTS: commentsText,
      SOURCE_ID: 'WEB', // Источник - веб
      STATUS_ID: 'NEW', // Статус - новый
    }
  };
  
  // Добавление телефона, если есть
  if (phoneFormatted) {
    leadData.fields.PHONE = [
      {
        VALUE: phoneFormatted,
        VALUE_TYPE: 'MOBILE'
      }
    ];
  }
  
  // Добавление email, если есть в дополнительных полях
  if (contact.additionalFields && contact.additionalFields.email) {
    leadData.fields.EMAIL = [
      {
        VALUE: contact.additionalFields.email,
        VALUE_TYPE: 'WORK'
      }
    ];
  }
  
  // Добавление информации о регионе из dadataPhoneInfo
  if (contact.dadataPhoneInfo) {
    if (contact.dadataPhoneInfo.region) {
      leadData.fields.COMMENTS += `\n\nРегион: ${contact.dadataPhoneInfo.region}`;
    }
    if (contact.dadataPhoneInfo.provider) {
      leadData.fields.COMMENTS += `\nОператор: ${contact.dadataPhoneInfo.provider}`;
    }
    if (contact.dadataPhoneInfo.timezone) {
      leadData.fields.COMMENTS += `\nЧасовой пояс: ${contact.dadataPhoneInfo.timezone}`;
    }
  }
  
  // Добавление информации о колл-листе
  if (callList.name) {
    leadData.fields.COMMENTS += `\n\nКолл-лист: ${callList.name}`;
  }
  
  // Добавление тегов контакта
  if (contact.tags && contact.tags.length > 0) {
    leadData.fields.COMMENTS += `\nТеги: ${contact.tags.join(', ')}`;
  }
  
  // Добавление дополнительных полей контакта
  if (contact.additionalFields) {
    const additionalInfo = [];
    if (contact.additionalFields.website) {
      additionalInfo.push(`Сайт: ${contact.additionalFields.website}`);
    }
    if (contact.additionalFields.page) {
      additionalInfo.push(`Страница: ${contact.additionalFields.page}`);
    }
    if (contact.additionalFields.ip) {
      additionalInfo.push(`IP: ${contact.additionalFields.ip}`);
    }
    if (additionalInfo.length > 0) {
      leadData.fields.COMMENTS += `\n\nДополнительная информация:\n${additionalInfo.join('\n')}`;
    }
  }
  
  // Добавление информации о типе звонка
  if (call.type) {
    leadData.fields.COMMENTS += `\n\nТип звонка: ${call.type === 'outgoing' ? 'Исходящий' : 'Входящий'}`;
  }
  
  // Добавление информации о статусе звонка
  if (call.status) {
    leadData.fields.COMMENTS += `\nСтатус звонка: ${call.status}`;
  }
  
  // Добавление информации о причине завершения звонка
  if (call.hangupReason) {
    leadData.fields.COMMENTS += `\nПричина завершения: ${call.hangupReason}`;
  }
  
  // Отправка запроса в Bitrix
  try {
    const response = await axios.post(
      `${bitrixWebhookUrl}crm.lead.add`,
      leadData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    return {
      success: true,
      leadId: response.data.result,
      data: response.data
    };
  } catch (error) {
    console.error('Ошибка при создании лида в Bitrix:', error.response?.data || error.message);
    throw new Error(`Ошибка при создании лида в Bitrix: ${error.response?.data?.error_description || error.message}`);
  }
}

/**
 * GET эндпоинт для создания лида в Bitrix
 * Использует жестко заданный объект данных
 * 
 * Пример использования:
 * GET /create-lead
 */
app.get('/create-lead', async (req, res) => {
  try {
    // Жестко заданный объект данных
    const data = {
      "id": "0d8111f0-0af6-4300-86e8-492bc89a5b65",
      "type": "call_result",
      "organizationId": "120d1ba4-7bb1-4af5-bf5a-218f69261f35",
      "timestamp": "2025-04-16T15:47:37.705Z",
      "callList": {
        "id": "a41cfb86-8b12-425a-96aa-9dd476f240f6",
        "organization": {
          "id": "120d1ba4-7bb1-4af5-bf5a-218f69261f35",
          "name": "DMP",
          "createdBy": "b34b8c7e-2c7b-4b63-bd0f-4ed568b122ae",
          "createdAt": "2025-03-09T11:05:04.773Z",
          "updatedAt": "2025-03-09T11:05:04.852Z"
        },
        "createdAt": "2025-03-09T10:57:26.812Z",
        "updatedAt": "2025-04-16T11:05:51.329Z",
        "name": "DMP",
        "description": null,
        "status": "active",
        "createdBy": "b34b8c7e-2c7b-4b63-bd0f-4ed568b122ae"
      },
      "call": {
        "id": "35f14673-671b-4eef-92ad-5a073fc7cad7",
        "startedAt": "2025-05-12T13:57:22.300Z",
        "connectedAt": "2025-05-12T13:57:33.179Z", 
        "endedAt": "2025-05-12T14:03:16.648Z",
        "duration": 343469,
        "status": "completed",
        "type": "outgoing",
        "hangupReason": "hangup",
        "callDetails": {
          "channelId": "f1e677b5-aaac-44aa-be96-0701a873a5fd",
          "chatHistory": [
            {"role": "user", "content": "..."},
            {"role": "assistant", "content": "Алло... "}
          ]
        },
        "agreements": {
          "isCommit": true,
          "agreements": "Договорились скинуть ссылку на пробные уроки в телеграм",
          "client_name": "",
          "client_facts": "Клиент в 10 классе, интересуется химией, планирует поступать на химфак. Сейчас занимается с репетитором по математике и русскому, нарешивает задания. Ищет онлайн-школу на лето.",
          "agreements_time": "2025-05-12 17:03:00",
          "agreements_time_local": "2025-05-12 17:03:00",
          "status": "transfer",
          "lead_destination": "sales",
          "smsText": "Привет! Ясмина из \"новой школы\". Пришлю Вам ссылку на пробные уроки по химии, как договорились. Учту, что Вы в 10 классе. Хорошего дня!"
        },
        "callSession": {
          "id": "daeb15e0-b186-4afc-b8b9-1c081bf49a10",
          "createdAt": "2025-05-12T13:57:22.300Z",
          "updatedAt": "2025-05-12T14:03:20.374Z",
          "contact": "[Object]",
          "attempts": 1,
          "status": "completed",
          "calls": [],
          "priority": 0,
          "attemptsLeft": 2
        }
      },
      "contact": {
        "id": "c68f7928-a383-41da-be5d-e60c8c44a5d9",
        "phone": "79996662211",
        "blacklist": false,
        "dadataPhoneInfo": {
          "type": "Мобильный",
          "phone": "+7 999 666-22-11",
          "region": "Рязанская область",
          "provider": "ПАО \"МТС\"",
          "timezone": "UTC+3"
        },
        "tags": ["dmp.one"],
        "additionalFields": {
          "ip": "2a00:1fa0:c220:176b:e5a7:fb0c:f53c:c4e7",
          "page": "https://dmp.one/",
          "phone": "79996662211",
          "website": "dmp.one"
        }
      }
    };
    
    // Создание лида в Bitrix
    const result = await createLeadInBitrix(data);
    
    res.json({
      success: true,
      message: 'Лид успешно создан в Bitrix',
      leadId: result.leadId,
      data: result.data
    });
  } catch (error) {
    console.error('Ошибка при обработке запроса:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Внутренняя ошибка сервера'
    });
  }
});

/**
 * POST эндпоинт для создания лида в Bitrix
 * Принимает JSON данные в теле запроса
 * 
 * Пример использования:
 * POST /create-lead
 * Content-Type: application/json
 * Body: {"id":"...","type":"call_result",...}
 */
app.post('/create-lead', async (req, res) => {
  try {
    const data = req.body;
    
    // Валидация наличия данных
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Данные не предоставлены. Отправьте JSON в теле запроса'
      });
    }
    
    // Валидация обязательных полей
    if (!data.contact || !data.call) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствуют обязательные поля: contact или call'
      });
    }
    
    // Создание лида в Bitrix
    const result = await createLeadInBitrix(data);
    
    res.json({
      success: true,
      message: 'Лид успешно создан в Bitrix',
      leadId: result.leadId,
      data: result.data
    });
  } catch (error) {
    console.error('Ошибка при обработке запроса:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Внутренняя ошибка сервера'
    });
  }
});

/**
 * Health check эндпоинт
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
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
