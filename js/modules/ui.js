// Модуль UI рендеринга
class UIService {
    constructor() {
        this.elements = {};
        this.toastContainer = null;
    }

    init() {
        // Кешируем DOM элементы
        this.elements = {
            newsList: document.getElementById('news-list'),
            loading: document.getElementById('loading'),
            topicsNav: document.getElementById('topics-nav'),
            feedsList: document.getElementById('feeds-list'),
            stats: document.getElementById('stats'),
            topicSummary: document.getElementById('topic-summary'),
            settingsModal: document.getElementById('settings-modal'),
            newsModal: document.getElementById('news-modal'),
            newFeedUrl: document.getElementById('new-feed-url'),
            apiToken: document.getElementById('api-token'),
            refreshInterval: document.getElementById('refresh-interval'),
            autoSummarize: document.getElementById('auto-summarize')
        };

        // Создаем контейнер для toast уведомлений
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container';
        document.body.appendChild(this.toastContainer);

        this.bindModalEvents();
    }

    bindModalEvents() {
        // Закрытие модальных окон
        document.getElementById('close-settings')?.addEventListener('click', () => {
            this.closeModal('settings-modal');
        });

        document.getElementById('close-news')?.addEventListener('click', () => {
            this.closeModal('news-modal');
        });

        // Закрытие по клику на оверлей
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(modal => {
                    modal.classList.remove('active');
                });
            }
        });
    }

    // === LOADING ===
    showLoading() {
        this.elements.loading?.classList.remove('hidden');
        if (this.elements.newsList) {
            this.elements.newsList.style.display = 'none';
        }
    }

    hideLoading() {
        this.elements.loading?.classList.add('hidden');
        if (this.elements.newsList) {
            this.elements.newsList.style.display = 'flex';
        }
    }

    // === NEWS LIST ===
    renderNewsList(newsItems) {
        if (!this.elements.newsList) return;

        if (newsItems.length === 0) {
            this.elements.newsList.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📭</div>
                    <h3>Нет новостей</h3>
                    <p>Добавьте RSS источники или обновите ленту</p>
                </div>
            `;
            return;
        }

        this.elements.newsList.innerHTML = newsItems.map(item => this.renderNewsCard(item)).join('');
    }

    renderNewsCard(item) {
        const date = this.formatDate(item.pubDate);
        const hasSummary = item.summary ? 'has-summary' : '';
        
        return `
            <article class="news-card ${hasSummary}" data-id="${item.id}">
                <div class="news-card-header">
                    <h3>${this.escapeHtml(item.title)}</h3>
                    <span class="news-source">${this.escapeHtml(item.feedTitle || 'Unknown')}</span>
                </div>
                <p>${this.escapeHtml(item.description || '')}</p>
                <div class="news-card-footer">
                    <span class="news-topic">${this.getTopicLabel(item.topic)}</span>
                    <span class="news-date">${date}</span>
                </div>
            </article>
        `;
    }

    // === TOPICS NAV ===
    renderTopicsNav(topics, activeTopic = 'all') {
        if (!this.elements.topicsNav) return;

        this.elements.topicsNav.innerHTML = topics.map(topic => `
            <button class="topic-btn ${topic.id === activeTopic ? 'active' : ''}" 
                    data-topic="${topic.id}">
                ${topic.icon} ${topic.name} <span class="count">(${topic.count})</span>
            </button>
        `).join('');
    }

    setActiveTopic(topicId) {
        document.querySelectorAll('.topic-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.topic === topicId);
        });
    }

    // === FEEDS LIST ===
    renderFeedsList(feeds, newsCounts = {}) {
        if (!this.elements.feedsList) return;

        if (feeds.length === 0) {
            this.elements.feedsList.innerHTML = '<li class="empty">Нет источников</li>';
            return;
        }

        this.elements.feedsList.innerHTML = feeds.map(feed => {
            const count = newsCounts[feed.url] || 0;
            return `
                <li data-url="${this.escapeHtml(feed.url)}">
                    <span class="feed-name" title="${this.escapeHtml(feed.url)}">
                        ${this.escapeHtml(feed.name || this.extractDomain(feed.url))}
                    </span>
                    <span class="feed-count">${count}</span>
                    <button class="btn-remove-feed" data-url="${this.escapeHtml(feed.url)}" title="Удалить">×</button>
                </li>
            `;
        }).join('');
    }

    // === STATS ===
    renderStats(stats) {
        if (!this.elements.stats) return;

        this.elements.stats.innerHTML = `
            <p>📰 Новостей: <strong>${stats.totalNews}</strong></p>
            <p>📡 Источников: <strong>${stats.totalFeeds}</strong></p>
            <p>🤖 Саммари: <strong>${stats.totalSummaries}</strong></p>
        `;
    }

    // === TOPIC SUMMARY ===
    renderTopicSummary(summary, isLoading = false) {
        if (!this.elements.topicSummary) return;

        if (isLoading) {
            this.elements.topicSummary.innerHTML = `
                <div class="summary-loading">
                    <div class="spinner"></div>
                    <p>Генерация саммари...</p>
                </div>
            `;
            return;
        }

        if (!summary) {
            this.elements.topicSummary.innerHTML = `
                <p class="placeholder">Выберите тему для получения AI-саммари</p>
            `;
            return;
        }

        this.elements.topicSummary.innerHTML = `
            <div class="summary-content">${this.formatSummary(summary)}</div>
        `;
    }

    // Стриминг саммари
    appendToTopicSummary(chunk) {
        const content = this.elements.topicSummary?.querySelector('.summary-content');
        if (content) {
            content.textContent += chunk;
        }
    }

    initTopicSummaryStream() {
        if (this.elements.topicSummary) {
            this.elements.topicSummary.innerHTML = `
                <div class="summary-content"></div>
            `;
        }
    }

    // === NEWS MODAL ===
    showNewsModal(newsItem) {
        const modal = this.elements.newsModal;
        if (!modal) return;

        document.getElementById('news-title').textContent = newsItem.title;
        
        document.getElementById('news-meta').innerHTML = `
            <span>📅 ${this.formatDate(newsItem.pubDate)}</span>
            <span>📰 ${this.escapeHtml(newsItem.feedTitle || '')}</span>
            ${newsItem.author ? `<span>✍️ ${this.escapeHtml(newsItem.author)}</span>` : ''}
            ${newsItem.link ? `<a href="${newsItem.link}" target="_blank" rel="noopener">🔗 Открыть оригинал</a>` : ''}
        `;

        document.getElementById('news-content').innerHTML = newsItem.content || newsItem.description || 'Нет содержимого';

        const summaryEl = document.getElementById('article-summary');
        if (newsItem.summary) {
            summaryEl.innerHTML = this.formatSummary(newsItem.summary);
        } else {
            summaryEl.innerHTML = `
                <button class="btn btn-primary" id="generate-summary-btn">
                    🤖 Сгенерировать саммари
                </button>
            `;
        }

        modal.classList.add('active');
    }

    updateArticleSummary(summary, isLoading = false) {
        const summaryEl = document.getElementById('article-summary');
        if (!summaryEl) return;

        if (isLoading) {
            summaryEl.innerHTML = `
                <div class="summary-loading">
                    <div class="spinner"></div>
                    <span>Генерация...</span>
                </div>
            `;
            return;
        }

        summaryEl.innerHTML = this.formatSummary(summary);
    }

    // === SETTINGS MODAL ===
    showSettingsModal(settings = {}) {
        const modal = this.elements.settingsModal;
        if (!modal) return;

        if (this.elements.apiToken) {
            this.elements.apiToken.value = settings.apiKey || '';
        }
        if (this.elements.refreshInterval) {
            this.elements.refreshInterval.value = settings.refreshInterval || 30;
        }
        if (this.elements.autoSummarize) {
            this.elements.autoSummarize.checked = settings.autoSummarize !== false;
        }

        modal.classList.add('active');
    }


    getSettingsValues() {
        return {
            apiKey: this.elements.apiToken?.value?.trim() || '',
            refreshInterval: parseInt(this.elements.refreshInterval?.value) || 30,
            autoSummarize: this.elements.autoSummarize?.checked ?? true
        };
    }

    closeModal(modalId) {
        document.getElementById(modalId)?.classList.remove('active');
    }

    // === TOAST NOTIFICATIONS ===
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${this.escapeHtml(message)}</span>
        `;

        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastIn 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // === HELPERS ===
    formatDate(dateStr) {
        if (!dateStr) return '';
        
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;

        // Менее часа назад
        if (diff < 3600000) {
            const mins = Math.floor(diff / 60000);
            return `${mins} мин. назад`;
        }

        // Менее суток назад
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} ч. назад`;
        }

        // Менее недели назад
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days} дн. назад`;
        }

        // Иначе показываем дату
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short'
        });
    }

    formatSummary(text) {
        if (!text) return '';
        
        // Простое форматирование markdown-подобного текста
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^(.+)$/m, '<p>$1</p>');
    }

    getTopicLabel(topic) {
        const labels = {
            technology: '💻 Технологии',
            ai: '🤖 AI/ML',
            security: '🔒 Безопасность',
            business: '💼 Бизнес',
            science: '🔬 Наука',
            gadgets: '📱 Гаджеты',
            other: '📄 Другое'
        };
        return labels[topic] || labels.other;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    extractDomain(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return url;
        }
    }
}

export const ui = new UIService();