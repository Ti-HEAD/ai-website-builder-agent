import { AIChatAgent } from "@cloudflare/ai-chat";
import { routeAgentRequest } from "agents";
import { createWorkersAI } from "workers-ai-provider";
import { streamText, convertToModelMessages, tool, stepCountIs } from "ai";
import { z } from "zod";
import { renderFrontend } from "./frontend";

// ═══════════════════════════════════════════════════════════
//  無料枠ガード定数
// ═══════════════════════════════════════════════════════════

const R2_STORAGE_LIMIT_BYTES = 8 * 1024 * 1024 * 1024; // 8GB
const AGENT_MAX_STEPS = 12;
const MAX_FILES_PER_SESSION = 5;

// ═══════════════════════════════════════════════════════════
//  無料枠チェック関数
// ═══════════════════════════════════════════════════════════

async function checkR2Storage(env: Env): Promise<{ ok: boolean; message?: string }> {
  const list = await env.BUCKET.list();
  const totalSize = list.objects.reduce((sum, obj) => sum + obj.size, 0);
  if (totalSize > R2_STORAGE_LIMIT_BYTES) {
    return {
      ok: false,
      message: `R2ストレージが無料枠に近づいています (${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB / 10 GB)。古いファイルを削除してください。`,
    };
  }
  return { ok: true };
}

async function checkFileCount(env: Env): Promise<{ ok: boolean; count: number; message?: string }> {
  const list = await env.BUCKET.list();
  const codeFiles = list.objects.filter((obj) => !obj.key.startsWith("screenshots/"));
  if (codeFiles.length >= MAX_FILES_PER_SESSION * 10) {
    return {
      ok: false,
      count: codeFiles.length,
      message: `ファイル数が${codeFiles.length}件です。不要なファイルを削除してください。`,
    };
  }
  return { ok: true, count: codeFiles.length };
}

// ═══════════════════════════════════════════════════════════
//  ツール定義
// ═══════════════════════════════════════════════════════════

const planProjectTool = tool({
  description:
    "ウェブサイトの要件から必要なファイル構成を計画します。" +
    "ファイル名と各ファイルの内容の概要を返します。",
  inputSchema: z.object({
    siteType: z.string().describe("サイトの種類（例: ポートフォリオ、レストラン、ブログ）"),
    requirements: z.string().describe("サイトに含めるべき内容の詳細"),
  }),
  execute: async ({ siteType, requirements }) => {
    const files = [
      { filename: "index.html", description: "メインページ。全セクションを含む。" },
      { filename: "style.css", description: "スタイルシート。レスポンシブ対応。" },
    ];
    if (siteType.includes("レストラン") || siteType.includes("restaurant")) {
      files.push({ filename: "menu.html", description: "メニューページ。" });
    }
    return { siteType, files };
  },
});

const generateFileTool = tool({
  description:
    "指定されたファイルの内容を生成します。" +
    "完全なHTML/CSS/JSコードを返します。部分的なコードではなく、完全なファイルを作成してください。",
  inputSchema: z.object({
    filename: z.string().describe("ファイル名（例: index.html, style.css）"),
    siteType: z.string().describe("サイトの種類"),
    requirements: z.string().describe("このファイルに含めるべき内容"),
    existingCode: z
      .string()
      .optional()
      .describe("修正の場合、既存のコードを渡す。新規作成時は省略。"),
  }),
  execute: async ({ filename, siteType, requirements, existingCode }, { env }) => {
    const workersai = createWorkersAI({ binding: env.AI });

    const prompt = existingCode
      ? `以下の${filename}を修正してください。\n要件: ${requirements}\n\n既存コード:\n${existingCode}\n\n修正後の完全な${filename}を返してください。`
      : `${siteType}のウェブサイトの${filename}を作成してください。\n要件: ${requirements}\n\n完全な${filename}を返してください。`;

    const { text } = await workersai.generateText({
      model: "@cf/zai-org/glm-4.7-flash",
      prompt,
    });

    return { filename, code: text };
  },
});

const saveToR2Tool = tool({
  description: "生成したファイルをR2ストレージに保存します。",
  inputSchema: z.object({
    filename: z.string().describe("ファイル名"),
    content: z.string().describe("ファイルの内容（完全なコード）"),
  }),
  execute: async ({ filename, content }, { env }) => {
    const storageCheck = await checkR2Storage(env);
    if (!storageCheck.ok) {
      return { saved: false, error: storageCheck.message };
    }

    const fileCheck = await checkFileCount(env);
    if (!fileCheck.ok) {
      return { saved: false, error: fileCheck.message };
    }

    await env.BUCKET.put(filename, content, {
      httpMetadata: { contentType: getContentType(filename) },
    });
    return { saved: true, filename, size: content.length };
  },
});

