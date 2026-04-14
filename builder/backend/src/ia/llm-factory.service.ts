import { Injectable } from '@nestjs/common';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
// import { ChatOpenAI } from '@langchain/openai';
// import { ChatAnthropic } from '@langchain/anthropic';

@Injectable()
export class LlmFactoryService {
  private readonly defaultProvider: string;
  private readonly defaultModel: string;

  constructor() {
    this.defaultProvider = process.env.DEFAULT_LLM_PROVIDER ?? 'google';
    this.defaultModel = process.env.DEFAULT_LLM_MODEL ?? 'gemini-2.5-flash';
  }

  /**
   * Crea una instancia del modelo de chat para el provider y modelo indicados.
   * Si no se especifican, usa DEFAULT_LLM_PROVIDER y DEFAULT_LLM_MODEL del entorno.
   */
  create(provider?: string, modelName?: string): BaseChatModel {
    const resolvedProvider = provider ?? this.defaultProvider;
    const resolvedModel = modelName ?? this.defaultModel;

    switch (resolvedProvider) {
      case 'google':
        return this.createGoogle(resolvedModel);
      case 'openai':
        return this.createOpenAI(resolvedModel);
      case 'anthropic':
        return this.createAnthropic(resolvedModel);
      default:
        throw new Error(
          `Provider de LLM desconocido: "${resolvedProvider}". Proveedores soportados: google, openai, anthropic`,
        );
    }
  }

  private createGoogle(model: string): BaseChatModel {
    return new ChatGoogleGenerativeAI({ model });
  }

  private createOpenAI(model: string): BaseChatModel {
    // return new ChatOpenAI({ model });
    throw new Error('OpenAI not implemented yet');
  }

  private createAnthropic(model: string): BaseChatModel {
    // return new ChatAnthropic({ model });
    throw new Error('Anthropic not implemented yet');
  }
}
