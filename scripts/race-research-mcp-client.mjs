import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const decodeJsonRpcLine = (line, onProtocolWarning = () => {}) => {
  try { return JSON.parse(line); }
  catch (error) {
    onProtocolWarning(`MCP stdout ignoré (hors JSON-RPC) : ${String(line).slice(0, 240)}`);
    return null;
  }
};

export const createRaceResearchMcpClient = async ({ serverPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "race-research-mcp.mjs"), timeoutMs = 300_000, onProtocolWarning = message => process.stderr.write(`${message}\n`) } = {}) => {
  const child = spawn(process.execPath, [serverPath], { stdio: ["pipe", "pipe", "inherit"] });
  let nextId = 1;
  let buffer = "";
  const pending = new Map();
  let closed = false;
  const failAll = (error) => { closed = true; for (const { reject, timer } of pending.values()) {clearTimeout(timer); reject(error);} pending.clear(); };
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = decodeJsonRpcLine(line, onProtocolWarning);
      if (!message) continue;
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(message.error.message || "MCP error"));
      else request.resolve(message.result);
    }
  });
  child.on("error", failAll);
  child.on("exit", (code) => failAll(new Error(`MCP server exited with code ${code}`)));
  child.stdin.on("error", failAll);
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    if (closed) { reject(new Error("MCP client closed")); return; }
    const timer = setTimeout(() => { failAll(new Error(`MCP ${method} timeout`)); child.kill(); }, method === "initialize" ? Math.min(timeoutMs, 10_000) : timeoutMs);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
  const initialize = await request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "paceyourself-local-scraper", version: "1.0.0" } });
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} })}\n`);
  return {
    initialize,
    async callTool(name, args) {
      const result = await request("tools/call", { name, arguments: args });
      if (result?.isError) throw new Error(result.content?.[0]?.text || "MCP tool error");
      const text = result?.content?.find((item) => item.type === "text")?.text || "{}";
      return JSON.parse(text);
    },
    close() { child.stdin.end(); child.kill(); failAll(new Error("MCP client closed")); },
  };
};
