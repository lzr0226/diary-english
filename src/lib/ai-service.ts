import { cloudEnabled } from "./cloud/config";
import { authorizedFetch } from "./cloud/client";
import { MockAIService, type AIService } from "./ai";
import { resultSchema } from "./model";
class CloudAIService implements AIService {
  async generate(text: string, diaryId: string, task: string) {
    const response = await authorizedFetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, text, diaryId }),
      signal: AbortSignal.timeout(45000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "AI 请求失败");
    return resultSchema.parse(body);
  }
  async chat(text: string, diaryId: string) {
    const response = await authorizedFetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "chat", text, diaryId }),
      signal: AbortSignal.timeout(45000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "助手请求失败");
    return body.resultText as string;
  }
}
export function aiService(): AIService {
  return cloudEnabled ? new CloudAIService() : new MockAIService();
}
