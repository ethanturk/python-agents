#!/usr/bin/env python3
import sys
import argparse
import json
from archon_client import ArchonClient

def main():
    parser = argparse.ArgumentParser(description="Manage Archon Tasks")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # update command
    update_parser = subparsers.add_parser("update", help="Update a task status")
    update_parser.add_argument("task_id", help="Task UUID")
    update_parser.add_argument("--status", choices=["todo", "doing", "review", "done"], help="New status")
    
    # create command
    create_parser = subparsers.add_parser("create", help="Create a new task")
    create_parser.add_argument("project_id", help="Project UUID")
    create_parser.add_argument("title", help="Task title")
    create_parser.add_argument("--description", "-d", default="", help="Task description")

    args = parser.parse_args()
    
    archon_host = "http://192.168.5.203:8181"
    client = ArchonClient(base_url=archon_host)

    if args.command == "update":
        print(f"Updating task {args.task_id} status to {args.status}...")
        updates = {}
        if args.status:
            updates["status"] = args.status
            
        result = client.update_task(args.task_id, updates)
        if result.get("success", True):
             print(f"Successfully updated task {args.task_id}")
        else:
             print(f"Error updating task: {result.get('error')}")

    elif args.command == "create":
        print(f"Creating task '{args.title}' in project {args.project_id}...")
        result = client.create_task(args.project_id, args.title, args.description)
        if result.get("success", True):
             task = result.get("task", {})
             print(f"Successfully created task: {task.get('id')}")
        else:
             print(f"Error creating task: {result.get('error')}")
             
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
