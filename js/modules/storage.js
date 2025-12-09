// Модуль для работы с IndexedDB
import { CONFIG } from '../config.js';

class StorageService {
    constructor() {
        this.db = null;
        this.dbReady = this.initDB();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Хранилище новостей
                if (!db.objectStoreNames.contains('news')) {
                    const newsStore = db.createObjectStore('news', { keyPath: 'id' });
                    newsStore.createIndex('date', 'pubDate', { unique: false });
                    newsStore.createIndex('topic', 'topic', { unique: false });
                    newsStore.createIndex('feedUrl', 'feedUrl', { unique: false });
                }

                // Хранилище RSS источников
                if (!db.objectStoreNames.contains('feeds')) {
                    const feedsStore = db.createObjectStore('feeds', { keyPath: 'url' });
                    feedsStore.createIndex('name', 'name', { unique: false });
                }

                // Хранилище саммари
                if (!db.objectStoreNames.contains('summaries')) {
                    const summariesStore = db.createObjectStore('summaries', { keyPath: 'id' });
                    summariesStore.createIndex('topic', 'topic', { unique: false });
                    summariesStore.createIndex('date', 'createdAt', { unique: false });
                }

                // Хранилище настроек
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    async ensureDB() {
        if (!this.db) {
            await this.dbReady;
        }
        return this.db;
    }

    // === NEWS ===
    async saveNews(newsItems) {
        const db = await this.ensureDB();
        const tx = db.transaction('news', 'readwrite');
        const store = tx.objectStore('news');

        for (const item of newsItems) {
            await store.put(item);
        }

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getNews(options = {}) {
        const db = await this.ensureDB();
        const tx = db.transaction('news', 'readonly');
        const store = tx.objectStore('news');

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            
            request.onsuccess = () => {
                let news = request.result;

                // Фильтрация по теме
                if (options.topic && options.topic !== 'all') {
                    news = news.filter(n => n.topic === options.topic);
                }

                // Фильтрация по источнику
                if (options.feedUrl) {
                    news = news.filter(n => n.feedUrl === options.feedUrl);
                }

                // Сортировка по дате (новые первые)
                news.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

                // Лимит
                if (options.limit) {
                    news = news.slice(0, options.limit);
                }

                resolve(news);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    async getNewsById(id) {
        const db = await this.ensureDB();
        const tx = db.transaction('news', 'readonly');
        const store = tx.objectStore('news');

        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateNews(news) {
        const db = await this.ensureDB();
        const tx = db.transaction('news', 'readwrite');
        const store = tx.objectStore('news');

        return new Promise((resolve, reject) => {
            const request = store.put(news);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearOldNews() {
        const db = await this.ensureDB();
        const tx = db.transaction('news', 'readwrite');
        const store = tx.objectStore('news');
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - CONFIG.MAX_NEWS_AGE_DAYS);

        return new Promise((resolve, reject) => {
            const request = store.openCursor();
            let deletedCount = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    if (new Date(cursor.value.pubDate) < cutoffDate) {
                        cursor.delete();
                        deletedCount++;
                    }
                    cursor.continue();
                } else {
                    resolve(deletedCount);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    // === FEEDS ===
    async saveFeeds(feeds) {
        const db = await this.ensureDB();
        const tx = db.transaction('feeds', 'readwrite');
        const store = tx.objectStore('feeds');

        for (const feed of feeds) {
            await store.put(feed);
        }

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getFeeds() {
        const db = await this.ensureDB();
        const tx = db.transaction('feeds', 'readonly');
        const store = tx.objectStore('feeds');

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteFeed(url) {
        const db = await this.ensureDB();
        const tx = db.transaction('feeds', 'readwrite');
        const store = tx.objectStore('feeds');

        return new Promise((resolve, reject) => {
            const request = store.delete(url);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // === SUMMARIES ===
    async saveSummary(summary) {
        const db = await this.ensureDB();
        const tx = db.transaction('summaries', 'readwrite');
        const store = tx.objectStore('summaries');

        return new Promise((resolve, reject) => {
            const request = store.put(summary);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getSummary(id) {
        const db = await this.ensureDB();
        const tx = db.transaction('summaries', 'readonly');
        const store = tx.objectStore('summaries');

        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getSummariesByTopic(topic) {
        const db = await this.ensureDB();
        const tx = db.transaction('summaries', 'readonly');
        const store = tx.objectStore('summaries');
        const index = store.index('topic');

        return new Promise((resolve, reject) => {
            const request = index.getAll(topic);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // === SETTINGS ===
    async saveSetting(key, value) {
        const db = await this.ensureDB();
        const tx = db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');

        return new Promise((resolve, reject) => {
            const request = store.put({ key, value });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getSetting(key) {
        const db = await this.ensureDB();
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');

        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllSettings() {
        const db = await this.ensureDB();
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const settings = {};
                request.result.forEach(item => {
                    settings[item.key] = item.value;
                });
                resolve(settings);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // === STATS ===
    async getStats() {
        const db = await this.ensureDB();
        
        const newsCount = await this.countStore('news');
        const feedsCount = await this.countStore('feeds');
        const summariesCount = await this.countStore('summaries');
        
        const news = await this.getNews({ limit: 1000 });
        const topicCounts = {};
        news.forEach(n => {
            topicCounts[n.topic] = (topicCounts[n.topic] || 0) + 1;
        });

        return {
            totalNews: newsCount,
            totalFeeds: feedsCount,
            totalSummaries: summariesCount,
            topicCounts
        };
    }

    async countStore(storeName) {
        const db = await this.ensureDB();
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

export const storage = new StorageService();