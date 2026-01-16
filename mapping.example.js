// mapping.example.js - Пример настройки маппинга с использованием алиасов

/**
 * ПРИМЕР: Как использовать алиасы для удобной настройки маппинга
 * 
 * Вместо длинных ID типа UF_CRM_6899EA70F16BE используйте понятные имена!
 */

const dealMappingExample = {
  // Базовые поля через алиасы
  'title': (data) => {
    return `Заявка юрлица на мероприятие: ${data.call?.agreements?.agreements || 'Без названия'}`;
  },
  
  'category': 28, // ID категории из вашего Bitrix
  
  'stage': 'NEW', // или функция для логики
  
  // Кастомные поля через алиасы (теперь понятно что это!)
  'firstName': (data) => {
    // Извлекаем имя из client_name
    const name = data.call?.agreements?.client_name || '';
    return name.split(' ')[0] || '';
  },
  
  'lastName': (data) => {
    // Извлекаем фамилию из client_name
    const name = data.call?.agreements?.client_name || '';
    const parts = name.split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  },
  
  'phone': 'contact.phone',
  
  'email': (data) => {
    // Можно получить из additionalFields или другого источника
    return data.contact?.additionalFields?.email || '';
  },
  
  'city': 'contact.additionalFields.city',
  
  'eventType': (data) => {
    // Тип мероприятия из названия колл-листа или другого источника
    return data.callList?.name || 'Базовое мероприятие';
  },
  
  'motivation': 'call.agreements.interest_level',
  
  'opportunity': (data) => {
    // Сумма сделки, если есть в данных
    const amount = data.call?.agreements?.amount;
    return amount ? parseFloat(amount) : 10000; // или значение по умолчанию
  },
  
  // И так далее - все поля через понятные алиасы!
};

/**
 * Все доступные алиасы для сделок смотрите в bitrix-fields.js
 * 
 * Примеры:
 * - 'firstName' → UF_CRM_6899EA70F16BE
 * - 'lastName' → UF_CRM_6899EA7121D5F
 * - 'phone' → UF_CRM_6899EA70D1AF5
 * - 'email' → UF_CRM_6899EA70B2CCA
 * - 'city' → UF_CRM_6899EA70E289B
 * - и т.д.
 */

module.exports = { dealMappingExample };
