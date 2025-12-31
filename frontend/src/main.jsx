import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { DocumentSetProvider } from './contexts/DocumentSetContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <DocumentSetProvider>
        <App />
      </DocumentSetProvider>
    </AuthProvider>
  </React.StrictMode>,
)
