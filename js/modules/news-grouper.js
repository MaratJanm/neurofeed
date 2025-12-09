// Модуль группировки новостей по темам
import { CONFIG } from '../config.js';

class NewsGrouper {
    constructor() {
        this.topics = CONFIG.TOPICS;
    }

    // Определение темы для одной новости
    detectTopic(newsItem) {
        const text = `${newsItem.title} ${newsItem.description} ${newsItem.categories?.join(' ')}`.toLowerCase();
        
        let bestTopic = 'other';
        let maxScore = 0;

        for (const [topic, keywords] of Object.entries(this.topics)) {
            let score = 0;
            
            for (const keyword of keywords) {
                if (text.includes(keyword.toLowerCase())) {
                    score++;
                    // Бонус за совпадение в заголовке
                    if (newsItem.title.toLowerCase().includes(keyword.toLowerCase())) {
                        score += 2;
                    }
                }
            }

            if (score > maxScore) {
                maxScore = score;
                bestTopic = topic;
            }
        }

        return bestTopic;
    }

    // Добавление тем ко всем новостям
    assignTopics(newsItems) {
        return newsItems.map(item => ({
            ...item,
            topic: item.topic || this.detectTopic(item)
        }));
    }

    // Группировка новостей по темам
    groupByTopic(newsItems) {
        const groups = {
            all: newsItems
        };

        // Инициализация всех тем
        for (const topic of Object.keys(this.topics)) {
            groups[topic] = [];
        }
        groups.other = [];

        // Распределение по группам
        for (const item of newsItems) {
            const topic = item.topic || this.detectTopic(item);
            if (groups[topic]) {
                groups[topic].push(item);
            } else {
                groups.other.push(item);
            }
        }

        return groups;
    }

    // Получение списка тем с количеством новостей
    getTopicsWithCounts(newsItems) {
        const groups = this.groupByTopic(newsItems);
        
        const topics = [
            { id: 'all', name: 'Все', count: newsItems.length, icon: '📰' }
        ];

        const topicMeta = {
            technology: { name: 'Технологии', icon: '💻' },
            ai: { name: 'AI / ML', icon: '🤖' },
            security: { name: 'Безопасность', icon: '🔒' },
            business: { name: 'Бизнес', icon: '💼' },
            science: { name: 'Наука', icon: '🔬' },
            gadgets: { name: 'Гаджеты', icon: '📱' },
            other: { name: 'Другое', icon: '📄' }
        };

        for (const [topicId, meta] of Object.entries(topicMeta)) {
            const count = groups[topicId]?.length || 0;
            if (count > 0) {
                topics.push({
                    id: topicId,
                    name: meta.name,
                    icon: meta.icon,
                    count
                });
            }
        }

        return topics;
    }

    // Поиск похожих новостей (для дедупликации)
    findSimilarNews(newsItem, newsItems, threshold = 0.6) {
        const similar = [];
        const titleWords = this.tokenize(newsItem.title);

        for (const item of newsItems) {
            if (item.id === newsItem.id) continue;

            const otherTitleWords = this.tokenize(item.title);
            const similarity = this.calculateSimilarity(titleWords, otherTitleWords);

            if (similarity >= threshold) {
                similar.push({ item, similarity });
            }
        }

        return similar.sort((a, b) => b.similarity - a.similarity);
    }

    // Токенизация текста
    tokenize(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\sа-яё]/gi, '')
            .split(/\s+/)
            .filter(word => word.length > 2);
    }

    // Расчет коэффициента Жаккара
    calculateSimilarity(words1, words2) {
        const set1 = new Set(words1);
        const set2 = new Set(words2);
        
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return intersection.size / union.size;
    }

    // Дедупликация новостей
    deduplicateNews(newsItems) {
        const seen = new Map();
        const unique = [];

        for (const item of newsItems) {
            const titleKey = this.tokenize(item.title).sort().join(' ');
            
            if (!seen.has(titleKey)) {
                seen.set(titleKey, item);
                unique.push(item);
            } else {
                // Оставляем более новую версию
                const existing = seen.get(titleKey);
                if (new Date(item.pubDate) > new Date(existing.pubDate)) {
                    const index = unique.indexOf(existing);
                    unique[index] = item;
                    seen.set(titleKey, item);
                }
            }
        }

        return unique;
    }

    // Получение трендовых тем (часто упоминаемые слова)
    getTrendingKeywords(newsItems, limit = 10) {
        const wordCount = new Map();
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
            'что', 'как', 'это', 'для', 'при', 'или', 'его', 'она', 'они',
            'был', 'быть', 'все', 'так', 'уже', 'этот', 'также', 'после'
        ]);

        for (const item of newsItems) {
            const words = this.tokenize(item.title);
            for (const word of words) {
                if (!stopWords.has(word) && word.length > 3) {
                    wordCount.set(word, (wordCount.get(word) || 0) + 1);
                }
            }
        }

        return Array.from(wordCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([word, count]) => ({ word, count }));
    }
}

export const newsGrouper = new NewsGrouper();