/**
 * AI Provider Configuration
 * 支持的AI提供商配置：DeepSeek、OpenAI、豆包(火山引擎)
 */

export const AI_PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    nameCN: 'DeepSeek',
    description: 'DeepSeek V3/R1 系列',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    visionModel: null, // 不支持视觉模型
    hasVision: false,
    hint: '性价比高，支持超长上下文',
    baseUrlPlaceholder: 'https://api.deepseek.com (默认)',
    keyHint: 'sk-...',
  },
  openai: {
    name: 'OpenAI',
    nameCN: 'OpenAI',
    description: 'GPT-4o / GPT-4 Turbo',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    visionModel: 'gpt-4o',
    hasVision: true,
    hint: '功能全面，视觉能力强',
    baseUrlPlaceholder: 'https://api.openai.com/v1 (默认)',
    keyHint: 'sk-proj-...',
  },
  doubao: {
    name: 'Doubao',
    nameCN: '豆包(火山引擎)',
    description: '豆包大模型',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-lite-32k-250115',
    visionModel: 'doubao-1-5-vision-pro-32k-250115',
    hasVision: true,
    hint: '国产大模型，视觉能力优秀',
    baseUrlPlaceholder: '火山引擎方舟API地址',
    keyHint: '火山引擎方舟 API Key',
  },
};

// 默认分析图片的提示词
export const DEFAULT_IMAGE_PROMPT =
  "请对图片内容进行详尽分析。若图片是代码界面，详细解读代码逻辑，包括变量、函数、语句功能等，框选部分（若有）需逐行剖析；若是图表，阐述图表类型、数据趋势、关键数据点及代表意义；若是实物图片，说明物品名称、用途、特性等相关信息；若是场景图，描述场景构成元素、氛围、可能的地点或事件；若存在箭头指示，明确指出箭头指向的对象及关联信息；若有框选区域，精准说明框选部分的具体内容及在整体中的作用，其他部分用一句概括一下就行，主要介绍框选部分。";

/**
 * 获取保存的AI配置
 * @returns {Object} AI配置对象 { provider, apiKey, baseUrl, modelId }
 */
export function getAIConfig() {
  const config = {
    provider: localStorage.getItem('ai_provider') || 'deepseek',
    apiKey: localStorage.getItem('ai_api_key') || '',
    baseUrl: localStorage.getItem('ai_base_url') || '',
    modelId: localStorage.getItem('ai_model_id') || '',
  };
  return config;
}

/**
 * 保存AI配置
 * @param {Object} config - 配置对象
 */
export function saveAIConfig(config) {
  if (config.provider) localStorage.setItem('ai_provider', config.provider);
  if (config.apiKey !== undefined) localStorage.setItem('ai_api_key', config.apiKey);
  if (config.baseUrl !== undefined) localStorage.setItem('ai_base_url', config.baseUrl || '');
  if (config.modelId !== undefined) localStorage.setItem('ai_model_id', config.modelId || '');
}

/**
 * 根据提供商获取实际的Base URL和模型ID
 * @param {Object} config - 用户配置
 * @returns {Object} { baseUrl, chatModel, visionModel }
 */
function resolveProviderConfig(config) {
  const provider = AI_PROVIDERS[config.provider] || AI_PROVIDERS.deepseek;
  return {
    baseUrl: (config.baseUrl || provider.defaultBaseUrl).replace(/\/+$/, ''),
    chatModel: config.modelId || provider.defaultModel,
    visionModel: provider.visionModel,
    hasVision: provider.hasVision,
  };
}

/**
 * 调用AI聊天/补全API (兼容OpenAI协议)
 * @param {Array} messages - 消息数组 [{ role: 'user'/'assistant', content: ... }]
 * @param {Object} [options] - 可选参数 { model, stream }
 * @returns {Promise<string>} AI回复文本
 */
