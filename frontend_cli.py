import requests
import sys
import time

API_URL = "http://localhost:8000"

def run_sync_agent():
    prompt = input("Enter your prompt for the Sync Agent: ").strip()
    print("\n--- Sending Request to Sync Agent ---")
    try:
        response = requests.post(f"{API_URL}/agent/sync", json={"prompt": prompt})
        response.raise_for_status()
        data = response.json()
        print(f"Response: {data.get('response')}")
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")

def run_async_agent():
    prompt = input("Enter your prompt for the Async Agent: ").strip()
    print("\n--- Triggering Asynchronous Agent ---")
    try:
        response = requests.post(f"{API_URL}/agent/async", json={"prompt": prompt})
        response.raise_for_status()
        data = response.json()
        task_id = data.get("task_id")
        print(f"Task submitted! ID: {task_id}")
        print("You can check the status using Option 3.")
        return task_id
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        return None

def check_task_status():
    task_id = input("Enter Task ID: ").strip()
    print(f"\n--- Checking Status for Task {task_id} ---")
    try:
        response = requests.get(f"{API_URL}/agent/status/{task_id}")
        response.raise_for_status()
        data = response.json()
        print(f"Status: {data.get('status')}")
        if data.get('result'):
            print(f"Result: {data.get('result')}")
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")

def main():
    print("Welcome to the LangChain Agent Client")
    while True:
        print("\n1. Run Synchronous Agent")
        print("2. Run Asynchronous Agent")
        print("3. Check Async Task Status")
        print("4. Exit")
        
        choice = input("Select an option: ").strip()
        
        if choice == '1':
            run_sync_agent()
        elif choice == '2':
            run_async_agent()
        elif choice == '3':
            check_task_status()
        elif choice == '4':
            print("Exiting...")
            break
        else:
            print("Invalid choice. Please try again.")

if __name__ == "__main__":
    main()
