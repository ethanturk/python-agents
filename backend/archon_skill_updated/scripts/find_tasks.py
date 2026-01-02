#!/usr/bin/env python3
import os
import sys

# Ensure local imports work whether run from root or scripts dir
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from archon_client import ArchonClient

def main():
    archon_host = "http://192.168.5.203:8181" # Default, can be overridden
    if len(sys.argv) > 1 and sys.argv[1].startswith("http"):
        archon_host = sys.argv[1]

    client = ArchonClient(base_url=archon_host)
    
    print(f"Connecting to Archon at {archon_host}...")
    
    # You can customize these filters
    # Example: filter by project_id="...", status="todo"
    
    result = client.list_tasks(
        status="todo", 
        limit=50
    )
    
    tasks = result.get('tasks', [])
    if not tasks:
        print("No tasks found (or error fetching). Result:", result)
        return

    print(f"Found {len(tasks)} tasks:")
    for t in tasks:
        print(f"[{t.get('status')}] {t.get('id')} - {t.get('title')}")

if __name__ == "__main__":
    main()
