import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from dotenv import load_dotenv
import config

# Manually load env if needed, though config imports it.
load_dotenv()

print(f"API Base: {config.OPENAI_API_BASE}")
print(f"API Key: {config.OPENAI_API_KEY}")

try:
    print("Initializing ChatOpenAI with model='gpt-oss-20b'...")
    llm = ChatOpenAI(
        api_key=config.OPENAI_API_KEY,
        base_url=config.OPENAI_API_BASE,
        model=config.OPENAI_MODEL,
        temperature=0
    )
    
    print(f"LLM Model Name: {llm.model_name}")
    
    print("Invoking LLM...")
    response = llm.invoke([HumanMessage(content="Hello")])
    print(f"Response: {response.content}")

except Exception as e:
    print(f"Error: {e}")
