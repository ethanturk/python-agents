#!/usr/bin/env python3
import sys
import argparse
import os

# Ensure local imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from archon_client import ArchonClient

def main():
    parser = argparse.ArgumentParser(description="Manage Archon Tasks")
    parser.add_argument("--host", default="http://192.168.5.203:8181", help="Archon Host URL")
    
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
    
    client = ArchonClient(base_url=args.host)

    if args.command == "update":
        print(f"Updating task {args.task_id} status to {args.status}...")
        updates = {}
        if args.status:
            updates["status"] = args.status
            
        result = client.update_task(args.task_id, updates)
        if result.get("success", True) and "error" not in result:
             print(f"Successfully updated task {args.task_id}")
        else:
             print(f"Error updating task: {result.get('error', result)}")

    elif args.command == "create":
        print(f"Creating task '{args.title}' in project {args.project_id}...")
        result = client.create_task(args.project_id, args.title, args.description)
        if result.get("success", True) and "error" not in result:
             task = result.get("task", {})
             # Fallback if task object isn't returned directly but id is in result
             task_id = task.get('id') or result.get('id')
             print(f"Successfully created task: {task_id}")
        else:
             print(f"Error creating task: {result.get('error', result)}")
             
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
