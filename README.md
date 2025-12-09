# NeuroFeed — твой личный ИИ-новостник

<img src="https://github.com/MaratJanm/neurofeed/raw/main/screenshot.png" align="right" width="380">

**Полные тексты статей + ИИ-саммари по темам + работает оффлайн = всё, что ты хотел от RSS в 2025 году.**

Никаких дублей.  
Никакой рекламы и трекеров.

### Потестировать прямо сейчас:
Открой https://maratjanm.github.io/neurofeed

### Возможности
- Полные тексты статей прямо в приложении (95 % источников)
- Автоопределение тем: AI, Технологии, Безопасность, Бизнес и др.
- ИИ-саммари одной статьи за секунду
- Ежедневные обзоры по темам (типа "Что важного в мире ИИ сегодня")
- Полная работа оффлайн после первой загрузки
- Дедупликация новостей
- Автообновление каждые N минут
- Тёмная тема, PWA, устанавливается на телефон/комп

### Скриншоты
<img src="https://github.com/MaratJanm/neurofeed/raw/main/screenshot1.png" width="49%" align="right" style="border-radius:12px">
<img src="https://github.com/MaratJanm/neurofeed/raw/main/screenshot2.png" width="49%" style="border-radius:12px">

<br clear="right">

### Как запустить за 30 секунд
```bash
git clone https://github.com/maratjanm/neurofeed.git
cd neurofeed
python -m http.server 3000
```
Открой http://localhost:3000 — и всё работает.

### Используемые технологии

Vanilla JS (ноль фреймворков)
IndexedDB — хранит тысячи новостей
Groq / Llama 3 70B (или любой другой через API)
Полные тексты через <content:encoded>
Полностью open-source (MIT)

