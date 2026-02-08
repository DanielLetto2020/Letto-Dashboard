from deep_translator import GoogleTranslator
import time

def translate_text(text, target_lang='ru'):
    try:
        if not text or not text.strip():
            return text
            
        # Очистка текста от лишних пробелов по краям
        content = text.strip()
        
        # Разбиваем текст на части, если он слишком длинный (Google API имеет лимиты)
        # Для начала попробуем перевести блок целиком, но через простейший вызов
        translator = GoogleTranslator(source='auto', target=target_lang)
        
        # Если текст очень большой, deep-translator может буксовать.
        # Ограничим один запрос 4000 символами (безопасно для Google)
        if len(content) > 4000:
            parts = [content[i:i+4000] for i in range(0, len(content), 4000)]
            translated_parts = []
            for part in parts:
                translated_parts.append(translator.translate(part))
                time.sleep(0.1) # Небольшая пауза между запросами
            return "\n".join(translated_parts)
        
        return translator.translate(content)
    except Exception as e:
        # Возвращаем детальную ошибку для отладки
        return f"Translation error: {type(e).__name__} - {str(e)}"
