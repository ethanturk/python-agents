#!/usr/bin/env python3
"""
Archon API Client - Standardized interface for Archon REST API
Provides helper functions for all MCP tool equivalents
(Adapted to use urllib.request - Standard Library)
"""
import urllib.request
import urllib.error
import urllib.parse
import json
from typing import Dict, List, Optional, Any


class ArchonClient:
    """Client for interacting with Archon API Server"""
    
    def __init__(self, base_url: str = "http://localhost:8181"):
        self.base_url = base_url
        self.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "ArchonClient/1.0"
        }
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict:
        try:
            url = f"{self.base_url}{endpoint}"
            
            if "params" in kwargs and kwargs["params"]:
                query = urllib.parse.urlencode(kwargs["params"])
                url = f"{url}?{query}"
            
            data = None
            if "json" in kwargs and kwargs["json"]:
                data = json.dumps(kwargs["json"]).encode('utf-8')
            
            req = urllib.request.Request(url, data=data, headers=self.headers, method=method)
            
            with urllib.request.urlopen(req, timeout=30) as response:
                 resp_body = response.read().decode('utf-8')
                 return json.loads(resp_body)
                 
        except urllib.error.HTTPError as e:
            try:
                err_text = e.read().decode('utf-8')
            except:
                err_text = str(e)
            return {"success": False, "error": f"HTTP {e.code}: {err_text}"}
        except urllib.error.URLError as e:
            return {"success": False, "error": f"Connection Error: {e.reason}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    # ===== Knowledge Management =====
    
    def search_knowledge(self, query: str, top_k: int = 10, use_reranking: bool = True, search_strategy: str = "hybrid", filters: Optional[Dict] = None) -> Dict:
        return self._request("POST", "/api/knowledge-items/search", json={
            "query": query, "top_k": top_k, "use_reranking": use_reranking, "search_strategy": search_strategy, "filters": filters or {}
        })
    
    def list_knowledge_items(self, limit: int = 50, offset: int = 0, source_type: Optional[str] = None) -> Dict:
        params = {"limit": limit, "offset": offset}
        if source_type: params["source_type"] = source_type
        return self._request("GET", "/api/knowledge-items", params=params)

    # ===== Project Management =====
    
    def list_projects(self) -> Dict:
        return self._request("GET", "/api/projects")
    
    def get_project(self, project_id: str) -> Dict:
        return self._request("GET", f"/api/projects/{project_id}")
        
    def create_project(self, name: str, description: str = "") -> Dict:
        return self._request("POST", "/api/projects", json={"name": name, "description": description})
    
    # ===== Task Management =====
    
    def list_tasks(self, project_id: Optional[str] = None, status: Optional[str] = None, limit: int = 50) -> Dict:
        params = {"limit": limit}
        if project_id: params["project_id"] = project_id
        if status: params["status"] = status
        return self._request("GET", "/api/tasks", params=params)
        
    def create_task(self, project_id: str, title: str, description: str = "", status: str = "todo") -> Dict:
        return self._request("POST", "/api/tasks", json={
            "project_id": project_id, "title": title, "description": description, "status": status
        })
        
    def update_task(self, task_id: str, updates: Dict) -> Dict:
        return self._request("PUT", f"/api/tasks/{task_id}", json=updates)
    
    def get_task(self, task_id: str) -> Dict:
        return self._request("GET", f"/api/tasks/{task_id}")
