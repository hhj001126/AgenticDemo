import './index.css'; // 自定义样式（滚动条、markdown、动画等）
import React from 'react';
import ReactDOM from 'react-dom/client';
import './services/geminiService'; // 触发内置工具注册
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
