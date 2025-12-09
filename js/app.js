// Главный модуль приложения
import { CONFIG } from './config.js';
import { storage } from './modules/storage.js';
import { rssParser } from './modules/rss-parser.js';
import { newsGrouper } from './modules/news-grouper.js';
import { llmService } from './modules/llm-service.js';
import { ui } from './modules/ui.js';

class NewsAggregatorApp {
    constructor() {
        this.currentTopic = 'all';
        this.news = [];
        this.feeds = [];
        this.refreshTimer = null;
        this.isLoading = false;
    }

    async init() {
        console.log('🚀 Initializing News Aggregator...');

        // Инициализация модулей
        ui.init();
        await llmService.init();

        // Загружаем сохраненные данные
        await this.loadSavedData();

        // Привязываем обработчики событий
        this.bindEvents();

        // Загружаем настройки
        await this.loadSettings();

        // Первичная загрузка новостей
        if (this.feeds.length > 0) {
            await this.refreshNews();
        } else {
            // Если нет источников - добавляем дефолтные
            await this.initDefaultFeeds();
        }

        // Устанавливаем автообновление
        this.setupAutoRefresh();

        console.log('✅ App initialized');
    }

    async loadSavedData() {
        try {
            // Загружаем источники
            this.feeds = await storage.getFeeds();
            
            // Загружаем кешированные новости
            this.news = await storage.getNews({ limit: CONFIG.NEWS_PER_PAGE });
            
            // Отображаем
            this.renderAll();
        } catch (error) {
            console.error('Error loading saved data:', error);
            ui.showToast('Ошибка загрузки данных', 'error');
        }
    }

    async initDefaultFeeds() {
        ui.showToast('Добавляем источники по умолчанию...', 'info');
        
        for (const feed of CONFIG.DEFAULT_FEEDS) {
            await this.addFeed(feed.url, feed.name);
        }

        await this.refreshNews();
    }

    async loadSettings() {
        const settings = await storage.getAllSettings();
        
        // Загружаем Groq API ключ
        if (settings.groq_api_key) {
            await llmService.setApiKey(settings.groq_api_key);
        }

        this.settings = {
            refreshInterval: settings.refresh_interval || 30,
            autoSummarize: settings.auto_summarize !== false
        };
    }

