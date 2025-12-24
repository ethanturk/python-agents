import time
from celery import Celery
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import config
import os

# Initialize Celery
app = Celery('langchain_agent_sample', broker=config.CELERY_BROKER_URL, backend=config.CELERY_RESULT_BACKEND)

def create_stub_kb():
    """Creates a stub knowledge base file."""
    kb_path = "stub_knowledge_base.txt"
    if not os.path.exists(kb_path):
        with open(kb_path, "w") as f:
            f.write("This is a stub knowledge base. The answer to every question is '42'.")
    return kb_path

@app.task
def check_knowledge_base(user_input):
    """
    Step 1: Check if KB exists.
    """
    if not config.OPENAI_API_KEY:
        return {"error": "Missing API Key"}

    llm = ChatOpenAI(
        api_key=config.OPENAI_API_KEY,
        base_url=config.OPENAI_API_BASE,
        model=config.OPENAI_MODEL
    )
    print(f"DEBUG: check_knowledge_base using model: {llm.model_name}")
    
    # Prompt 1: Does a knowledge base currently exist?
    # We provide some context or just ask. Since I am an AI, I don't know the file system unless told.
    # However, for the sake of the exercise, we will ask the LLM to determined it based on a "system context"
    # OR we just implement the logic: Ask LLM, if it says "No", we make one.
    # To make it interesting, we'll prompt the LLM about the concept of a KB for "this codebase".
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an intelligent assistant managing a codebase."),
        ("user", "Does a knowledge base currently exist for this codebase? Reply 'YES' or 'NO' only.")
    ])
    
    chain = prompt | llm | StrOutputParser()
    
    # We might simulate "this codebase" context by just checking real file existence 
    # and feeding that to the prompt, or just letting the LLM hallucinate.
    # The requirement says "Prompt - Does a knowledge base currently exist...".
    # I will let the LLM decide. If it says NO, I create one.
    
    kb_exists_physically = os.path.exists("stub_knowledge_base.txt")
    context = f"File system check returns: {kb_exists_physically}"
    
    try:
        response = chain.invoke({"input": ""}).strip().upper()
        kb_location = None
        if "YES" in response:
            kb_location = "existing_kb.txt"
        else:
            kb_location = create_stub_kb()
            
        return {
            "user_input": user_input,
            "kb_location": kb_location,
            "step1_decision": response
        }
    except Exception as e:
        return {"error": str(e)}

@app.task
def answer_question(context_data):
    """
    Step 2: Answer question using the KB reference.
    """
    if "error" in context_data:
        return f"Previous step failed: {context_data['error']}"
        
    user_input = context_data.get("user_input")
    kb_location = context_data.get("kb_location")
    
    if not config.OPENAI_API_KEY:
        return "Error: Missing API Key"

    llm = ChatOpenAI(
        api_key=config.OPENAI_API_KEY,
        base_url=config.OPENAI_API_BASE,
        model=config.OPENAI_MODEL
    )
    print(f"DEBUG: answer_question using model: {llm.model_name}")

    # Load KB content (stub)
    kb_content = ""
    try:
        with open(kb_location, "r") as f:
            kb_content = f.read()
    except:
        kb_content = "Could not read knowledge base."

    # Prompt 2: What question does the user want answered?
    
    prompt_extract = ChatPromptTemplate.from_messages([
        ("system", "Extract the core question from the user input."),
        ("user", "{input}")
    ])
    
    chain_extract = prompt_extract | llm | StrOutputParser()
    question = chain_extract.invoke({"input": user_input})
    
    prompt_answer = ChatPromptTemplate.from_messages([
        ("system", f"Answer the user's question using this knowledge base content: {kb_content}"),
        ("user", "{question}")
    ])
    
    chain_answer = prompt_answer | llm | StrOutputParser()
    final_answer = chain_answer.invoke({"question": question})
    
    return f"Question Extracted: {question}\nAnswer: {final_answer}\n(Source KB: {kb_location})"
