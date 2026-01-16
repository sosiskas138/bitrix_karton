// mapping.js - Конфигурация маппинга полей между Sasha AI и Bitrix24
const { resolveFieldAliases } = require('./bitrix-fields');

/**
 * Маппинг полей для создания/обновления контакта в Bitrix
 * Теперь можно использовать понятные алиасы вместо длинных ID!
 * Формат: 'алиас_поля': 'путь.к.данным.из.sasha' или функция
 */
const contactMapping = {
  // Имя контакта (может быть пустым, используем телефон как fallback)
  'name': (data) => {
    const clientName = data.call?.agreements?.client_name?.trim();
    if (clientName) return clientName;
    // Если имени нет, используем телефон или название колл-листа
    return data.contact?.phone || data.callList?.name || 'Контакт без имени';
  },
  
  // Телефон (формат для Bitrix)
  'phone': (data) => {
    const phone = data.contact?.phone;
    if (!phone) return null;
    return [{ 
      'VALUE': phone, 
      'VALUE_TYPE': 'WORK' 
    }];
  },
  
  // Комментарии - договоренность или факты о клиенте
  'comments': (data) => {
    const agreements = data.call?.agreements?.agreements?.trim();
    const facts = data.call?.agreements?.client_facts?.trim();
    const parts = [agreements, facts].filter(Boolean);
    return parts.length > 0 ? parts.join('\n\n') : null;
  },
  
  // Дополнительные поля из additionalFields
  // 'email': (data) => data.contact?.additionalFields?.email || null,
  // 'website': (data) => data.contact?.additionalFields?.website || null,
};

/**
 * Маппинг полей для создания/обновления сделки в Bitrix
 * Используйте понятные алиасы из bitrix-fields.js вместо длинных ID!
 */
const dealMapping = {
  // Название сделки (используем алиас 'title')
  'title': (data) => {
    const agreements = data.call?.agreements?.agreements?.trim();
    const clientName = data.call?.agreements?.client_name?.trim();
    const callListName = data.callList?.name;
    
    if (agreements) {
      // Если есть договоренность, используем её
      if (clientName) {
        return `${clientName}: ${agreements}`;
      }
      return agreements;
    }
    
    // Если договоренности нет, формируем из доступных данных
    if (clientName) {
      return `Заявка от ${clientName}`;
    }
    
    if (callListName) {
      return `Заявка юрлица на мероприятие: ${callListName}`;
    }
    
    return `Заявка от ${data.contact?.phone || 'неизвестного'}`;
  },
  
  // Категория сделки (если нужно)
  // 'category': 28, // ID вашей категории - раскомментируйте и укажите ваш ID
  
  // Стадия сделки (логика на основе данных)
  'stage': (data) => {
    // Настройте стадии под вашу воронку Bitrix
    const isCommit = data.call?.agreements?.isCommit;
    const status = data.call?.agreements?.status; // "transfer" и т.д.
    const leadDestination = data.call?.agreements?.lead_destination; // "sales" и т.д.
    
    if (isCommit) {
      return 'NEW'; // Стадия "Новая" - настройте под вашу воронку Bitrix
    }
    
    // Можно использовать status или lead_destination для определения стадии
    // if (status === 'transfer') {
    //   return 'PREPARATION';
    // }
    
    return 'PREPARATION'; // Стадия по умолчанию
  },
  
  // Комментарии к сделке (факты о клиенте и договоренность)
  'comments': (data) => {
    const facts = data.call?.agreements?.client_facts?.trim();
    const agreements = data.call?.agreements?.agreements?.trim();
    const smsText = data.call?.agreements?.smsText?.trim();
    
    const parts = [];
    if (facts) parts.push(`Факты о клиенте:\n${facts}`);
    if (agreements) parts.push(`Договоренность:\n${agreements}`);
    if (smsText) parts.push(`SMS текст:\n${smsText}`);
    
    return parts.length > 0 ? parts.join('\n\n') : null;
  },
  
  // Сумма сделки (если есть в данных)
  // 'opportunity': (data) => {
  //   const amount = data.call?.agreements?.amount;
  //   return amount ? parseFloat(amount) : null;
  // },
  
  // ============================================
  // КАСТОМНЫЕ ПОЛЯ: Раскомментируйте нужные поля
  // ============================================
  
  // Контактные данные (используйте алиасы из bitrix-fields.js)
  // 'firstName': (data) => {
  //   const name = data.call?.agreements?.client_name?.trim() || '';
  //   return name.split(' ')[0] || null;
  // },
  // 'lastName': (data) => {
  //   const name = data.call?.agreements?.client_name?.trim() || '';
  //   const parts = name.split(' ').filter(Boolean);
  //   return parts.length > 1 ? parts.slice(1).join(' ') : null;
  // },
  // 'phone': (data) => data.contact?.phone || null,
  // 'email': (data) => data.contact?.additionalFields?.email || null,
  // 'city': (data) => {
  //   // Можно извлечь из dadataPhoneInfo или additionalFields
  //   return data.contact?.dadataPhoneInfo?.region || 
  //          data.contact?.additionalFields?.city || null;
  // },
  
  // Данные о мероприятии
  // 'category': 28, // ID категории из вашего Bitrix - укажите ваш ID
  // 'eventType': (data) => data.callList?.name || null, // Название колл-листа
  // 'daysCombo': (data) => data.call?.agreements?.daysCombo || null,
  // 'motivation': (data) => data.call?.agreements?.interest_level || null,
  // 'paymentMethod': (data) => data.call?.agreements?.paymentMethod || null,
  // 'startDate': (data) => {
  //   // Преобразуем формат даты если нужно
  //   const date = data.call?.agreements?.agreements_time;
  //   return date || null; // Формат: "2025-05-12 17:03:00"
  // },
  // 'endDate': (data) => {
  //   const date = data.call?.agreements?.agreements_time_local;
  //   return date || null;
  // },
  
  // Дополнительные данные
  // 'website': (data) => data.contact?.additionalFields?.website || null,
  // 'leadDestination': (data) => data.call?.agreements?.lead_destination || null, // "sales"
  // 'callStatus': (data) => data.call?.agreements?.status || null, // "transfer"
  
  // Все доступные алиасы смотрите в bitrix-fields.js!
};

