#!/usr/bin/env python3
from archon_client import ArchonClient

def main():
    archon_host = "http://192.168.5.203:8181"
    client = ArchonClient(base_url=archon_host)
    result = client.list_projects()
    for p in result.get('projects', []):
        print(f"{p.get('id')} {p.get('name')}")

if __name__ == "__main__":
    main()
