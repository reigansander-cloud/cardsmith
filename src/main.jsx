import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { installDragSafetyNet } from '@/utils/dragClipboardSafety'

installDragSafetyNet()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)