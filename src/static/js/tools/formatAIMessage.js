import { escapeHtml } from "./escapeHtml.js";
/**
 * 格式化AI消息，支持Markdown元素
 * @param {string} text - AI返回的原始文本
 * @returns {string} - 格式化后的HTML
 */
function formatAIMessage(text) {
  if (!text) return '';
  
  // 处理代码块 (```code```)
  text = text.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `<pre class="code-block"><code>${escapeHtml(code.trim())}</code></pre>`;
  });
  
  // 处理行内代码 (`code`)
  text = text.replace(/`([^`]+)`/g, (match, code) => {
    return `<code class="inline-code">${escapeHtml(code)}</code>`;
  });
  
  // 处理加粗 (**text**)
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // 处理斜体 (*text*)
  text = text.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
  
  // 处理标题
  text = text.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  text = text.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  text = text.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  
  // 处理有序列表
  text = text.replace(/(\n|^)(\d+\.\s+(.*?)(\n|$))+/g, (match) => {
    const items = match.trim().split(/\n\d+\.\s+/).filter(Boolean);
    if (items.length === 0) return match;
    
    const firstNumberMatch = match.match(/\d+\./);
    const firstNumber = firstNumberMatch ? parseInt(firstNumberMatch[0]) : 1;
    
    let listItems = '';
    let counter = firstNumber;
    
    items.forEach((item, index) => {
      if (index === 0 && firstNumberMatch) {
        // 特殊处理第一项，它可能包含编号
        const itemContent = item.replace(/^\d+\.\s+/, '');
        listItems += `<li>${itemContent}</li>`;
      } else {
        listItems += `<li>${item}</li>`;
      }
      counter++;
    });
    
    return `<ol start="${firstNumber}">${listItems}</ol>`;
  });
  
  // 处理无序列表 - 支持 *、+ 和 - 作为列表标记
  text = text.replace(/(\n|^)([\*\+\-]\s+(.*?)(\n|$))+/g, (match) => {
    const items = match.trim().split(/\n[\*\+\-]\s+/).filter(Boolean);
    if (items.length === 0) return match;
    
    let listItems = '';
    items.forEach((item, index) => {
      if (index === 0) {
        // 特殊处理第一项，它可能包含列表标记
        const itemContent = item.replace(/^[\*\+\-]\s+/, '');
        listItems += `<li>${itemContent}</li>`;
      } else {
        listItems += `<li>${item}</li>`;
      }
    });
    
    return `<ul>${listItems}</ul>`;
  });
  
  // 处理换行
  text = text.replace(/\n/g, '<br>');
  
  return text;
}

export { formatAIMessage };
