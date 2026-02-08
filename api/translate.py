from deep_translator import GoogleTranslator

def translate_text(text, target_lang='ru'):
    try:
        # GoogleTranslator автоматически разбивает длинные тексты, если использовать перевод в цикле, 
        # но для 1Мб нам лучше переводить частями. 
        # Для начала попробуем базовый перевод.
        if not text.strip():
            return text
            
        translated = GoogleTranslator(source='auto', target=target_lang).translate(text)
        return translated
    except Exception as e:
        return f"Translation error: {str(e)}"
