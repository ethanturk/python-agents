import argparse
import sys
from sync_agent import run_sync_agent
from async_tasks import check_knowledge_base, answer_question
from celery import chain

def main():
    print("Welcome to the LangChain Agent Sample Project")
    print("1. Synchronous Agent")
    print("2. Asynchronous Agent (Celery)")
    
    choice = input("Select an option (1 or 2): ").strip()
    
    if choice == '1':
        user_input = input("Enter your prompt for the Sync Agent: ")
        print("\n--- Running Synchronous Agent ---")
        response = run_sync_agent(user_input)
        print(f"Response: {response}")
        
    elif choice == '2':
        user_input = input("Enter your prompt for the Async Agent: ")
        print("\n--- Triggering Asynchronous Agent ---")
        # Define the chain: Step 1 -> Step 2
        workflow = chain(check_knowledge_base.s(user_input) | answer_question.s())
        result = workflow.apply_async()
        
        print(f"Task submitted! ID: {result.id}")
        print("Check your Celery execution logs for results.")
        
    else:
        print("Invalid choice.")

if __name__ == "__main__":
    main()
