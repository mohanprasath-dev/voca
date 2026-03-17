from google import genai
from config import settings
client = genai.Client(api_key=settings.gemini_api_key)
r = client.models.generate_content(model='gemini-3.1-flash-lite', contents='Say hello. Start with [LANG:en]')
print(r.text)
print('WORKING')
