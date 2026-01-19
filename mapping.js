/**
 * МАППИНГ ДАННЫХ: Вебхук → Bitrix
 * 
 * Этот файл определяет, какие данные из вебхука попадают в какие поля Bitrix.
 * Чтобы изменить соответствие, просто поменяйте значение в поле "source" или "transform".
 * 
 * Структура:
 * - source: путь к данным в вебхуке (например, 'call.agreements.client_name')
 * - transform: функция преобразования (опционально)
 * - default: значение по умолчанию, если данных нет (опционально)
 */

/**
 * Маппинг для ЛИДОВ в Bitrix
 */
const leadMapping = {
  // ============================================
  // БАЗОВЫЕ ПОЛЯ ЛИДА
  // ============================================
  
  // Название лида (Всегда одно и то же – Лид от AI менеджера)
  TITLE: {
    source: 'static',
    value: 'Лид от AI менеджера'
  },
  
  // Имя клиента
  NAME: {
    source: 'call.agreements.client_name',  // Откуда берем: имя клиента из договоренностей
    transform: (value) => {
      // Берем первое слово как имя
      return value ? value.trim().split(/\s+/)[0] : '';
    }
  },
  
  // Фамилия клиента
  LAST_NAME: {
    source: 'call.agreements.client_name',  // Откуда берем: имя клиента из договоренностей
    transform: (value) => {
      // Берем все слова кроме первого как фамилию
      const parts = value ? value.trim().split(/\s+/) : [];
      return parts.slice(1).join(' ') || '';
    }
  },
  
  // Комментарии к лиду (собираются из разных источников)
  COMMENTS: {
    source: 'multiple',  // Специальное значение - собираем из нескольких полей
    transform: (value, data) => {
      const comments = [];
      const agreements = data.call?.agreements || {};
      const call = data.call || {};
      
      // Договоренности
      if (agreements.agreements) {
        comments.push(`Договоренности: ${agreements.agreements}`);
      }
      
      // Факты о клиенте
      if (agreements.client_facts) {
        comments.push(`Факты о клиенте: ${agreements.client_facts}`);
      }
      
      // SMS текст
      if (agreements.smsText) {
        comments.push(`SMS текст: ${agreements.smsText}`);
      }
      
      // Длительность звонка
      if (call.duration) {
        const durationMinutes = Math.floor(call.duration / 60000);
        const durationSeconds = Math.floor((call.duration % 60000) / 1000);
        comments.push(`Длительность звонка: ${durationMinutes} мин ${durationSeconds} сек`);
      }
      
      // Время начала звонка
      if (call.startedAt) {
        comments.push(`Звонок начат: ${new Date(call.startedAt).toLocaleString('ru-RU')}`);
      }
      
      // Время окончания звонка
      if (call.endedAt) {
        comments.push(`Звонок завершен: ${new Date(call.endedAt).toLocaleString('ru-RU')}`);
      }
      
      // Время договоренности
      if (agreements.agreements_time) {
        comments.push(`Время договоренности: ${agreements.agreements_time}`);
      }
      
      // Направление лида
      if (agreements.lead_destination) {
        comments.push(`Направление лида: ${agreements.lead_destination}`);
      }
      
      // Статус
      if (agreements.status) {
        comments.push(`Статус: ${agreements.status}`);
      }
      
      // Регион (из dadataPhoneInfo)
      if (data.contact?.dadataPhoneInfo?.region) {
        comments.push(`Регион: ${data.contact.dadataPhoneInfo.region}`);
      }
      
      // Оператор (из dadataPhoneInfo)
      if (data.contact?.dadataPhoneInfo?.provider) {
        comments.push(`Оператор: ${data.contact.dadataPhoneInfo.provider}`);
      }
      
      // Часовой пояс (из dadataPhoneInfo)
      if (data.contact?.dadataPhoneInfo?.timezone) {
        comments.push(`Часовой пояс: ${data.contact.dadataPhoneInfo.timezone}`);
      }
      
      // Колл-лист
      if (data.callList?.name) {
        comments.push(`Колл-лист: ${data.callList.name}`);
      }
      
      // Теги контакта
      if (data.contact?.tags && data.contact.tags.length > 0) {
        comments.push(`Теги: ${data.contact.tags.join(', ')}`);
      }
      
      // Дополнительная информация
      const additionalInfo = [];
      if (data.contact?.additionalFields?.website) {
        additionalInfo.push(`Сайт: ${data.contact.additionalFields.website}`);
      }
      if (data.contact?.additionalFields?.page) {
        additionalInfo.push(`Страница: ${data.contact.additionalFields.page}`);
      }
      if (data.contact?.additionalFields?.ip) {
        additionalInfo.push(`IP: ${data.contact.additionalFields.ip}`);
      }
      if (additionalInfo.length > 0) {
        comments.push(`\nДополнительная информация:\n${additionalInfo.join('\n')}`);
      }
      
      // Тип звонка
      if (call.type) {
        comments.push(`Тип звонка: ${call.type === 'outgoing' ? 'Исходящий' : 'Входящий'}`);
      }
      
      // Статус звонка
      if (call.status) {
        comments.push(`Статус звонка: ${call.status}`);
      }
      
      // Причина завершения
      if (call.hangupReason) {
        comments.push(`Причина завершения: ${call.hangupReason}`);
      }
      
      return comments.join('\n\n');
    }
  },
  
  // Источник лида
  SOURCE_ID: {
    source: 'static',  // Статическое значение
    value: 'WEB'  // Всегда 'WEB' для веб-источника
  },
  
  // Статус лида
  STATUS_ID: {
    source: 'static',
    value: 'NEW'  // Всегда 'NEW' для новых лидов
  },
  
  // ============================================
  // КОНТАКТНАЯ ИНФОРМАЦИЯ
  // ============================================
  
  // Телефон (тип телефона – всегда WORK)
  PHONE: {
    source: 'contact.phone',  // Откуда берем: телефон контакта
    transform: (value) => {
      // Форматируем телефон (убираем все кроме цифр)
      const phoneFormatted = value ? value.replace(/\D/g, '') : '';
      if (!phoneFormatted) return null;
      
      // Bitrix требует массив объектов для телефона (тип всегда WORK)
      return [{
        VALUE: phoneFormatted,
        VALUE_TYPE: 'WORK'
      }];
    }
  },
  
  // Email (специальный формат для Bitrix)
  EMAIL: {
    source: 'contact.additionalFields.email',  // Откуда берем: email из дополнительных полей
    transform: (value) => {
      if (!value) return null;
      
      // Bitrix требует массив объектов для email
      return [{
        VALUE: value,
        VALUE_TYPE: 'WORK'
      }];
    }
  },
  
  // ============================================
  // ПОЛЬЗОВАТЕЛЬСКИЕ ПОЛЯ
  // ============================================
  
  // Длительность звонка
  UF_CRM_1768733865788: {
    source: 'call.duration',  // Откуда берем: длительность звонка в миллисекундах
    transform: (value) => {
      if (!value) return null;
      // Преобразуем миллисекунды в минуты и секунды (формат: "5 мин 30 сек")
      const minutes = Math.floor(value / 60000);
      const seconds = Math.floor((value % 60000) / 1000);
      return `${minutes} мин ${seconds} сек`;
    }
  },
  
  // Время начала звонка
  UF_CRM_1768733894394: {
    source: 'call.startedAt',  // Откуда берем: время начала звонка
    transform: (value) => {
      if (!value) return null;
      // Форматируем дату в читаемый формат
      return new Date(value).toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  },
  
  // Запись звонка (ссылка)
  UF_CRM_1768733965686: {
    source: 'call.recorUrl',  // Откуда берем: ссылка на запись звонка
    transform: (value) => {
      return value || null;
    }
  },
  
  // Запись звонка (файл)
  UF_CRM_1768733980497: {
    source: 'call.recordingFile',  // Откуда берем: файл записи звонка
    transform: (value) => {
      // Если это URL файла, можно вернуть его, или если это base64, то обработать соответственно
      return value || null;
    }
  },
  
  // Договоренности
  UF_CRM_1768734008070: {
    source: 'call.agreements.agreements',  // Откуда берем: договоренности из звонка
    transform: (value) => {
      return value || null;
    }
  },
  
  // Время договоренности
  UF_CRM_1768734045422: {
    source: 'call.agreements.agreements_time',  // Откуда берем: время договоренности
    transform: (value) => {
      return value || null;
    }
  },
  
  // Возможный регион
  UF_CRM_1768734059241: {
    source: 'contact.dadataPhoneInfo.region',  // Откуда берем: регион из dadataPhoneInfo
    transform: (value) => {
      return value || null;
    }
  },
  
  // О клиенте
  UF_CRM_1768734316264: {
    source: 'call.agreements.client_facts',  // Откуда берем: факты о клиенте из договоренностей
    transform: (value) => {
      return value || null;
    }
  },
  
  // Закрывающее сообщение
  UF_CRM_1768734336116: {
    source: 'call.agreements.smsText',  // Откуда берем: SMS текст (закрывающее сообщение)
    transform: (value) => {
      return value || null;
    }
  }
};

/**
 * Маппинг для СДЕЛОК в Bitrix
 * (можно добавить позже, если понадобится)
 */
const dealMapping = {
  // Пример структуры (раскомментируйте и настройте по необходимости):
  /*
  TITLE: {
    source: 'call.agreements.agreements',
    transform: (value) => `Сделка: ${value?.substring(0, 100)}`
  },
  */
};

/**
 * Маппинг для КОНТАКТОВ в Bitrix
 * (можно добавить позже, если понадобится)
 */
const contactMapping = {
  // Пример структуры (раскомментируйте и настройте по необходимости):
  /*
  NAME: {
    source: 'call.agreements.client_name',
    transform: (value) => value?.split(' ')[0] || ''
  },
  */
};

/**
 * Функция для получения значения из объекта по пути (например, 'contact.phone')
 */
function getValueByPath(obj, path) {
  if (!path || path === 'static' || path === 'multiple') {
    return null;
  }
  
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
}

/**
 * Применяет маппинг к данным вебхука
 * @param {Object} webhookData - Данные из вебхука
 * @param {Object} mapping - Объект маппинга (leadMapping, dealMapping и т.д.)
 * @returns {Object} - Объект с полями для Bitrix
 */
function applyMapping(webhookData, mapping) {
  const result = {};
  
  for (const [bitrixField, config] of Object.entries(mapping)) {
    try {
      let value;
      
      if (config.source === 'static') {
        // Статическое значение
        value = config.value;
      } else if (config.source === 'multiple') {
        // Специальная обработка для множественных источников
        value = config.transform ? config.transform(null, webhookData) : null;
      } else {
        // Получаем значение по пути
        const rawValue = getValueByPath(webhookData, config.source);
        
        // Применяем преобразование, если есть
        if (config.transform) {
          value = config.transform(rawValue, webhookData);
        } else {
          value = rawValue;
        }
      }
      
      // Добавляем поле только если значение не null/undefined
      if (value !== null && value !== undefined) {
        result[bitrixField] = value;
      }
    } catch (error) {
      console.warn(`Ошибка при обработке поля ${bitrixField}:`, error.message);
    }
  }
  
  return result;
}

module.exports = {
  leadMapping,
  dealMapping,
  contactMapping,
  applyMapping,
  getValueByPath
};