    bindEvents() {
        // Тест API подключения
        document.getElementById('test-api-btn')?.addEventListener('click', async () => {
            const apiKey = document.getElementById('api-token')?.value?.trim();
            
            if (!apiKey) {
                ui.showToast('Введите API ключ', 'warning');
                return;
            }

            ui.showToast('Проверяем подключение...', 'info');
            
            // Временно устанавливаем ключ для теста
            const oldKey = llmService.getApiKey();
            await llmService.setApiKey(apiKey);
            
            const result = await llmService.testConnection();
            
            if (result.success) {
                ui.showToast('✅ API работает!', 'success');
            } else {
                ui.showToast('❌ Ошибка: ' + result.error, 'error');
                // Восстанавливаем старый ключ если тест не прошёл
                if (oldKey) {
                    await llmService.setApiKey(oldKey);
                }
            }
        });
        // Кнопка обновления
        document.getElementById('refresh-btn')?.addEventListener('click', () => {
            this.refreshNews();
        });

        // Кнопка настроек
        document.getElementById('settings-btn')?.addEventListener('click', () => {
            ui.showSettingsModal({
                refreshInterval: this.settings.refreshInterval,
                autoSummarize: this.settings.autoSummarize
            });
        });

        // Сохранение настроек
        document.getElementById('save-settings')?.addEventListener('click', () => {
            this.saveSettings();
        });

        // Добавление нового источника
        document.getElementById('add-feed-btn')?.addEventListener('click', () => {
            this.handleAddFeed();
        });

        document.getElementById('new-feed-url')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleAddFeed();
            }
        });

        // Клик по навигации тем
        document.getElementById('topics-nav')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.topic-btn');
            if (btn) {
                this.selectTopic(btn.dataset.topic);
            }
        });

        // Клик по новости
        document.getElementById('news-list')?.addEventListener('click', (e) => {
            const card = e.target.closest('.news-card');
            if (card) {
                this.openNewsDetail(card.dataset.id);
            }
        });

        // Клик по источнику в списке
        document.getElementById('feeds-list')?.addEventListener('click', (e) => {
            // Удаление источника
            const removeBtn = e.target.closest('.btn-remove-feed');
            if (removeBtn) {
                e.stopPropagation();
                this.removeFeed(removeBtn.dataset.url);
                return;
            }

            // Фильтрация по источнику
            const li = e.target.closest('li[data-url]');
            if (li) {
                this.filterByFeed(li.dataset.url);
            }
        });

        // Генерация саммари для статьи
        document.getElementById('news-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'generate-summary-btn') {
                this.generateArticleSummary();
            }
        });
    }

    // === FEEDS MANAGEMENT ===
    async handleAddFeed() {
        const input = document.getElementById('new-feed-url');
        const url = input?.value.trim();

        if (!url) {
            ui.showToast('Введите URL RSS ленты', 'warning');
            return;
        }

        if (!this.isValidUrl(url)) {
            ui.showToast('Некорректный URL', 'error');
            return;
        }

        await this.addFeed(url);
        input.value = '';
    }

    async addFeed(url, name = null) {
        try {
            // Проверяем, не добавлен ли уже
            if (this.feeds.some(f => f.url === url)) {
                ui.showToast('Этот источник уже добавлен', 'warning');
                return;
            }

            ui.showToast('Проверяем источник...', 'info');

            // Пробуем загрузить фид для проверки
            const news = await rssParser.fetchFeed(url);
            
            if (news.length === 0) {
                ui.showToast('RSS лента пуста или недоступна', 'warning');
                return;
            }

            // Определяем имя из первой новости
            const feedName = name || news[0]?.feedTitle || this.extractDomain(url);

            const feed = {
                url,
                name: feedName,
                addedAt: new Date().toISOString(),
                lastFetch: new Date().toISOString()
            };

            this.feeds.push(feed);
            await storage.saveFeeds([feed]);

            // Сохраняем новости
            const processedNews = newsGrouper.assignTopics(news);
            await storage.saveNews(processedNews);
            
            this.news = [...processedNews, ...this.news];
            this.news = newsGrouper.deduplicateNews(this.news);
            this.news.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

            this.renderAll();
            ui.showToast(`Добавлен источник: ${feedName}`, 'success');

        } catch (error) {
            console.error('Error adding feed:', error);
            ui.showToast(`Ошибка: ${error.message}`, 'error');
        }
    }

    async removeFeed(url) {
        if (!confirm('Удалить этот источник?')) return;

        try {
            this.feeds = this.feeds.filter(f => f.url !== url);
            await storage.deleteFeed(url);

            // Удаляем новости этого источника из текущего списка
            this.news = this.news.filter(n => n.feedUrl !== url);

            this.renderAll();
            ui.showToast('Источник удален', 'success');
        } catch (error) {
            console.error('Error removing feed:', error);
            ui.showToast('Ошибка удаления источника', 'error');
        }
    }

    // === NEWS LOADING ===
    async refreshNews() {
        if (this.isLoading) return;

        if (this.feeds.length === 0) {
            ui.showToast('Добавьте хотя бы один RSS источник', 'warning');
            return;
        }

        this.isLoading = true;
        ui.showLoading();

        try {
            const { news, errors } = await rssParser.fetchMultipleFeeds(this.feeds);

            if (errors.length > 0) {
                console.warn('Some feeds failed:', errors);
                errors.forEach(err => {
                    ui.showToast(`Ошибка загрузки: ${err.feed.name || err.feed}`, 'warning');
                });
            }

            if (news.length > 0) {
                // Обрабатываем и сохраняем
                let processedNews = newsGrouper.assignTopics(news);
                processedNews = newsGrouper.deduplicateNews(processedNews);
                
                await storage.saveNews(processedNews);

                // Объединяем с существующими и дедуплицируем
                this.news = newsGrouper.deduplicateNews([...processedNews, ...this.news]);
                this.news.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

                // Ограничиваем количество
                if (this.news.length > CONFIG.NEWS_PER_PAGE * 2) {
                    this.news = this.news.slice(0, CONFIG.NEWS_PER_PAGE * 2);
                }

                ui.showToast(`Загружено ${news.length} новостей`, 'success');
            } else {
                ui.showToast('Нет новых новостей', 'info');
            }

            // Очищаем старые новости
            await storage.clearOldNews();

            this.renderAll();

        } catch (error) {
            console.error('Error refreshing news:', error);
            ui.showToast('Ошибка обновления новостей', 'error');
        } finally {
            this.isLoading = false;
            ui.hideLoading();
        }
    }

    // === TOPIC SELECTION ===
    selectTopic(topicId) {
        this.currentTopic = topicId;
        ui.setActiveTopic(topicId);
        this.renderNewsList();

        // Генерируем саммари для темы
        if (topicId !== 'all' && this.settings.autoSummarize) {
            this.generateTopicSummary(topicId);
        } else {
            ui.renderTopicSummary(null);
        }
    }

    filterByFeed(feedUrl) {
        const filteredNews = this.news.filter(n => n.feedUrl === feedUrl);
        ui.renderNewsList(filteredNews);
        ui.showToast(`Показаны новости из: ${this.extractDomain(feedUrl)}`, 'info');
    }

    // === NEWS DETAIL ===
    async openNewsDetail(newsId) {
        const newsItem = this.news.find(n => n.id === newsId);
        if (!newsItem) return;

        this.currentNewsItem = newsItem;
        ui.showNewsModal(newsItem);
    }

    async generateArticleSummary() {
        if (!this.currentNewsItem) return;

        ui.updateArticleSummary(null, true);

        try {
            const summary = await llmService.summarizeArticle(this.currentNewsItem);
            
            // Сохраняем саммари
            this.currentNewsItem.summary = summary;
            await storage.updateNews(this.currentNewsItem);

            // Обновляем в списке
            const index = this.news.findIndex(n => n.id === this.currentNewsItem.id);
            if (index !== -1) {
                this.news[index].summary = summary;
            }

            ui.updateArticleSummary(summary);
            ui.showToast('Саммари сгенерировано', 'success');

        } catch (error) {
            console.error('Error generating summary:', error);
            ui.updateArticleSummary('Ошибка генерации саммари: ' + error.message);
            ui.showToast('Ошибка генерации саммари', 'error');
        }
    }

    // === TOPIC SUMMARY ===
    async generateTopicSummary(topicId) {
        const topicNews = this.news.filter(n => n.topic === topicId);
        
        if (topicNews.length === 0) {
            ui.renderTopicSummary(null);
            return;
        }

        // Проверяем кеш
        const cacheKey = `topic_${topicId}_${new Date().toDateString()}`;
        const cached = await storage.getSummary(cacheKey);
        
        if (cached) {
            ui.renderTopicSummary(cached.content);
            return;
        }

        // Генерируем новый саммари с стримингом
        ui.initTopicSummaryStream();

        try {
            const topicLabels = {
                technology: 'Технологии',
                ai: 'Искусственный интеллект',
                security: 'Кибербезопасность',
                business: 'Бизнес',
                science: 'Наука',
                gadgets: 'Гаджеты',
                other: 'Другое'
            };

            const summary = await llmService.streamTopicSummary(
                topicLabels[topicId] || topicId,
                topicNews,
                (chunk) => {
                    ui.appendToTopicSummary(chunk);
                }
            );

            // Сохраняем в кеш
            await storage.saveSummary({
                id: cacheKey,
                topic: topicId,
                content: summary,
                createdAt: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error generating topic summary:', error);
            ui.renderTopicSummary('Ошибка генерации: ' + error.message);
            ui.showToast('Ошибка генерации саммари темы', 'error');
        }
    }

    // === SETTINGS ===
    async saveSettings() {
        const values = ui.getSettingsValues();

        try {
            // Сохраняем Groq API ключ
            if (values.apiKey) {
                await llmService.setApiKey(values.apiKey);
                
                // Тестируем подключение
                const test = await llmService.testConnection();
                if (!test.success) {
                    ui.showToast('Ошибка API: ' + test.error, 'error');
                    return;
                }
            }

            await storage.saveSetting('refresh_interval', values.refreshInterval);
            await storage.saveSetting('auto_summarize', values.autoSummarize);

            this.settings.refreshInterval = values.refreshInterval;
            this.settings.autoSummarize = values.autoSummarize;

            this.setupAutoRefresh();

            ui.closeModal('settings-modal');
            ui.showToast('Настройки сохранены', 'success');

        } catch (error) {
            console.error('Error saving settings:', error);
            ui.showToast('Ошибка сохранения: ' + error.message, 'error');
        }
    }

    // === AUTO REFRESH ===
    setupAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }

        const interval = (this.settings.refreshInterval || 30) * 60 * 1000;
        
        this.refreshTimer = setInterval(() => {
            console.log('Auto-refreshing news...');
            this.refreshNews();
        }, interval);
    }

    // === RENDERING ===
    renderAll() {
        this.renderNewsList();
        this.renderTopics();
        this.renderFeeds();
        this.renderStats();
    }

    renderNewsList() {
        let newsToShow = this.news;

        if (this.currentTopic && this.currentTopic !== 'all') {
            newsToShow = this.news.filter(n => n.topic === this.currentTopic);
        }

        ui.renderNewsList(newsToShow.slice(0, CONFIG.NEWS_PER_PAGE));
    }

    renderTopics() {
        const topics = newsGrouper.getTopicsWithCounts(this.news);
        ui.renderTopicsNav(topics, this.currentTopic);
    }

    renderFeeds() {
        // Подсчитываем новости по источникам
        const counts = {};
        this.news.forEach(n => {
            counts[n.feedUrl] = (counts[n.feedUrl] || 0) + 1;
        });

        ui.renderFeedsList(this.feeds, counts);
    }

    async renderStats() {
        const stats = await storage.getStats();
        ui.renderStats(stats);
    }

    // === HELPERS ===
    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    extractDomain(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return url;
        }
    }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    window.app = new NewsAggregatorApp();
    window.app.init();
});