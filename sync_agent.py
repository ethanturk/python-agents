from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import config

def run_sync_agent(user_input: str) -> str:
    """
    Synchronous agent:
    Takes input from a user and prompts a LLM with the input. 
    Returns the response.
    """
    if not config.OPENAI_API_KEY:
        return "Error: OPENAI_API_KEY not found in environment variables."

    # Connect to Local LLM
    llm = ChatOpenAI(
        api_key=config.OPENAI_API_KEY,
        base_url=config.OPENAI_API_BASE,
        model=config.OPENAI_MODEL
    )
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant."),
        ("user", "{input}")
    ])
    
    chain = prompt | llm | StrOutputParser()
    
    try:
        response = chain.invoke({"input": user_input})
        return response
    except Exception as e:
        return f"Error running sync agent: {str(e)}"

if __name__ == "__main__":
    # Test block
    print(run_sync_agent("Hello, are you there?"))
