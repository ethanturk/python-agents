#!/usr/bin/env python3
import sys
from archon_client import ArchonClient

def main():
    archon_host = "http://192.168.5.203:8181"
    client = ArchonClient(base_url=archon_host)
    
    print(f"Connecting to Archon at {archon_host}...")
    
    result = client.list_projects()
    
    if not result.get('success', True):
        print(f"Error listing projects: {result.get('error')}")
        return 1
        
    projects = result.get('projects', [])
    print(f"Found {len(projects)} projects:")
    for p in projects:
        print(f"- {p.get('name')} (ID: {p.get('id')})")
        if p.get('description'):
            print(f"  Desc: {p.get('description')}")
            
    return 0

if __name__ == "__main__":
    main()
