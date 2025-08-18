/**
 * 翻译队列服务 - 控制并发翻译数量，提供进度显示
 */
export class TranslationQueue {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
    this.progress = {
      total: 0,
      completed: 0,
      failed: 0,
      current: []
    };
  }

  /**
   * 添加翻译任务到队列
   * @param {Function} task - 翻译任务函数
   * @param {Object} metadata - 任务元数据
   * @returns {Promise} 任务执行结果
   */
  async addTask(task, metadata = {}) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        id: Date.now() + Math.random(),
        task,
        metadata,
        resolve,
        reject,
        status: 'pending'
      };

      this.queue.push(queueItem);
      this.progress.total++;
      
      this.processQueue();
    });
  }

  /**
   * 处理队列中的任务
   */
  async processQueue() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.running++;
    item.status = 'running';
    
    // 更新当前运行的任务
    this.progress.current.push({
      id: item.id,
      metadata: item.metadata,
      startTime: new Date()
    });

    try {
      const result = await item.task();
      item.status = 'completed';
      this.progress.completed++;
      item.resolve(result);
    } catch (error) {
      item.status = 'failed';
      this.progress.failed++;
      item.reject(error);
    } finally {
      this.running--;
      
      // 从当前运行任务中移除
      this.progress.current = this.progress.current.filter(
        task => task.id !== item.id
      );
      
      // 继续处理队列
      this.processQueue();
    }
  }

  /**
   * 批量添加翻译任务
   * @param {Array} tasks - 任务数组，每个元素包含 {task, metadata}
   * @returns {Promise<Array>} 所有任务的结果
   */
  async addBatchTasks(tasks) {
    const promises = tasks.map(({ task, metadata }) => 
      this.addTask(task, metadata)
    );
    
    return Promise.allSettled(promises);
  }

  /**
   * 获取当前进度信息
   * @returns {Object} 进度信息
   */
  getProgress() {
    const { total, completed, failed, current } = this.progress;
    const pending = total - completed - failed;
    
    return {
      total,
      completed,
      failed,
      pending,
      current: current.map(task => ({
        ...task,
        duration: new Date() - task.startTime
      })),
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      summary: `${completed}/${total} (${this.progress.percentage}%)`
    };
  }

  /**
   * 重置进度
   */
  resetProgress() {
    this.progress = {
      total: 0,
      completed: 0,
      failed: 0,
      current: []
    };
  }

  /**
   * 等待所有任务完成
   * @returns {Promise} 完成状态
   */
  async waitForCompletion() {
    while (this.running > 0 || this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * 获取队列状态
   * @returns {Object} 队列状态
   */
  getStatus() {
    return {
      maxConcurrent: this.maxConcurrent,
      running: this.running,
      queued: this.queue.length,
      progress: this.getProgress()
    };
  }
}

/**
 * 翻译任务包装器 - 为每个翻译任务提供统一的接口
 */
export class TranslationTask {
  constructor(entry, feedConfig, agentManager, options = {}) {
    this.entry = entry;
    this.feedConfig = feedConfig;
    this.agentManager = agentManager;
    this.options = options;
    this.startTime = Date.now();
  }

  /**
   * 执行翻译任务
   * @returns {Promise<Object>} 翻译结果
   */
  async execute() {
    try {
      const result = {
        entryId: this.entry.guid,
        title: this.entry.title,
        success: false,
        translatedTitle: '',
        translatedContent: '',
        tokensUsed: 0,
        charactersUsed: 0,
        duration: 0,
        error: null
      };

      // 获取翻译代理
      const agent = await this.agentManager.getAgentById(this.feedConfig.translator_id);
      if (!agent || !agent.valid) {
        throw new Error('Invalid or missing translator agent');
      }

      // 翻译标题
      if (this.feedConfig.translate_title && this.entry.title) {
        const titleResult = await agent.translate(
          this.entry.title,
          this.feedConfig.target_language,
          { 
            textType: 'title', 
            userPrompt: this.feedConfig.additional_prompt 
          }
        );

        if (titleResult.success) {
          const originalTitle = this.entry.title.trim();
          const translatedTitle = titleResult.text.trim();
          
          if (originalTitle !== translatedTitle) {
            result.translatedTitle = translatedTitle;
            result.tokensUsed += titleResult.tokens || 0;
            result.charactersUsed += titleResult.characters || 0;
          }
        }
      }

      // 翻译内容
      if (this.feedConfig.translate_content && this.entry.content) {
        const contentResult = await agent.translate(
          this.entry.content,
          this.feedConfig.target_language,
          { 
            textType: 'content', 
            userPrompt: this.feedConfig.additional_prompt 
          }
        );

        if (contentResult.success) {
          const originalContent = this.entry.content.trim();
          const translatedContent = contentResult.text.trim();
          
          if (originalContent !== translatedContent) {
            result.translatedContent = translatedContent;
            result.tokensUsed += contentResult.tokens || 0;
            result.charactersUsed += contentResult.characters || 0;
          }
        }
      }

      result.success = true;
      result.duration = Date.now() - this.startTime;

      return result;

    } catch (error) {
      const result = {
        entryId: this.entry.guid,
        title: this.entry.title,
        success: false,
        translatedTitle: '',
        translatedContent: '',
        tokensUsed: 0,
        charactersUsed: 0,
        duration: Date.now() - this.startTime,
        error: error.message
      };

      throw result;
    }
  }

  /**
   * 获取任务描述
   * @returns {string} 任务描述
   */
  getDescription() {
    return `翻译文章: ${this.entry.title?.substring(0, 50)}...`;
  }
}
