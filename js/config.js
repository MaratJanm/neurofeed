// js/config.js
export const CONFIG = {
    // Groq API (замена Qwen)
    LLM_PROVIDER: 'groq',
    GROQ_API_URL: 'https://api.groq.com/openai/v1/chat/completions',
    GROQ_MODEL: 'llama-3.1-8b-instant',
    
    // Доступные модели Groq
    GROQ_MODELS: [
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (быстрая)' },
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (умная)' },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' }
    ],
    
    // CORS Proxy для RSS
    CORS_PROXY: 'https://api.allorigins.win/raw?url=',
    
    // Альтернативные прокси
    CORS_PROXIES: [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?'
    ],
    
    // Дефолтные RSS источники
    DEFAULT_FEEDS: [
        { name: 'Habr', url: 'https://habr.com/ru/rss/articles/?fl=ru' },
        { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
        { name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
        { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
        { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml' }
    ],
    
    // Категории для группировки
    TOPICS: {
        'technology': ['tech', 'software', 'hardware', 'programming', 'developer', 'api', 'app', 'код', 'разработ', 'программ', 'веб', 'web', 'framework', 'javascript', 'python', 'rust'],
        'ai': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'neural', 'gpt', 'llm', 'ии', 'нейро', 'искусственн', 'chatgpt', 'openai', 'anthropic', 'gemini', 'claude', 'llama'],
        'security': ['security', 'hack', 'cyber', 'vulnerability', 'breach', 'безопасност', 'взлом', 'уязвим', 'malware', 'ransomware', 'phishing', 'privacy'],
        'business': ['business', 'startup', 'funding', 'investment', 'acquisition', 'бизнес', 'стартап', 'инвест', 'ipo', 'revenue', 'market', 'layoff'],
        'science': ['science', 'research', 'study', 'discovery', 'наук', 'исследован', 'открыт', 'physics', 'biology', 'space', 'nasa', 'spacex'],
        'gadgets': ['gadget', 'phone', 'laptop', 'device', 'apple', 'google', 'samsung', 'гаджет', 'смартфон', 'телефон', 'iphone', 'android', 'pixel', 'macbook']
    },
    
    // IndexedDB
    DB_NAME: 'NewsAggregatorDB',
    DB_VERSION: 1,
    
    // Лимиты
    MAX_NEWS_AGE_DAYS: 7,
    NEWS_PER_PAGE: 50
};