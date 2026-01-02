#!/usr/bin/env python3
from archon_client import ArchonClient

def main():
    archon_host = "http://192.168.5.203:8181"
    client = ArchonClient(base_url=archon_host)
    
    # Filter by the correct project
    result = client.list_tasks(
        status="todo", 
        project_id="dcc396b1-fe2c-4e55-b1e7-5228e296b8b8", 
        limit=50
    )
    
    tasks = result.get('tasks', [])
    for t in tasks:
        # Check if this is our task
        if "Refactoring" in t.get('title', ''):
            print(f"{t.get('id')} {t.get('title')}")

if __name__ == "__main__":
    main()