/**
 * Маппинг полей для создания лида в Bitrix
 * Используйте понятные алиасы вместо длинных ID!
 */
const leadMapping = {
  // Название лида
  'title': (data) => {
    const agreements = data.call?.agreements?.agreements?.trim();
    const clientName = data.call?.agreements?.client_name?.trim();
    const callListName = data.callList?.name;
    
    if (agreements) {
      return clientName ? `${clientName}: ${agreements}` : agreements;
    }
    
    if (callListName) {
      return `Лид: ${callListName}`;
    }
    
    return `Лид от ${clientName || data.contact?.phone || 'неизвестного'}`;
  },
  
  // Имя (может быть пустым)
  'name': (data) => {
    const clientName = data.call?.agreements?.client_name?.trim();
    return clientName || data.contact?.phone || null;
  },
  
  // Телефон
  'phone': (data) => {
    const phone = data.contact?.phone;
    if (!phone) return null;
    return [{ 
      'VALUE': phone, 
      'VALUE_TYPE': 'WORK' 
    }];
  },
  
  // Комментарии (факты о клиенте)
  'comments': (data) => {
    const facts = data.call?.agreements?.client_facts?.trim();
    const agreements = data.call?.agreements?.agreements?.trim();
    const parts = [facts, agreements].filter(Boolean);
    return parts.length > 0 ? parts.join('\n\n') : null;
  },
  
  // Источник
  'source': 'WEB',
  
  // Дополнительные поля можно добавить здесь
  // 'website': (data) => data.contact?.additionalFields?.website || null,
};

/**
 * Функция для получения значения по пути (например, "call.agreements.client_name")
 * @param {object} obj - Объект данных
 * @param {string} path - Путь к значению через точку
 * @returns {any} - Значение или undefined
 */
function getValueByPath(obj, path) {
  if (!path || !obj) return undefined;
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, obj);
}

/**
 * Функция для преобразования данных по маппингу
 * @param {object} webhookData - Данные вебхука от Sasha AI
 * @param {object} mapping - Объект маппинга полей (с алиасами)
 * @param {string} entityType - Тип сущности: 'deal', 'contact', 'lead'
 * @returns {object} - Объект с полями для Bitrix (с реальными ID полей)
 */
function mapFields(webhookData, mapping, entityType = 'deal') {
  const result = {};
  
  // Сначала преобразуем данные по маппингу (получаем значения)
  for (const [alias, sashaPath] of Object.entries(mapping)) {
    try {
      let value;
      
      if (typeof sashaPath === 'function') {
        // Если значение - функция, вызываем её
        value = sashaPath(webhookData);
      } else if (Array.isArray(sashaPath)) {
        // Если массив (для PHONE, EMAIL и т.д.)
        value = sashaPath.map(item => {
          const mapped = {};
          for (const [key, path] of Object.entries(item)) {
            mapped[key] = getValueByPath(webhookData, path);
          }
          return mapped;
        }).filter(item => Object.values(item).some(v => v !== undefined));
      } else {
        // Обычное поле - путь к данным
        value = getValueByPath(webhookData, sashaPath);
      }
      
      // Добавляем поле только если значение не undefined, не null и не пустая строка
      if (value !== undefined && value !== null) {
        // Пропускаем пустые строки
        if (typeof value === 'string' && value.trim() === '') {
          continue;
        }
        // Если массив пустой, не добавляем
        if (Array.isArray(value) && value.length === 0) {
          continue;
        }
        result[alias] = value;
      }
    } catch (error) {
      console.warn(`Ошибка при маппинге поля ${alias}:`, error.message);
    }
  }
  
  // Преобразуем алиасы в реальные ID полей Bitrix
  return resolveFieldAliases(result, entityType);
}

module.exports = {
  contactMapping,
  dealMapping,
  leadMapping,
  mapFields,
  getValueByPath,
};
