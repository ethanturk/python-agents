import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Ensure backend is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Mock OPENAI_API_KEY before importing config
with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-mock-key", "OPENAI_API_BASE": "https://api.mock.com/v1", "OPENAI_MODEL": "mock-model"}):
    import config
    # Mock QdrantClient inside imports if needed, or patch where used
    with patch('qdrant_client.QdrantClient'):
        from sync_agent import run_sync_agent, perform_rag
        from async_tasks import check_knowledge_base, answer_question

class TestPydanticMigration(unittest.TestCase):
    
    @patch('sync_agent.Agent')
    def test_run_sync_agent(self, MockAgent):
        # Setup mock agent
        mock_instance = MockAgent.return_value
        mock_instance.run_sync.return_value.data = "Mock Response"
        
        response = run_sync_agent("Hello")
        
        self.assertEqual(response, "Mock Response")
        MockAgent.assert_called()
        self.assertEqual(mock_instance.run_sync.call_count, 1)

    @patch('sync_agent.Agent')
    @patch('sync_agent.search_documents') 
    def test_perform_rag(self, mock_search, MockAgent):
        mock_search.return_value = [{"content": "foo", "metadata": {"filename": "bar"}}]
        mock_instance = MockAgent.return_value
        mock_instance.run_sync.return_value.data = "RAG Answer"
        
        response = perform_rag("query")
        
        self.assertEqual(response['answer'], "RAG Answer")
        self.assertEqual(len(response['results']), 1)
        mock_instance.run_sync.assert_called()

    @patch('async_tasks.Agent')
    @patch('os.path.exists')
    def test_async_check_kb(self, mock_exists, MockAgent):
        mock_exists.return_value = True
        mock_instance = MockAgent.return_value
        mock_instance.run_sync.return_value.data = "YES"
        
        result = check_knowledge_base({"user_input": "hi"})
        
        self.assertEqual(result['step1_decision'], "YES")
        self.assertEqual(result['kb_location'], "existing_kb.txt")

    @patch('async_tasks.Agent')
    def test_async_answer_question(self, MockAgent):
        # We Mock Agent twice (once for extract, once for answer)
        # So MockAgent() returns a new mock each time
        mock_extract = MagicMock()
        mock_extract.run_sync.return_value.data = "Extracted Question"
        
        mock_answer = MagicMock()
        mock_answer.run_sync.return_value.data = "Final Answer"
        
        MockAgent.side_effect = [mock_extract, mock_answer]
        
        context_data = {
            "kb_location": "stub_knowledge_base.txt",
            "user_input": "Full Input"
        }
        
        # We need to mock open() as well since it reads the file
        with patch('builtins.open', unittest.mock.mock_open(read_data="KB CONTENT")):
            result = answer_question(context_data)
            
        self.assertIn("Question Extracted: Extracted Question", result)
        self.assertIn("Answer: Final Answer", result)

if __name__ == '__main__':
    unittest.main()