export async function callAIAPI(messages, options = {}) {
  const config = getAIConfig();

  if (!config.apiKey) {
    throw new Error('未配置API Key，请在设置中填写');
  }

  const resolved = resolveProviderConfig(config);

  // 如果指定了model，使用指定的；否则根据消息是否包含图像决定使用哪个模型
  let model = options.model || resolved.chatModel;
  const hasImageContent = messages.some(msg =>
    Array.isArray(msg.content) && msg.content.some(part => part.type === 'image_url')
  );
  if (hasImageContent && resolved.hasVision && resolved.visionModel && !options.model) {
    model = resolved.visionModel;
  }

  try {
    const response = await fetch(`${resolved.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 4096,
        ...(options.stream ? { stream: true } : {}),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API请求失败 (${response.status}): ${errorData.error?.message || errorData.message || response.statusText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0]) {
      throw new Error('API返回数据格式异常');
    }

    return data.choices[0].message?.content || '';
  } catch (error) {
    if (error.name === TypeError && error.message.includes('fetch')) {
      throw new Error('网络连接失败，请检查网络设置或Base URL是否正确');
    }
    throw error;
  }
}

/**
 * 分析图片内容（使用视觉模型或普通模型）
 * @param {string} base64Image - Base64编码的图片数据
 * @param {string} prompt - 提示词
 * @returns {Promise<string>} 分析结果
 */
export async function analyzeImage(base64Image, prompt = DEFAULT_IMAGE_PROMPT) {
  const config = getAIConfig();
  const provider = AI_PROVIDERS[config.provider] || AI_PROVIDERS.deepseek;

  if (provider.hasVision) {
    // 使用视觉模型 - 构建多模态消息
    const imageUri = `data:image/jpeg;base64,${base64Image}`;
    const message = {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageUri } },
      ],
    };
    return callAIAPI([message]);
  } else {
    // 非视觉模型：发送纯文本提示，告知用户该模型不支持直接看图
    const fallbackPrompt = `[系统提示：用户上传了一张图片，但当前选择的AI提供商(${provider.name})不支持视觉分析。请告知用户切换到支持视觉分析的提供商（如 OpenAI 或 豆包）以获得更好的体验。]\n\n用户问题: ${prompt}`;
    const message = { role: 'user', content: fallbackPrompt };
    return callAIAPI([message]);
  }
}

/**
 * 发送后续追问（带图片上下文）
 * @param {string} question - 追问内容
 * @param {string} base64Image - 图片base64（用于视觉模型的上下文保持）
 * @param {Array} history - 历史消息
 * @returns {Promise<string>} 回复
 */
export async function sendFollowup(question, base64Image, history = []) {
  const config = getAIConfig();
  const provider = AI_PROVIDERS[config.provider] || AI_PROVIDERS.deepseek;

  let messages = [...history];

  if (provider.hasVision) {
    // 视觉模型：每次都带上图片
    const imageUri = `data:image/jpeg;base64,${base64Image}`;
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: `基于这张图片，请回答: ${question}` },
        { type: 'image_url', image_url: { url: imageUri } },
      ],
    });
  } else {
    // 非视觉模型：普通文本对话
    messages.push({ role: 'user', content: question });
  }

  return callAIAPI(messages);
}

/**
 * 测试API连接
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function testConnection() {
  const config = getAIConfig();
  if (!config.apiKey) {
    return { success: false, message: '请先输入API Key' };
  }

  try {
    const result = await callAIAPI([
      { role: 'user', content: '你好，请回复"连接成功"来确认连接正常。' },
    ]);
    return { success: true, message: `连接成功！收到回复: ${result.substring(0, 50)}${result.length > 50 ? '...' : ''}` };
  } catch (error) {
    return { success: false, message: `连接失败: ${error.message}` };
  }
}

/**
 * 清除已保存的AI配置
 */
export function clearAIConfig() {
  localStorage.removeItem('ai_provider');
  localStorage.removeItem('ai_api_key');
  localStorage.removeItem('ai_base_url');
  localStorage.removeItem('ai_model_id');
}
