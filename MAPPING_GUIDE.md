# Руководство по настройке маппинга полей

## Быстрый старт

Вместо длинных ID типа `UF_CRM_6899EA70F16BE` используйте понятные алиасы!

## Пример использования

### Было (неудобно):
```javascript
const dealMapping = {
  'UF_CRM_6899EA70F16BE': 'call.agreements.client_name',  // Что это за поле?!
  'UF_CRM_6899EA7121D5F': 'contact.phone',                 // Непонятно!
};
```

### Стало (удобно):
```javascript
const dealMapping = {
  'firstName': 'call.agreements.client_name',  // Понятно - это имя!
  'phone': 'contact.phone',                    // Понятно - это телефон!
};
```

## Настройка под ваши поля

1. **Откройте `bitrix-fields.js`**
2. **Найдите нужные алиасы** или создайте новые
3. **Замените ID** на ваши реальные ID из Bitrix

Пример:
```javascript
const dealFields = {
  'firstName': 'UF_CRM_6899EA70F16BE',  // Замените на ваш ID
  'lastName': 'UF_CRM_6899EA7121D5F',   // Замените на ваш ID
};
```

## Доступные алиасы для сделок

### Базовые поля
- `title` → `TITLE` - Название сделки
- `category` → `CATEGORY_ID` - Категория
- `stage` → `STAGE_ID` - Стадия
- `opportunity` → `OPPORTUNITY` - Сумма
- `comments` → `COMMENTS` - Комментарии

### Кастомные поля (из вашего примера)
- `firstName` → `UF_CRM_6899EA70F16BE` - Имя
- `lastName` → `UF_CRM_6899EA7121D5F` - Фамилия
- `phone` → `UF_CRM_6899EA70D1AF5` - Телефон
- `email` → `UF_CRM_6899EA70B2CCA` - Email
- `city` → `UF_CRM_6899EA70E289B` - Город
- `eventType` → `UF_CRM_1763128557157` - Тип мероприятия
- `daysCombo` → `UF_CRM_1762286484638` - Комбинация дней
- `amount` → `UF_CRM_1762284392305` - Сумма
- `motivation` → `UF_CRM_1762285359695` - Мотивация
- `motivatingName` → `UF_CRM_1762284674882` - Мотивирующее название
- `paymentMethod` → `UF_CRM_1762285156705` - Способ оплаты
- `invoiceStatus` → `UF_CRM_1762603163315` - Статус счета
- `deliveryCity` → `UF_CRM_1762601175795` - Город доставки
- `deliveryAddress` → `UF_CRM_1762601333793` - Адрес доставки
- `startDate` → `UF_CRM_1762601517741` - Дата начала
- `endDate` → `UF_CRM_17626015323671` - Дата окончания
- `contactFirstName` → `UF_CRM_1762610575871` - Имя контакта
- `contactLastName` → `UF_CRM_1762610811113` - Фамилия контакта
- `contactPhone` → `UF_CRM_1762610828760` - Телефон контакта
- `contactEmail` → `UF_CRM_1762610845591` - Email контакта
- `contactCity` → `UF_CRM_1762610876315` - Город контакта

## Пример полного маппинга

```javascript
const dealMapping = {
  // Базовые поля
  'title': (data) => `Заявка юрлица на мероприятие: ${data.call?.agreements?.agreements}`,
  'category': 28,
  'stage': 'NEW',
  'opportunity': 10000,
  
  // Контактные данные
  'firstName': (data) => {
    const name = data.call?.agreements?.client_name || '';
    return name.split(' ')[0] || '';
  },
  'lastName': (data) => {
    const name = data.call?.agreements?.client_name || '';
    return name.split(' ').slice(1).join(' ') || '';
  },
  'phone': 'contact.phone',
  'email': 'contact.additionalFields.email',
  'city': 'contact.additionalFields.city',
  
  // Данные о мероприятии
  'eventType': (data) => data.callList?.name || 'Базовое мероприятие',
  'daysCombo': 'call.agreements.additionalFields.days',
  'motivation': 'call.agreements.interest_level',
  'startDate': 'call.agreements.agreements_time',
  
  // И так далее...
};
```

## Как узнать ID полей в Bitrix

### Способ 1: Через REST API
```bash
curl -X POST "https://your-domain.bitrix24.ru/rest/1/webhook_code/crm.deal.fields"
```

### Способ 2: Из URL запроса
Если у вас есть пример запроса к Bitrix, ID полей видны в параметрах:
```
FIELDS[UF_CRM_6899EA70F16BE]=Василий
         ^^^^^^^^^^^^^^^^^^^^
         Это и есть ID поля!
```

### Способ 3: Через интерфейс Bitrix
Настройки → CRM → Настройка полей → Сделки/Контакты

## Добавление новых алиасов

1. Откройте `bitrix-fields.js`
2. Добавьте новый алиас в соответствующий объект:

```javascript
const dealFields = {
  // ... существующие поля
  'myNewField': 'UF_CRM_YOUR_FIELD_ID',  // Новый алиас
};
```

3. Используйте его в `mapping.js`:

```javascript
const dealMapping = {
  'myNewField': 'call.agreements.someData',
};
```

## Обратная совместимость

Если вы используете реальные ID полей напрямую (например, `UF_CRM_6899EA70F16BE`), они тоже будут работать! Система автоматически распознает их.
