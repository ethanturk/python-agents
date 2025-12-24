import requests
import os
from dotenv import load_dotenv
# from config import API_URL
API_URL = os.getenv('API_URL', 'http://localhost:9999')

load_dotenv()

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

def ingest_documents():
    path = input("Enter the file or directory path to ingest: ").strip()
    if not os.path.exists(path):
        print("Invalid path.")
        return

    files_content = []
    
    if os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                files_content.append({"filename": os.path.basename(path), "content": f.read()})
        except Exception as e:
            print(f"Error reading file {path}: {e}")
    elif os.path.isdir(path):
        for root, _, files in os.walk(path):
            for file in files:
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        files_content.append({"filename": file, "content": f.read()})
                except Exception as e:
                    print(f"Skipping {file}: {e}")
    
    if not files_content:
        print("No valid files found to ingest.")
        return

    print(f"\n--- Sending {len(files_content)} files for ingestion ---")
    try:
        response = requests.post(f"{API_URL}/agent/ingest", json={"files": files_content})
        response.raise_for_status()
        data = response.json()
        print(f"Task submitted! ID: {data.get('task_id')}")
        print("Check status using Option 3.")
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")

def search_documents():
    query = input("Enter search query: ").strip()
    print("\n--- Searching Documents ---")
    try:
        response = requests.post(f"{API_URL}/agent/search", json={"prompt": query})
        response.raise_for_status()
        results = response.json()
        print("\nSearch Results:")
        for idx, result in enumerate(results.get("results", []), 1):
             print(f"{idx}. {result['content']} (Source: {result['metadata'].get('filename')})")
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")


def main():
    print("Welcome to the LangChain Agent Client")
    while True:
        print("\n1. Run Synchronous Agent")
        print("2. Run Asynchronous Agent")
        print("3. Check Async Task Status")
        print("4. Ingest Documents")
        print("5. Search Documents")
        print("6. Exit")
        
        choice = input("Select an option: ").strip()
        
        if choice == '1':
            run_sync_agent()
        elif choice == '2':
            run_async_agent()
        elif choice == '3':
            check_task_status()
        elif choice == '4':
            ingest_documents()
        elif choice == '5':
            search_documents()
        elif choice == '6':
            print("Exiting...")
            break
        else:
            print("Invalid choice. Please try again.")

if __name__ == "__main__":
    main()
