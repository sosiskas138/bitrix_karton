// bitrix-fields.js - Конфигурация полей Bitrix24 с алиасами

/**
 * Алиасы для полей Bitrix24
 * Используйте понятные имена вместо длинных ID типа UF_CRM_6899EA70F16BE
 * 
 * Формат: 'понятное_имя': 'реальный_ID_поля_Bitrix'
 */

// Стандартные поля сделки (Deal)
const dealFields = {
  // Базовые поля
  'title': 'TITLE',
  'category': 'CATEGORY_ID',
  'stage': 'STAGE_ID',
  'opportunity': 'OPPORTUNITY',
  'currency': 'CURRENCY_ID',
  'comments': 'COMMENTS',
  
  // Кастомные поля (замените на ваши реальные ID)
  'firstName': 'UF_CRM_6899EA70F16BE',           // Имя
  'lastName': 'UF_CRM_6899EA7121D5F',            // Фамилия
  'phone': 'UF_CRM_6899EA70D1AF5',               // Телефон
  'email': 'UF_CRM_6899EA70B2CCA',              // Email
  'city': 'UF_CRM_6899EA70E289B',               // Город
  'eventType': 'UF_CRM_1763128557157',          // Тип мероприятия
  'daysCombo': 'UF_CRM_1762286484638',           // Комбинация дней
  'amount': 'UF_CRM_1762284392305',              // Сумма
  'motivation': 'UF_CRM_1762285359695',          // Мотивация
  'motivatingName': 'UF_CRM_1762284674882',      // Мотивирующее название
  'paymentMethod': 'UF_CRM_1762285156705',       // Способ оплаты
  'invoiceStatus': 'UF_CRM_1762603163315',       // Статус счета
  'deliveryCity': 'UF_CRM_1762601175795',        // Город доставки
  'deliveryAddress': 'UF_CRM_1762601333793',     // Адрес доставки
  'startDate': 'UF_CRM_1762601517741',          // Дата начала (15.11.2025)
  'endDate': 'UF_CRM_17626015323671',           // Дата окончания (17.11.2025) - проверьте ID в вашем Bitrix!
  'contactFirstName': 'UF_CRM_1762610575871',     // Имя контакта
  'contactLastName': 'UF_CRM_1762610811113',     // Фамилия контакта
  'contactPhone': 'UF_CRM_1762610828760',        // Телефон контакта
  'contactEmail': 'UF_CRM_1762610845591',        // Email контакта
  'contactCity': 'UF_CRM_1762610876315',         // Город контакта
};

// Стандартные поля контакта (Contact)
const contactFields = {
  'name': 'NAME',
  'lastName': 'LAST_NAME',
  'firstName': 'FIRST_NAME',
  'secondName': 'SECOND_NAME',
  'phone': 'PHONE',
  'email': 'EMAIL',
  'comments': 'COMMENTS',
  'post': 'POST',
  'address': 'ADDRESS',
};

// Стандартные поля лида (Lead)
const leadFields = {
  'title': 'TITLE',
  'name': 'NAME',
  'lastName': 'LAST_NAME',
  'firstName': 'FIRST_NAME',
  'secondName': 'SECOND_NAME',
  'phone': 'PHONE',
  'email': 'EMAIL',
  'comments': 'COMMENTS',
  'source': 'SOURCE_ID',
  'status': 'STATUS_ID',
};

/**
 * Функция для получения реального ID поля по алиасу
 * @param {string} alias - Понятное имя поля
 * @param {string} entityType - Тип сущности: 'deal', 'contact', 'lead'
 * @returns {string|null} - Реальный ID поля или null
 */
function getFieldId(alias, entityType = 'deal') {
  let fieldsMap;
  
  switch (entityType.toLowerCase()) {
    case 'deal':
      fieldsMap = dealFields;
      break;
    case 'contact':
      fieldsMap = contactFields;
      break;
    case 'lead':
      fieldsMap = leadFields;
      break;
    default:
      fieldsMap = dealFields;
  }
  
  // Если алиас найден, возвращаем реальный ID
  if (fieldsMap[alias]) {
    return fieldsMap[alias];
  }
  
  // Если переданный alias уже является реальным ID (начинается с UF_CRM_ или стандартное поле)
  if (alias.startsWith('UF_CRM_') || alias === alias.toUpperCase()) {
    return alias;
  }
  
  // Если не найдено, возвращаем null
  console.warn(`Поле "${alias}" не найдено для типа "${entityType}"`);
  return null;
}

/**
 * Функция для преобразования объекта с алиасами в объект с реальными ID полей
 * @param {object} fieldsWithAliases - Объект с полями, использующими алиасы
 * @param {string} entityType - Тип сущности: 'deal', 'contact', 'lead'
 * @returns {object} - Объект с реальными ID полей Bitrix
 */
function resolveFieldAliases(fieldsWithAliases, entityType = 'deal') {
  const resolved = {};
  
  for (const [alias, value] of Object.entries(fieldsWithAliases)) {
    const realFieldId = getFieldId(alias, entityType);
    if (realFieldId) {
      resolved[realFieldId] = value;
    }
  }
  
  return resolved;
}

module.exports = {
  dealFields,
  contactFields,
  leadFields,
  getFieldId,
  resolveFieldAliases,
};