const screenshotSiteTool = tool({
  description:
    "生成したウェブサイトのスクリーンショットを撮ります。" +
    "HTML内容を直接レンダリングしてキャプチャします。",
  inputSchema: z.object({
    htmlContent: z.string().describe("レンダリングするHTMLの内容"),
  }),
  execute: async ({ htmlContent }, { env }) => {
    const storageCheck = await checkR2Storage(env);
    if (!storageCheck.ok) {
      return { error: storageCheck.message };
    }

    const result = await env.BROWSER.quickAction("screenshot", {
      html: htmlContent,
    });

    const screenshotKey = `screenshots/${Date.now()}.png`;
    if (result.body) {
      await env.BUCKET.put(screenshotKey, result.body, {
        httpMetadata: { contentType: "image/png" },
      });
    }

    return {
      screenshotKey,
      browserMs: result.headers?.get("X-Browser-Ms-Used") || "unknown",
    };
  },
});

const reviewCodeTool = tool({
  description:
    "生成したコードをレビューし、改善点があれば返します。" +
    "問題がない場合は approved: true を返します。",
  inputSchema: z.object({
    filename: z.string().describe("レビュー対象のファイル名"),
    code: z.string().describe("レビュー対象のコード"),
    requirements: z.string().describe("サイトの要件"),
  }),
  execute: async ({ filename, code, requirements }, { env }) => {
    const workersai = createWorkersAI({ binding: env.AI });

    const { text } = await workersai.generateText({
      model: "@cf/zai-org/glm-4.7-flash",
      prompt:
        `以下の${filename}をレビューしてください。\n` +
        `要件: ${requirements}\n\n` +
        `コード:\n${code}\n\n` +
        `問題がない場合は「APPROVED」とだけ返してください。\n` +
        `問題がある場合は、修正すべき点を簡潔に説明してください。`,
    });

    const approved = text.trim().toUpperCase().startsWith("APPROVED");
    return { approved, feedback: approved ? "問題なし" : text };
  },
});

// ═══════════════════════════════════════════════════════════
//  エージェント本体
// ═══════════════════════════════════════════════════════════

export class SiteBuilderAgent extends AIChatAgent<Env> {
  async onChatMessage() {
    const storageCheck = await checkR2Storage(this.env);
    if (!storageCheck.ok) {
      return new Response(
        JSON.stringify({ type: "error", message: storageCheck.message }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const workersai = createWorkersAI({ binding: this.env.AI });

    const result = streamText({
      model: workersai("@cf/zai-org/glm-4.7-flash"),
      system:
        "あなたはウェブサイトを自律的に開発するAIエージェントです。" +
        "ユーザーの要件を聞いたら、以下の手順で自律的に開発を進めてください:\n" +
        "1. planProject ツールでファイル構成を計画\n" +
        "2. generateFile ツールで各ファイルのコードを生成\n" +
        "3. saveToR2 ツールで生成したファイルを保存\n" +
        "4. screenshotSite ツールで生成したサイトをブラウザで確認\n" +
        "5. reviewCode ツールでコードをレビュー\n" +
        "6. 問題があれば generateFile で修正して再度保存\n" +
        "7. 完成したらプレビューURLを通知\n" +
        "日本語で回答してください。",
      messages: await convertToModelMessages(this.messages),
      tools: {
        planProject: planProjectTool,
        generateFile: generateFileTool,
        saveToR2: saveToR2Tool,
        screenshotSite: screenshotSiteTool,
        reviewCode: reviewCodeTool,
      },
      stopWhen: stepCountIs(AGENT_MAX_STEPS),
    });

    return result.toUIMessageStreamResponse();
  }
}

// ═══════════════════════════════════════════════════════════
//  Worker エントリポイント
// ═══════════════════════════════════════════════════════════

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/preview/")) {
      const key = url.pathname.replace("/preview/", "");
      const obj = await env.BUCKET.get(key);
      if (!obj) return new Response("Not found", { status: 404 });
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set("etag", obj.httpEtag);
      headers.set("cache-control", "no-cache");
      return new Response(obj.body, { headers });
    }

    if (url.pathname === "/api/files" && request.method === "GET") {
      const list = await env.BUCKET.list();
      const totalSize = list.objects.reduce((sum, obj) => sum + obj.size, 0);
      const files = list.objects.map((obj) => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
        isScreenshot: obj.key.startsWith("screenshots/"),
      }));
      return Response.json({
        files,
        usage: {
          storageBytes: totalSize,
          storageGB: +(totalSize / 1024 / 1024 / 1024).toFixed(3),
          storageLimitGB: 10,
          storageWarning: totalSize > R2_STORAGE_LIMIT_BYTES,
          fileCount: files.filter((f) => !f.isScreenshot).length,
          fileCountLimit: MAX_FILES_PER_SESSION * 10,
        },
      });
    }

    if (url.pathname.startsWith("/api/files/") && request.method === "DELETE") {
      const key = url.pathname.replace("/api/files/", "");
      await env.BUCKET.delete(key);
      return Response.json({ deleted: true, key });
    }

    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(renderFrontend(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

// ═══════════════════════════════════════════════════════════
//  ヘルパー
// ═══════════════════════════════════════════════════════════

function getContentType(filename: string): string {
  if (filename.endsWith(".html")) return "text/html; charset=utf-8";
  if (filename.endsWith(".css")) return "text/css; charset=utf-8";
  if (filename.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}
