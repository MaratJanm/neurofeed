// js/modules/llm-service.js
// Модуль работы с Groq API (замена Qwen)

import { storage } from './storage.js';

class LLMService {
    constructor() {
        this.apiKey = null;
        this.apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        this.model = 'llama-3.3-70b-versatile'; // Быстрая модель
        // Альтернативы: 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'
    }

    async init() {
        // Загружаем ключ из настроек
        this.apiKey = await storage.getSetting('groq_api_key');
    }

    async setApiKey(key) {
        this.apiKey = key;
        await storage.saveSetting('groq_api_key', key);
    }

    getApiKey() {
        return this.apiKey;
    }

    isConfigured() {
        return !!this.apiKey;
    }

    async chat(messages, options = {}) {
        if (!this.apiKey) {
            throw new Error('API ключ не настроен. Добавьте Groq API ключ в настройках.');
        }

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: options.model || this.model,
                messages,
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 1024,
                stream: false
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
    }

    async streamChat(messages, onChunk, options = {}) {
        if (!this.apiKey) {
            throw new Error('API ключ не настроен');
        }

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: options.model || this.model,
                messages,
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 1024,
                stream: true
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `API Error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

            for (const line of lines) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices[0]?.delta?.content || '';
                    if (content) {
                        fullContent += content;
                        onChunk(content, fullContent);
                    }
                } catch (e) {
                    // Игнорируем ошибки парсинга
                }
            }
        }

        return fullContent;
    }

    // Создание саммари для одной новости
    async summarizeArticle(article) {
        const prompt = `Сделай краткое саммари следующей новости на русском языке (2-3 предложения). Пиши только саммари, без вступлений.

Заголовок: ${article.title}
Содержание: ${(article.content || article.description || '').substring(0, 2000)}`;

        const messages = [
            { 
                role: 'system', 
                content: 'Ты помощник для создания кратких саммари новостей. Пиши кратко, по существу, на русском языке. Не добавляй вступительных фраз типа "Вот саммари".' 
            },
            { role: 'user', content: prompt }
        ];

        return await this.chat(messages, { maxTokens: 300 });
    }

    // Создание саммари для группы новостей по теме
    async summarizeTopic(topic, newsItems) {
        const newsText = newsItems.slice(0, 10).map((item, i) => 
            `${i + 1}. ${item.title}\n   ${(item.description || '').substring(0, 200)}`
        ).join('\n\n');

        const prompt = `Проанализируй следующие новости по теме "${topic}" и сделай структурированный обзор на русском языке.

НОВОСТИ:
${newsText}

Напиши обзор в формате:
📌 ГЛАВНОЕ: (2-3 предложения о ключевых событиях)

🔹 ОСНОВНЫЕ МОМЕНТЫ:
• пункт 1
• пункт 2
• пункт 3

💡 ВЫВОД: (1-2 предложения)`;

        const messages = [
            { 
                role: 'system', 
                content: 'Ты аналитик новостей. Создавай структурированные обзоры на русском языке. Будь объективен и краток.' 
            },
            { role: 'user', content: prompt }
        ];

        return await this.chat(messages, { maxTokens: 800 });
    }

    // Стриминг саммари темы
    async streamTopicSummary(topic, newsItems, onChunk) {
        const newsText = newsItems.slice(0, 10).map((item, i) => 
            `${i + 1}. ${item.title}\n   ${(item.description || '').substring(0, 200)}`
        ).join('\n\n');

        const prompt = `Проанализируй новости по теме "${topic}" и напиши краткий обзор на русском:

${newsText}

Формат:
📌 ГЛАВНОЕ: ...
🔹 КЛЮЧЕВЫЕ МОМЕНТЫ: ...  
💡 ВЫВОД: ...`;

        const messages = [
            { 
                role: 'system', 
                content: 'Ты аналитик новостей. Пиши на русском, кратко и структурированно.' 
            },
            { role: 'user', content: prompt }
        ];

        return await this.streamChat(messages, onChunk, { maxTokens: 800 });
    }

    // Проверка подключения
    async testConnection() {
        try {
            const messages = [
                { role: 'user', content: 'Ответь одним словом: работает?' }
            ];
            const response = await this.chat(messages, { maxTokens: 10 });
            return { success: true, response };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

export const llmService = new LLMService();