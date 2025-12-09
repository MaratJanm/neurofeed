// Модуль парсинга RSS
import { CONFIG } from '../config.js';

class RSSParser {
    constructor() {
        this.parser = new DOMParser();
    }

    async fetchFeed(feedUrl) {
        try {
            // Используем CORS proxy
            const proxyUrl = CONFIG.CORS_PROXY + encodeURIComponent(feedUrl);
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const text = await response.text();
            return this.parseFeed(text, feedUrl);
        } catch (error) {
            console.error(`Error fetching feed ${feedUrl}:`, error);
            throw error;
        }
    }

    parseFeed(xmlText, feedUrl) {
        const doc = this.parser.parseFromString(xmlText, 'text/xml');
        
        // Проверка на ошибку парсинга
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error('Invalid XML format');
        }

        // Определяем тип фида (RSS или Atom)
        const isAtom = doc.querySelector('feed') !== null;
        
        if (isAtom) {
            return this.parseAtom(doc, feedUrl);
        } else {
            return this.parseRSS(doc, feedUrl);
        }
    }

    parseRSS(doc, feedUrl) {
        const channel = doc.querySelector('channel');
        const items = doc.querySelectorAll('item');
        
        const feedTitle = this.getTextContent(channel, 'title') || feedUrl;
        
        return Array.from(items).map(item => {
            const title = this.getTextContent(item, 'title');
            const link = this.getTextContent(item, 'link');
            const description = this.cleanHTML(this.getTextContent(item, 'description') || '');
            const content = this.cleanHTML(
                this.getTextContent(item, 'content\\:encoded') || 
                this.getTextContent(item, 'content') || 
                description
            );
            const pubDate = this.parseDate(
                this.getTextContent(item, 'pubDate') || 
                this.getTextContent(item, 'dc\\:date')
            );
            const author = this.getTextContent(item, 'author') || 
                          this.getTextContent(item, 'dc\\:creator') ||
                          feedTitle;
            const categories = Array.from(item.querySelectorAll('category'))
                .map(c => c.textContent?.trim())
                .filter(Boolean);

            // Извлекаем изображение
            const image = this.extractImage(item, content);

            return {
                id: this.generateId(link || title),
                title: title || 'Без заголовка',
                link,
                description: description.substring(0, 500),
                content,
                pubDate,
                author,
                categories,
                image,
                feedUrl,
                feedTitle,
                fetchedAt: new Date().toISOString()
            };
        });
    }

    parseAtom(doc, feedUrl) {
        const feed = doc.querySelector('feed');
        const entries = doc.querySelectorAll('entry');
        
        const feedTitle = this.getTextContent(feed, 'title') || feedUrl;
        
        return Array.from(entries).map(entry => {
            const title = this.getTextContent(entry, 'title');
            const linkEl = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link');
            const link = linkEl?.getAttribute('href');
            const summary = this.cleanHTML(this.getTextContent(entry, 'summary') || '');
            const content = this.cleanHTML(
                this.getTextContent(entry, 'content') || summary
            );
            const pubDate = this.parseDate(
                this.getTextContent(entry, 'published') || 
                this.getTextContent(entry, 'updated')
            );
            const author = this.getTextContent(entry, 'author > name') || feedTitle;
            const categories = Array.from(entry.querySelectorAll('category'))
                .map(c => c.getAttribute('term'))
                .filter(Boolean);

            const image = this.extractImage(entry, content);

            return {
                id: this.generateId(link || title),
                title: title || 'Без заголовка',
                link,
                description: summary.substring(0, 500),
                content,
                pubDate,
                author,
                categories,
                image,
                feedUrl,
                feedTitle,
                fetchedAt: new Date().toISOString()
            };
        });
    }

    getTextContent(parent, selector) {
        if (!parent) return null;
        const element = parent.querySelector(selector);
        return element?.textContent?.trim() || null;
    }

    cleanHTML(html) {
        if (!html) return '';
        
        // Создаем временный элемент для парсинга HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        // Удаляем скрипты и стили
        temp.querySelectorAll('script, style').forEach(el => el.remove());
        
        // Получаем текст
        return temp.textContent?.trim() || '';
    }

    extractImage(item, content) {
        // Проверяем media:content
        const mediaContent = item.querySelector('media\\:content, content');
        if (mediaContent?.getAttribute('url')) {
            return mediaContent.getAttribute('url');
        }

        // Проверяем enclosure
        const enclosure = item.querySelector('enclosure[type^="image"]');
        if (enclosure?.getAttribute('url')) {
            return enclosure.getAttribute('url');
        }

        // Ищем изображение в контенте
        const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch) {
            return imgMatch[1];
        }

        return null;
    }

    parseDate(dateStr) {
        if (!dateStr) return new Date().toISOString();
        
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                return new Date().toISOString();
            }
            return date.toISOString();
        } catch {
            return new Date().toISOString();
        }
    }

    generateId(str) {
        // Простой хеш для генерации ID
        let hash = 0;
        const string = str || String(Date.now());
        for (let i = 0; i < string.length; i++) {
            const char = string.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'news_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
    }

    async fetchMultipleFeeds(feedUrls) {
        const results = await Promise.allSettled(
            feedUrls.map(feed => this.fetchFeed(typeof feed === 'string' ? feed : feed.url))
        );

        const allNews = [];
        const errors = [];

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                allNews.push(...result.value);
            } else {
                errors.push({
                    feed: feedUrls[index],
                    error: result.reason.message
                });
            }
        });

        return { news: allNews, errors };
    }
}

export const rssParser = new RSSParser();